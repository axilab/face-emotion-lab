import { getPublicKey } from "@/lib/ssh";
import { queryPods, updatePodEnv } from "@/lib/runpod";

export async function syncSSHKeys() {
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!apiKey) return;

  const publicKey = getPublicKey();
  const pods = await queryPods(apiKey);

  if (pods.length === 0) {
    console.log("[init] No pods to sync SSH key");
    return;
  }

  for (const pod of pods) {
    try {
      await updatePodEnv(apiKey, pod.id, { PUBLIC_KEY: publicKey });
      console.log(`[init] SSH key synced for pod ${pod.id} (${pod.name})`);
    } catch (e) {
      console.warn(`[init] Failed to sync key for pod ${pod.id}:`, e);
    }
  }
}
