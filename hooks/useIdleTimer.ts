"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiUrl } from "@/lib/constants";

const POLL_INTERVAL = 15_000;
const EXTEND_MS = 15 * 60 * 1000;

export function useIdleTimer(podId: string, isRunning: boolean) {
  const [serverRemainingMs, setServerRemainingMs] = useState<number | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number>(0);
  const [displayMs, setDisplayMs] = useState<number | null>(null);

  // Polling server
  const fetchIdle = useCallback(async () => {
    if (!podId || !isRunning) return;
    try {
      const res = await fetch(apiUrl("/api/pod/idle-status"), {
        headers: { "x-pod-id": podId },
      });
      const data = await res.json();
      if (data.idle) {
        setServerRemainingMs(data.idle.remainingMs);
        setFetchedAt(Date.now());
      } else {
        setServerRemainingMs(null);
      }
    } catch {
      // ignore
    }
  }, [podId, isRunning]);

  useEffect(() => {
    if (!podId || !isRunning) {
      setServerRemainingMs(null);
      setDisplayMs(null);
      return;
    }
    fetchIdle();
    const id = setInterval(fetchIdle, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchIdle, podId, isRunning]);

  // Local countdown
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);

    if (serverRemainingMs === null) {
      setDisplayMs(null);
      return;
    }

    const tick = () => {
      const elapsed = Date.now() - fetchedAt;
      setDisplayMs(Math.max(0, serverRemainingMs - elapsed));
    };
    tick();
    tickRef.current = setInterval(tick, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [serverRemainingMs, fetchedAt]);

  // Extend
  const extend = useCallback(async () => {
    if (!podId) return;
    try {
      const res = await fetch(apiUrl("/api/pod/idle-status"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ podId, extraMs: EXTEND_MS }),
      });
      const data = await res.json();
      if (data.idle) {
        setServerRemainingMs(data.idle.remainingMs);
        setFetchedAt(Date.now());
      }
    } catch {
      // ignore
    }
  }, [podId]);

  return { remainingMs: displayMs, extend };
}
