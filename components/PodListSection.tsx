"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StartupLogDialog } from "@/components/StartupLogDialog";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { usePodStore } from "@/stores/usePodStore";
import { apiUrl } from "@/lib/constants";
import { Play, Square, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function PodListSection() {
  const { podId, setPodId } = useSettingsStore();
  const { pods, isLoading, setPods, setLoading, setError } = usePodStore();
  const [startupDialogOpen, setStartupDialogOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const currentPod = pods.find((p) => p.id === podId);
  const status = currentPod?.desiredStatus || "NONE";

  const statusColor =
    status === "RUNNING"
      ? "bg-green-500"
      : status === "EXITED"
        ? "bg-yellow-500"
        : "bg-red-500";

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(apiUrl("/api/pod/list"));
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const podList = data.pods || [];
      setPods(podList);
      toast.success(`Подов: ${podList.length}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Ошибка загрузки";
      setError(msg);
      toast.error(msg);
    } finally {
      setRefreshing(false);
    }
  };

  const handleStart = async () => {
    if (!podId) return;
    setStarting(true);
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/pod/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ podId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStartupDialogOpen(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Не удалось запустить под";
      toast.error(msg);
    } finally {
      setStarting(false);
      setLoading(false);
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
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Под</span>
          <div className={`h-2 w-2 rounded-full ${statusColor}`} />
          <span className="text-xs text-muted-foreground">{status}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 ml-auto"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Обновить список"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {pods.length > 0 && (
          <Select value={podId} onValueChange={setPodId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Выберите под" />
            </SelectTrigger>
            <SelectContent>
              {pods.map((pod) => (
                <SelectItem key={pod.id} value={pod.id}>
                  <div className="flex items-center gap-2">
                    <span>{pod.name}</span>
                    {pod.machine?.gpuDisplayName && (
                      <span className="text-muted-foreground text-[10px]">
                        {pod.machine.gpuDisplayName}
                      </span>
                    )}
                    <Badge variant="outline" className="text-[10px] h-4">
                      {pod.desiredStatus}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-7 text-xs gap-1"
            onClick={handleStart}
            disabled={isLoading || starting || !podId || status === "RUNNING"}
          >
            {starting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Запустить
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-7 text-xs gap-1"
            onClick={handleStop}
            disabled={isLoading || stopping || !podId || status !== "RUNNING"}
          >
            {stopping ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
            Остановить
          </Button>
        </div>
      </div>

      <StartupLogDialog
        open={startupDialogOpen}
        onOpenChange={setStartupDialogOpen}
        podId={podId}
      />
    </>
  );
}
