import { stopPod } from "./runpod";

const POD_IDLE_TIMEOUT_MS = parseInt(
  process.env.POD_IDLE_TIMEOUT_MS || "300000",
  10
);

const timers = new Map<string, NodeJS.Timeout>();
const autoStoppedPodIds = new Set<string>();
const lastActivityAt = new Map<string, number>();
const podTimeouts = new Map<string, number>();

function scheduleAutoStop(podId: string, delayMs: number): void {
  const timeout = setTimeout(async () => {
    timers.delete(podId);
    lastActivityAt.delete(podId);
    podTimeouts.delete(podId);
    try {
      const apiKey = process.env.RUNPOD_API_KEY;
      if (!apiKey) {
        console.error("[idle-tracker] RUNPOD_API_KEY not set, skipping auto-stop");
        return;
      }
      console.log(`[idle-tracker] Auto-stopping pod ${podId} after idle`);
      await stopPod(apiKey, podId);
      autoStoppedPodIds.add(podId);
    } catch (e) {
      console.error(`[idle-tracker] Failed to auto-stop pod ${podId}:`, e);
    }
  }, delayMs);
  timers.set(podId, timeout);
}

export function trackActivity(podId: string): void {
  const existing = timers.get(podId);
  if (existing) clearTimeout(existing);

  lastActivityAt.set(podId, Date.now());
  podTimeouts.set(podId, POD_IDLE_TIMEOUT_MS);
  scheduleAutoStop(podId, POD_IDLE_TIMEOUT_MS);
}

export function clearTracking(podId: string): void {
  const existing = timers.get(podId);
  if (existing) {
    clearTimeout(existing);
    timers.delete(podId);
  }
  lastActivityAt.delete(podId);
  podTimeouts.delete(podId);
}

export function wasAutoStopped(podId: string): boolean {
  if (autoStoppedPodIds.has(podId)) {
    autoStoppedPodIds.delete(podId);
    return true;
  }
  return false;
}

export function getIdleInfo(podId: string): { remainingMs: number; timeoutMs: number } | null {
  const lastActivity = lastActivityAt.get(podId);
  if (lastActivity === undefined) return null;
  const timeout = podTimeouts.get(podId) ?? POD_IDLE_TIMEOUT_MS;
  const remaining = Math.max(0, timeout - (Date.now() - lastActivity));
  return { remainingMs: remaining, timeoutMs: timeout };
}

export function extendTime(podId: string, extraMs: number): boolean {
  const lastActivity = lastActivityAt.get(podId);
  if (lastActivity === undefined) return false;

  const currentTimeout = podTimeouts.get(podId) ?? POD_IDLE_TIMEOUT_MS;
  const newTimeout = currentTimeout + extraMs;
  podTimeouts.set(podId, newTimeout);

  const existing = timers.get(podId);
  if (existing) clearTimeout(existing);

  const elapsed = Date.now() - lastActivity;
  const newRemaining = Math.max(0, newTimeout - elapsed);
  scheduleAutoStop(podId, newRemaining);

  return true;
}
