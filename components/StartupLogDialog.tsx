"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SetupLogPanel } from "@/components/SetupLogPanel";
import { readSetupSSE } from "@/lib/sse";
import { apiUrl } from "@/lib/constants";
import { markSetupDone } from "@/lib/pipeline";
import { RefreshCw } from "lucide-react";

interface StartupLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  podId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

type SetupStatus = "idle" | "running" | "done" | "error";

export function StartupLogDialog({
  open,
  onOpenChange,
  podId,
  onComplete,
  onError,
}: StartupLogDialogProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<SetupStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const hasStartedRef = useRef(false);
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSetup = useCallback(async () => {
    if (!podId) return;
    setLogs([]);
    setStatus("running");
    setErrorMsg(null);

    try {
      const res = await fetch(apiUrl("/api/pod/setup"), {
        method: "POST",
        headers: { "x-pod-id": podId },
      });

      if (!res.ok) {
        const text = await res.text();
        let msg = "Ошибка настройки";
        try { msg = JSON.parse(text).error || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }

      const result = await readSetupSSE(res, (message) => {
        setLogs((prev) => [...prev, message]);
      });

      setStatus("done");
      markSetupDone(podId);
      onComplete?.();

      // Auto-close after 2 seconds on success
      autoCloseRef.current = setTimeout(() => {
        onOpenChange(false);
      }, 2000);

      if (result.message) {
        setLogs((prev) => [...prev, result.message]);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Ошибка настройки";
      setStatus("error");
      setErrorMsg(msg);
      setLogs((prev) => [...prev, `ERROR: ${msg}`]);
      onError?.(msg);
    }
  }, [podId, onComplete, onError, onOpenChange]);

  // Auto-start setup when dialog opens
  useEffect(() => {
    if (open && podId && !hasStartedRef.current) {
      hasStartedRef.current = true;
      runSetup();
    }
    if (!open) {
      hasStartedRef.current = false;
      if (autoCloseRef.current) {
        clearTimeout(autoCloseRef.current);
        autoCloseRef.current = null;
      }
    }
  }, [open, podId, runSetup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    };
  }, []);

  const handleRetry = () => {
    hasStartedRef.current = true;
    runSetup();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-popover text-popover-foreground max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Настройка пода
            {status === "running" && (
              <Badge variant="secondary" className="text-[10px]">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse mr-1" />
                Выполняется...
              </Badge>
            )}
            {status === "done" && (
              <Badge variant="default" className="text-[10px] bg-green-600">
                Готово!
              </Badge>
            )}
            {status === "error" && (
              <Badge variant="destructive" className="text-[10px]">
                Ошибка
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <SetupLogPanel
            logs={logs.length > 0 ? logs : ["Ожидание подключения к поду..."]}
            status={status === "done" ? "done" : status === "error" ? "error" : "running"}
          />

          {status === "error" && errorMsg && (
            <div className="space-y-2">
              <p className="text-xs text-red-400">{errorMsg}</p>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs gap-1"
                onClick={handleRetry}
              >
                <RefreshCw className="h-3 w-3" />
                Повторить
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
