import { RUNPOD_TEMPLATE_ID, POD_CREATE_CONFIG } from "./constants";
import { GpuOption } from "./types";
import { proxyFetch } from "./fetch";

const _seenPartialWarnings = new Set<string>();

export async function runpodGraphQL(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>
) {
  const url = `https://api.runpod.io/graphql?api_key=${apiKey}`;
  const payload: Record<string, unknown> = { query };
  if (variables) payload.variables = variables;

  const res = await proxyFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`RunPod API error: ${res.status} ${res.statusText}`);
  }

  const result = await res.json();
  if (result.errors) {
    const msg = result.errors[0]?.message || "";
    // GraphQL can return partial data alongside errors.
    // Only throw if there's no usable data at all.
    if (!result.data || Object.values(result.data).every((v) => v === null)) {
      console.error("[RunPod GraphQL error]", msg);
      throw new Error(translateRunpodError(msg));
    }
    // Partial errors are common (e.g. stopped pods missing runtime fields).
    // Data is usable — log once at debug level only.
    if (!_seenPartialWarnings.has(msg)) {
      _seenPartialWarnings.add(msg);
      console.debug("[RunPod GraphQL partial]", `${result.errors.length} non-critical error(s), data OK`);
    }
  }
  return result.data || {};
}

export async function queryPods(apiKey: string) {
  const data = await runpodGraphQL(
    apiKey,
    `{ myself { pods { id name desiredStatus costPerHr
      machine { gpuDisplayName }
      runtime { ports { ip isIpPublic privatePort publicPort type } }
    } } }`
  );
  return data?.myself?.pods || [];
}

/** Minimum VRAM required for ExpressionEditor (LivePortrait) */
const MIN_VRAM_GB = 24;

export async function queryGpuTypes(apiKey: string): Promise<GpuOption[]> {
  const data = await runpodGraphQL(
    apiKey,
    `{ gpuTypes { id displayName memoryInGb securePrice communityPrice
      communityCloud secureCloud maxGpuCount
      lowestPrice { minimumBidPrice uninterruptablePrice }
    } }`
  );
  const raw = data?.gpuTypes || [];
  return raw
    .filter((g: { memoryInGb: number }) => g.memoryInGb >= MIN_VRAM_GB)
    .map((g: {
      id: string;
      displayName: string;
      memoryInGb: number;
      securePrice: number | null;
      communityPrice: number | null;
      communityCloud: boolean;
      secureCloud: boolean;
      maxGpuCount: number;
      lowestPrice: { minimumBidPrice: number; uninterruptablePrice: number } | null;
    }) => ({
      id: g.id,
      displayName: g.displayName,
      memoryInGb: g.memoryInGb,
      securePrice: g.securePrice,
      communityPrice: g.communityPrice,
      lowestPrice: g.lowestPrice?.uninterruptablePrice ?? g.communityPrice ?? g.securePrice,
      communityCloud: g.communityCloud ?? false,
      secureCloud: g.secureCloud ?? false,
      maxGpuCount: g.maxGpuCount ?? 0,
    }))
    .sort((a: GpuOption, b: GpuOption) => (a.lowestPrice ?? 99) - (b.lowestPrice ?? 99));
}

/**
 * Get SSH connection info (IP + port) for a pod.
 */
export async function getPodSSHInfo(
  apiKey: string,
  podId: string
): Promise<{ host: string; port: number } | null> {
  const pods = await queryPods(apiKey);
  const pod = pods.find((p: { id: string }) => p.id === podId);
  if (!pod?.runtime?.ports) return null;

  for (const port of pod.runtime.ports) {
    if (
      port.privatePort === 22 &&
      port.type === "tcp" &&
      port.isIpPublic
    ) {
      return { host: port.ip, port: port.publicPort };
    }
  }
  return null;
}

export async function createPod(
  apiKey: string,
  podName: string,
  gpuType: string,
  publicKey?: string
) {
  const mutation = `mutation($input: PodFindAndDeployOnDemandInput!) {
    podFindAndDeployOnDemand(input: $input) {
      id name desiredStatus
    }
  }`;

  const sshKey = publicKey || "ssh-ed25519 AAAA placeholder-for-web-app";

  // Try the selected GPU first, then fall back to others from live list
  let fallbackIds: string[] = [];
  try {
    const gpuTypes = await queryGpuTypes(apiKey);
    fallbackIds = gpuTypes.map((g) => g.id).filter((id) => id !== gpuType);
  } catch {
    // If GPU query fails, just try the selected type
  }
  const gpuList = [gpuType, ...fallbackIds];

  for (const gpu of gpuList) {
    try {
      const data = await runpodGraphQL(apiKey, mutation, {
        input: {
          name: podName,
          templateId: RUNPOD_TEMPLATE_ID,
          gpuTypeId: gpu,
          gpuCount: POD_CREATE_CONFIG.gpuCount,
          volumeInGb: POD_CREATE_CONFIG.volumeInGb,
          containerDiskInGb: POD_CREATE_CONFIG.containerDiskInGb,
          minVcpuCount: POD_CREATE_CONFIG.minVcpuCount,
          minMemoryInGb: POD_CREATE_CONFIG.minMemoryInGb,
          env: [{ key: "PUBLIC_KEY", value: sshKey }],
        },
      });

      const pod = data?.podFindAndDeployOnDemand;
      if (pod) return { ...pod, gpu };
    } catch {
      continue;
    }
  }

  throw new Error("Could not create pod with any GPU type");
}

export async function startPod(apiKey: string, podId: string) {
  const data = await runpodGraphQL(
    apiKey,
    `mutation { podResume(input: { podId: "${podId}", gpuCount: 1 }) { id desiredStatus } }`
  );
  return data?.podResume;
}

const GPU_UNAVAILABLE_RE = /not enough free GPUs/i;

/**
 * Try to start the given pod. If its GPU is unavailable, iterate
 * through other stopped pods sorted by costPerHr ascending and try each.
 * Returns { pod, startedPodId } where startedPodId may differ from the original.
 */
export async function startPodWithFallback(
  apiKey: string,
  podId: string
): Promise<{ pod: { id: string; desiredStatus: string }; startedPodId: string; fallback: boolean }> {
  // 1. Try the requested pod first
  try {
    const result = await startPod(apiKey, podId);
    return { pod: result, startedPodId: podId, fallback: false };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    // Only fallback on GPU availability error
    if (!GPU_UNAVAILABLE_RE.test(msg)) throw e;
    console.warn(`[startPodWithFallback] Pod ${podId} GPU unavailable, trying fallbacks...`);
  }

  // 2. Get all pods and sort stopped ones by cost
  const allPods = await queryPods(apiKey);
  const candidates = allPods
    .filter((p: { id: string; desiredStatus: string }) =>
      p.id !== podId && p.desiredStatus === "EXITED"
    )
    .sort((a: { costPerHr?: number }, b: { costPerHr?: number }) =>
      (a.costPerHr ?? 99) - (b.costPerHr ?? 99)
    );

  // 3. Try each candidate
  for (const candidate of candidates) {
    try {
      console.log(`[startPodWithFallback] Trying pod ${candidate.id} (${candidate.name})...`);
      const result = await startPod(apiKey, candidate.id);
      return { pod: result, startedPodId: candidate.id, fallback: true };
    } catch {
      continue;
    }
  }

  throw new Error(
    "Нет свободных GPU. Не удалось запустить ни один из доступных подов."
  );
}

export async function updatePodEnv(
  apiKey: string,
  podId: string,
  env: Record<string, string>
) {
  const res = await proxyFetch(`https://rest.runpod.io/v1/pods/${podId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ env }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RunPod REST API error: ${res.status} ${text}`);
  }

  return await res.json();
}

export async function stopPod(apiKey: string, podId: string) {
  const data = await runpodGraphQL(
    apiKey,
    `mutation { podStop(input: { podId: "${podId}" }) { id desiredStatus } }`
  );
  return data?.podStop;
}

const RUNPOD_ERROR_MAP: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /not enough free GPUs/i,
    message:
      "Нет свободных GPU этого типа. Попробуйте позже или создайте новый под с другим GPU.",
  },
  {
    pattern: /pod not found/i,
    message: "Под не найден. Проверьте ID пода в Настройках.",
  },
  {
    pattern: /unauthorized|authentication/i,
    message: "Ошибка авторизации. Проверьте API-ключ RunPod в Настройках.",
  },
  {
    pattern: /insufficient funds|balance/i,
    message: "Недостаточно средств на балансе RunPod. Пополните баланс на runpod.io.",
  },
];

function translateRunpodError(originalMessage: string): string {
  for (const { pattern, message } of RUNPOD_ERROR_MAP) {
    if (pattern.test(originalMessage)) return `${message} (${originalMessage})`;
  }
  return `Ошибка RunPod: ${originalMessage}`;
}
