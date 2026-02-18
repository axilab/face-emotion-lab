"use client";

import { useEffect, useCallback, useRef } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { usePodStore } from "@/stores/usePodStore";
import { apiUrl, POD_POLL_INTERVAL_MS } from "@/lib/constants";
import { clearSetupDone } from "@/lib/pipeline";
import { PodInfo } from "@/lib/types";
import { toast } from "sonner";

export function usePodPolling() {
  const podId = useSettingsStore((s) => s.podId);
  const setPodId = useSettingsStore((s) => s.setPodId);
  const { setPods, setError } = usePodStore();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStatusRef = useRef<Map<string, string>>(new Map());

  const fetchPods = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/pod/list"));
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const pods: PodInfo[] = data.pods || [];
      setPods(pods);

      // Auto-select if only one pod and none selected
      const currentPodId = useSettingsStore.getState().podId;
      if (!currentPodId && pods.length === 1) {
        setPodId(pods[0].id);
      }

      // Detect RUNNING → EXITED transitions for auto-stop notification
      const activePodId = currentPodId || (pods.length === 1 ? pods[0].id : "");
      if (activePodId) {
        const prevStatus = prevStatusRef.current.get(activePodId);
        const currentPod = pods.find((p) => p.id === activePodId);
        const currentStatus = currentPod?.desiredStatus;

        if (prevStatus === "RUNNING" && currentStatus === "EXITED") {
          clearSetupDone();
          // Check if it was an auto-stop
          try {
            const idleRes = await fetch(apiUrl("/api/pod/idle-status"), {
              headers: { "x-pod-id": activePodId },
            });
            const idleData = await idleRes.json();
            if (idleData.wasAutoStopped) {
              toast.warning("Под остановлен автоматически (idle timeout)");
            }
          } catch {
            // ignore idle-status errors
          }
        }
      }

      // Update prev statuses
      const newMap = new Map<string, string>();
      for (const pod of pods) {
        newMap.set(pod.id, pod.desiredStatus);
      }
      prevStatusRef.current = newMap;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Не удалось загрузить список подов";
      setError(msg);
    }
  }, [setPods, setError, setPodId]);

  useEffect(() => {
    fetchPods();
    pollRef.current = setInterval(fetchPods, POD_POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchPods]);
}
