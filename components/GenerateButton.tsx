"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { StartupLogDialog } from "@/components/StartupLogDialog";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { usePodStore } from "@/stores/usePodStore";
import { useBatchStore } from "@/stores/useBatchStore";
import { useGenerateImageStore } from "@/stores/useGenerateImageStore";
import { useBatchGenerate } from "@/hooks/useBatchGenerate";
import { useImageGenerate } from "@/hooks/useImageGenerate";
import { apiUrl } from "@/lib/constants";
import { Loader2, Sparkles, AlertCircle, XCircle, ArrowRight, Play } from "lucide-react";
import { toast } from "sonner";

export function GenerateButton() {
  const { podId, setPodId } = useSettingsStore();
  const { pods } = usePodStore();
  const { inputMode, files, selectedPresetIds, status: batchStatus, results, currentFileIndex } = useBatchStore();
  const { error: genError, generatedImages, selectedIds } = useGenerateImageStore();
  const { generate: batchGenerate, cancel: batchCancel } = useBatchGenerate();
  const { useForEmotions } = useImageGenerate();

  const [startupDialogOpen, setStartupDialogOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startingPodId, setStartingPodId] = useState(podId);
  const pendingGenerateRef = useRef(false);

  const currentPod = pods.find((p) => p.id === podId);
  const podRunning = currentPod?.desiredStatus === "RUNNING";

  const startPodAndGenerate = useCallback(async () => {
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
        setPodId(data.startedPodId);
        setStartingPodId(data.startedPodId);
        const fallbackPod = pods.find((p: { id: string }) => p.id === data.startedPodId);
        const fallbackName = fallbackPod?.name || data.startedPodId.slice(0, 8);
        toast.info(`GPU недоступен. Запущен другой под: ${fallbackName}`);
      } else {
        setStartingPodId(podId);
      }

      // Mark that we want to auto-generate after setup
      pendingGenerateRef.current = true;
      setStartupDialogOpen(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Не удалось запустить под";
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  }, [podId, setPodId, pods]);

  const handleSetupComplete = useCallback(() => {
    if (pendingGenerateRef.current) {
      pendingGenerateRef.current = false;
      // Small delay to let dialog auto-close and pod status update
      setTimeout(() => {
        batchGenerate();
      }, 500);
    }
  }, [batchGenerate]);

  const handleSetupError = useCallback(() => {
    pendingGenerateRef.current = false;
  }, []);

  // Generate mode (Gemini)
  if (inputMode === "generate") {
    const hasImages = generatedImages.length > 0;

    if (!hasImages) return null;

    return (
      <div className="space-y-2">
        <Button
          className="w-full h-11 gap-2 text-sm font-medium"
          onClick={useForEmotions}
        >
          <ArrowRight className="h-4 w-4" />
          Использовать для эмоций
          {selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
        </Button>

        {genError && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-2">
            <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-red-400 leading-relaxed">{genError}</p>
          </div>
        )}
      </div>
    );
  }

  // Batch mode
  const isBatchRunning = batchStatus === "running";
  const fileCount = files.length;
  const isPresetMode = selectedPresetIds.length > 0;
  // Each file produces: 1 normal + N emotions (or 1 from params)
  const emotionsPerFile = isPresetMode ? selectedPresetIds.length : 1;
  const totalItems = fileCount * (1 + emotionsPerFile); // +1 for normal
  const completedCount = results.filter((r) => r.status === "complete" || r.status === "error").length;

  const disabled = !files.length || !podId || isBatchRunning || starting;

  const handleGenerate = () => {
    if (!podRunning) {
      // Pod is not running — start it first, then auto-generate after setup
      startPodAndGenerate();
    } else {
      batchGenerate();
    }
  };

  const currentFile = files[currentFileIndex] ?? null;
  const currentResult = results.find(
    (r) =>
      (currentFile ? r.fileId === currentFile.id : true) &&
      r.status !== "complete" &&
      r.status !== "error"
  );

  // Button label
  let buttonLabel = "Генерировать";
  if (fileCount > 0) {
    if (isPresetMode) {
      buttonLabel = `Генерировать (${totalItems} фото)`;
    } else {
      buttonLabel = `Генерировать по параметрам (${totalItems} фото)`;
    }
  }

  // Show pod start hint on button when pod is not running
  const needsStart = podId && !podRunning && !isBatchRunning && !starting;

  return (
    <>
      <div className="space-y-2">
        {isBatchRunning ? (
          <div className="flex gap-2">
            <Button
              className="flex-1 h-11 gap-2 text-sm font-medium"
              disabled
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="truncate">
                {completedCount}/{totalItems}
                {currentResult
                  ? ` — ${currentResult.presetName}`
                  : ""}
              </span>
            </Button>
            <Button
              variant="destructive"
              className="h-11 px-3"
              onClick={batchCancel}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            className="w-full h-11 gap-2 text-sm font-medium"
            disabled={disabled}
            onClick={handleGenerate}
          >
            {starting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : needsStart ? (
              <Play className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {starting ? "Запуск пода..." : buttonLabel}
          </Button>
        )}

        {!podId && (
          <p className="text-[11px] text-muted-foreground text-center">
            Выберите под в шапке страницы
          </p>
        )}
        {needsStart && !!files.length && (
          <p className="text-[11px] text-muted-foreground text-center">
            Под будет запущен автоматически
          </p>
        )}
        {!files.length && (
          <p className="text-[11px] text-muted-foreground text-center">
            Загрузите изображения
          </p>
        )}
      </div>

      <StartupLogDialog
        open={startupDialogOpen}
        onOpenChange={setStartupDialogOpen}
        podId={startingPodId}
        onComplete={handleSetupComplete}
        onError={handleSetupError}
      />
    </>
  );
}
