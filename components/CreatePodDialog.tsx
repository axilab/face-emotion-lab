"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { GpuOption } from "@/lib/types";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function CreatePodDialog() {
  const { podName, gpuType, setPodId, setGpuType } = useSettingsStore();
  const { setLoading } = usePodStore();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [localPodName, setLocalPodName] = useState(podName);
  const [startupDialogOpen, setStartupDialogOpen] = useState(false);
  const [newPodId, setNewPodId] = useState("");

  const [gpuOptions, setGpuOptions] = useState<GpuOption[]>([]);
  const [gpuLoading, setGpuLoading] = useState(false);

  // Fetch GPU types when dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setGpuLoading(true);
    fetch(apiUrl("/api/pod/gpu-types"))
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.gpuTypes) {
          setGpuOptions(data.gpuTypes);
          // Auto-select first if current selection is not in the list
          if (data.gpuTypes.length && !data.gpuTypes.some((g: GpuOption) => g.id === gpuType)) {
            setGpuType(data.gpuTypes[0].id);
          }
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("Не удалось загрузить список GPU");
      })
      .finally(() => {
        if (!cancelled) setGpuLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, gpuType, setGpuType]);

  const handleCreate = async () => {
    setCreating(true);
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/pod/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ podName: localPodName, gpuType }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const createdPodId = data.pod.id;
      setPodId(createdPodId);
      setNewPodId(createdPodId);
      toast.success(`Под создан: ${createdPodId}`);

      // Close create dialog, open startup log
      setOpen(false);
      setStartupDialogOpen(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Не удалось создать под";
      toast.error(msg);
    } finally {
      setCreating(false);
      setLoading(false);
    }
  };

  const formatPrice = (gpu: GpuOption): string => {
    const price = gpu.lowestPrice ?? gpu.communityPrice ?? gpu.securePrice;
    if (price === null) return "цена неизвестна";
    return `$${price.toFixed(2)}/ч`;
  };

  const formatAvailability = (gpu: GpuOption): string => {
    if (gpu.communityCloud && gpu.secureCloud) return "Доступен";
    if (gpu.communityCloud) return "Community";
    if (gpu.secureCloud) return "Secure";
    return "Недоступен";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs gap-1"
          >
            <Plus className="h-3 w-3" />
            Создать под
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm bg-popover text-popover-foreground">
          <DialogHeader>
            <DialogTitle>Создать под</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Имя пода</Label>
              <Input
                className="h-8 text-xs"
                value={localPodName}
                onChange={(e) => setLocalPodName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">GPU</Label>
              {gpuLoading ? (
                <div className="flex items-center gap-2 h-8 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Загрузка списка GPU...
                </div>
              ) : (
                <Select value={gpuType} onValueChange={setGpuType}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Выберите GPU" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {gpuOptions.map((gpu) => {
                      const available = gpu.communityCloud || gpu.secureCloud;
                      return (
                        <SelectItem
                          key={gpu.id}
                          value={gpu.id}
                          disabled={!available}
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                available ? "bg-green-500" : "bg-red-500"
                              }`}
                            />
                            <span>{gpu.displayName}</span>
                            <span className="text-muted-foreground">
                              {gpu.memoryInGb}GB
                            </span>
                            <span className="text-muted-foreground">
                              {formatPrice(gpu)}
                            </span>
                            {!available && (
                              <span className="text-destructive text-[10px]">
                                {formatAvailability(gpu)}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Button
              variant="default"
              size="sm"
              className="w-full h-8 text-xs gap-1"
              onClick={handleCreate}
              disabled={creating || !localPodName.trim() || !gpuType || gpuLoading}
            >
              {creating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              Создать
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <StartupLogDialog
        open={startupDialogOpen}
        onOpenChange={setStartupDialogOpen}
        podId={newPodId}
      />
    </>
  );
}
