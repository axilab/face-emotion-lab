"use client";

import { readSetupSSE } from "@/lib/sse";
import { POLL_INTERVAL_MS, GENERATION_TIMEOUT_MS, apiUrl } from "@/lib/constants";
import { toast } from "sonner";

// --- Retry logic for transient proxy errors (502/503/504) ---

const RETRYABLE_STATUSES = [502, 503, 504];
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 2000;
const MAX_DELAY_MS = 30000;

/** Detect Cloudflare HTML error pages and extract a meaningful message */
function sanitizeErrorText(status: number, text: string): string {
  if (text.includes("<!DOCTYPE") || text.includes("<html")) {
    if (status === 502) return "502 Bad Gateway — ComfyUI не отвечает (возможно перезагружается)";
    if (status === 503) return "503 Service Unavailable — ComfyUI недоступен";
    if (status === 504) return "504 Gateway Timeout — ComfyUI не успел ответить";
    return `${status} — сервер временно недоступен`;
  }
  // Truncate long error texts
  return text.length > 200 ? text.slice(0, 200) + "..." : text;
}

async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  label?: string
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, init);

      if (RETRYABLE_STATUSES.includes(res.status) && attempt < MAX_RETRIES) {
        const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000, MAX_DELAY_MS);
        console.warn(
          `[pipeline] ${label || url}: ${res.status}, retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay)}ms`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return res;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));

      if (attempt < MAX_RETRIES) {
        const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000, MAX_DELAY_MS);
        console.warn(
          `[pipeline] ${label || url}: network error, retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay)}ms`,
          lastError.message
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
    }
  }

  throw lastError || new Error(`Failed after ${MAX_RETRIES} retries`);
}

// --- Setup cache ---
// Module-level cache: podId for which setup has already been completed
let setupDonePodId: string | null = null;

export function markSetupDone(podId: string) {
  setupDonePodId = podId;
}

export function clearSetupDone() {
  setupDonePodId = null;
}

// --- Pipeline functions ---

export async function autoSetupPod(podId: string): Promise<boolean> {
  if (setupDonePodId === podId) return true;

  const res = await fetch(apiUrl("/api/pod/setup"), {
    method: "POST",
    headers: {
      "x-pod-id": podId,
    },
  });
  if (!res.ok) return false;

  try {
    const toastId = toast.loading("Настройка пода...");
    const result = await readSetupSSE(res, (message) => {
      toast.loading(message, { id: toastId });
    });
    toast.dismiss(toastId);
    const success = !!result.success;
    if (success) setupDonePodId = podId;
    return success;
  } catch {
    return false;
  }
}

export async function uploadImage(file: File, podId: string): Promise<string> {
  const randomName = `fel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
  const formData = new FormData();
  formData.append("image", file, randomName);
  formData.append("overwrite", "true");

  const res = await fetchWithRetry(
    apiUrl("/api/comfyui/upload"),
    {
      method: "POST",
      headers: { "x-pod-id": podId },
      body: formData,
    },
    "upload"
  );

  const data = await res.json();
  if (data.error) throw new Error(sanitizeErrorText(res.status, data.error));
  return data.name;
}

export async function submitWorkflow(
  workflow: Record<string, unknown>,
  podId: string
): Promise<string> {
  const clientId = `fel_${Math.random().toString(36).slice(2, 8)}`;
  const res = await fetchWithRetry(
    apiUrl("/api/comfyui/prompt"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pod-id": podId,
      },
      body: JSON.stringify({ prompt: workflow, client_id: clientId }),
    },
    "prompt"
  );

  const data = await res.json();
  if (data.error) throw new Error(sanitizeErrorText(res.status, data.error));
  if (!data.prompt_id) throw new Error("No prompt_id in response");
  return data.prompt_id;
}

export async function pollResult(
  promptId: string,
  podId: string
): Promise<{ filename: string; subfolder: string; type: string }> {
  const start = Date.now();
  let consecutive502 = 0;

  while (Date.now() - start < GENERATION_TIMEOUT_MS) {
    try {
      const res = await fetchWithRetry(
        apiUrl(`/api/comfyui/history/${promptId}`),
        { headers: { "x-pod-id": podId } },
        "history"
      );

      if (RETRYABLE_STATUSES.includes(res.status)) {
        consecutive502++;
        if (consecutive502 >= 3) {
          throw new Error("ComfyUI не отвечает после нескольких попыток. Под мог перезагрузиться.");
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS * 2));
        continue;
      }

      consecutive502 = 0;
      const data = await res.json();

      if (data[promptId]) {
        const entry = data[promptId];
        const status = entry.status;

        if (status?.status_str === "error") {
          let errorMsg = "Ошибка обработки ComfyUI";
          const messages = status.messages || [];
          for (const msg of messages) {
            if (Array.isArray(msg) && msg.length > 1 && msg[1]?.exception_message) {
              errorMsg = msg[1].exception_message;
              break;
            }
          }
          throw new Error(errorMsg);
        }

        if (entry.outputs) {
          const nodeOutput = entry.outputs["4"];
          if (nodeOutput?.images?.[0]) {
            return nodeOutput.images[0];
          }
        }
      }
    } catch (e) {
      // Re-throw non-retryable errors
      if (e instanceof Error && !e.message.includes("fetch")) throw e;
      consecutive502++;
      if (consecutive502 >= 3) throw e;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(`Таймаут: ${GENERATION_TIMEOUT_MS / 1000} сек`);
}

export async function downloadResult(
  imageInfo: { filename: string; subfolder: string; type: string },
  podId: string
): Promise<string> {
  const params = new URLSearchParams({
    filename: imageInfo.filename,
    subfolder: imageInfo.subfolder || "",
    type: imageInfo.type || "output",
  });

  const res = await fetchWithRetry(
    apiUrl(`/api/comfyui/view?${params}`),
    { headers: { "x-pod-id": podId } },
    "download"
  );

  if (!res.ok) throw new Error(`Ошибка скачивания: ${res.status}`);

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Call ComfyUI /free to unload models and release RAM */
export async function freeComfyMemory(podId: string): Promise<void> {
  try {
    await fetchWithRetry(
      apiUrl("/api/comfyui/free"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-pod-id": podId,
        },
      },
      "free"
    );
  } catch {
    // Non-critical — log and continue
    console.warn("[pipeline] freeComfyMemory failed, continuing");
  }
}

/** Small pause between sequential generations */
export function generationDelay(ms: number = 1000): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
