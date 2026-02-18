"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsDialog } from "@/components/SettingsDialog";
import { StartupLogDialog } from "@/components/StartupLogDialog";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { usePodStore } from "@/stores/usePodStore";
import { useIdleTimer } from "@/hooks/useIdleTimer";
import { apiUrl } from "@/lib/constants";
import { Menu, Play, Square, Loader2, LogOut, Timer, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function Header({ sidebarOpen, onToggleSidebar }: HeaderProps) {
  const { podId, setPodId } = useSettingsStore();
  const { pods, setLoading } = usePodStore();
  const [startupDialogOpen, setStartupDialogOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  const currentPod = pods.find((p) => p.id === podId);
  const status = currentPod?.desiredStatus;
  const isRunning = status === "RUNNING";

  const { remainingMs, extend } = useIdleTimer(podId, isRunning);

  const [startingPodId, setStartingPodId] = useState(podId);

  const handleStart = async () => {
    if (!podId) return;
    setStarting(true);
    try {
      const res = await fetch(apiUrl("/api/pod/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ podId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // If fallback pod was started, switch to it
      if (data.fallback && data.startedPodId && data.startedPodId !== podId) {
        const fallbackPod = pods.find((p) => p.id === data.startedPodId);
        const fallbackName = fallbackPod?.name || data.startedPodId.slice(0, 8);
        setPodId(data.startedPodId);
        setStartingPodId(data.startedPodId);
        toast.info(`GPU недоступен. Запущен другой под: ${fallbackName}`);
      } else {
        setStartingPodId(podId);
      }
      setStartupDialogOpen(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Не удалось запустить под";
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    if (!podId) return;
    setStopping(true);
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/pod/stop"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ podId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Под останавливается...");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Не удалось остановить под";
      toast.error(msg);
    } finally {
      setStopping(false);
      setLoading(false);
    }
  };

  return (
    <>
      <header className="flex items-center justify-between px-4 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleSidebar}
            title={sidebarOpen ? "Свернуть панель" : "Развернуть панель"}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <h1 className="text-base font-semibold tracking-tight">FaceEmotionLab</h1>

          {isRunning ? (
            /* Pod is running: show badge + stop button */
            <div className="flex items-center gap-1.5">
              <Badge variant="default" className="text-[10px] h-5">
                {currentPod?.name || podId.slice(0, 8)} — RUNNING
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleStop}
                disabled={stopping}
                title="Остановить под"
              >
                {stopping ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          ) : (
            /* Pod is not running: show selector + start + create */
            <div className="flex items-center gap-1.5">
              {pods.length > 0 ? (
                <Select value={podId} onValueChange={setPodId}>
                  <SelectTrigger className="h-7 text-[11px] w-auto min-w-[160px] max-w-[260px]">
                    <SelectValue placeholder="Выберите под" />
                  </SelectTrigger>
                  <SelectContent>
                    {pods.map((pod) => (
                      <SelectItem key={pod.id} value={pod.id}>
                        <div className="flex items-center gap-1">
                          {pod.gpuAvailable != null && (
                            <span
                              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                pod.gpuAvailable ? "bg-green-500" : "bg-red-500"
                              }`}
                            />
                          )}
                          <span className="text-xs">{pod.name}</span>
                          {pod.machine?.gpuDisplayName && (
                            <span className="text-[10px] text-muted-foreground">
                              {pod.machine.gpuDisplayName}
                            </span>
                          )}
                          {pod.costPerHr != null && (
                            <span className="text-[10px] text-muted-foreground">
                              ${pod.costPerHr.toFixed(2)}/ч
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-xs text-muted-foreground">Нет подов</span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleStart}
                disabled={starting || !podId}
                title="Запустить под"
              >
                {starting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {remainingMs !== null && (
            <div className="flex items-center gap-1">
              <Timer className="h-3 w-3 text-muted-foreground" />
              <span
                className={cn(
                  "text-xs tabular-nums",
                  remainingMs < 60_000 ? "text-destructive" : "text-muted-foreground"
                )}
              >
                {formatCountdown(remainingMs)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                disabled={remainingMs > 5 * 60 * 1000}
                onClick={extend}
                title="+15 минут"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          )}
          <SettingsDialog />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Выйти"
            onClick={async () => {
              await fetch(apiUrl("/api/auth/logout"), { method: "POST" });
              const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
              window.location.href = `${basePath}/login`;
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <StartupLogDialog
        open={startupDialogOpen}
        onOpenChange={setStartupDialogOpen}
        podId={startingPodId}
      />
    </>
  );
}
