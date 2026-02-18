"use client";

import { useCallback, useRef } from "react";
import { useBatchStore } from "@/stores/useBatchStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useExpressionStore } from "@/stores/useExpressionStore";
import { autoSetupPod, uploadImage, submitWorkflow, pollResult, downloadResult, freeComfyMemory, generationDelay } from "@/lib/pipeline";
import { buildWorkflow, scaleParams } from "@/lib/comfyui";
import { DEFAULT_EXPRESSION, EKMAN_PRESETS } from "@/lib/constants";
import { BatchResult, EmotionPreset, ExpressionParams } from "@/lib/types";
import { toast } from "sonner";

interface GenerationItem {
  id: string;
  name: string;
  params: ExpressionParams;
}

export function useBatchGenerate() {
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async () => {
    const { podId } = useSettingsStore.getState();
    const { cropFactor, intensity, params: currentParams, customPresets } = useExpressionStore.getState();
    const store = useBatchStore.getState();
    const { files, selectedPresetIds } = store;

    if (!files.length || !podId) return;

    // Determine generation items: presets or current params
    const isPresetMode = selectedPresetIds.length > 0;
    const items: GenerationItem[] = [];

    if (isPresetMode) {
      const allPresets: EmotionPreset[] = [...EKMAN_PRESETS, ...customPresets];
      const selectedPresets = allPresets.filter((p) => selectedPresetIds.includes(p.id));
      for (const preset of selectedPresets) {
        const merged = { ...DEFAULT_EXPRESSION, ...preset.params };
        items.push({ id: preset.id, name: preset.name, params: merged });
      }
    } else {
      // Params mode: single generation per file using current slider values
      items.push({ id: "custom_params", name: "параметры", params: { ...currentParams } });
    }

    if (!items.length) return;

    // Init results: normal (cropped base) + each generation item
    const pendingResults: BatchResult[] = [];
    for (const file of files) {
      pendingResults.push({
        id: `${file.id}_normal`,
        fileId: file.id,
        presetId: "normal",
        presetName: "normal",
        originalFileName: file.displayName,
        status: "pending",
        resultUrl: null,
        error: null,
      });
      for (const item of items) {
        pendingResults.push({
          id: `${file.id}_${item.id}`,
          fileId: file.id,
          presetId: item.id,
          presetName: item.name,
          originalFileName: file.displayName,
          status: "pending",
          resultUrl: null,
          error: null,
        });
      }
    }

    useBatchStore.getState().initResults(pendingResults);
    useBatchStore.getState().setStatus("running");

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      // Step 0: Setup pod
      toast.info("Проверка готовности пода...");
      const setupOk = await autoSetupPod(podId);
      if (!setupOk) {
        throw new Error("Настройка пода не удалась.");
      }

      // Process each file
      let generationCount = 0;
      for (let fi = 0; fi < files.length; fi++) {
        if (abort.signal.aborted) break;

        const file = files[fi];
        useBatchStore.getState().setCurrentIndices(fi, 0);

        // Upload (reuse if already uploaded)
        let uploadedName = file.uploadedName;
        if (!uploadedName) {
          // Mark all results for this file as uploading (including normal)
          useBatchStore.getState().updateResult(`${file.id}_normal`, { status: "uploading" });
          for (const item of items) {
            useBatchStore.getState().updateResult(`${file.id}_${item.id}`, { status: "uploading" });
          }
          uploadedName = await uploadImage(file.file, podId);
          useBatchStore.getState().updateFileUploadedName(file.id, uploadedName);
        }

        // Crop (reuse if cache key matches)
        const currentCropKey = `${file.file.name}_${file.file.size}_${cropFactor}`;
        const latestFile = useBatchStore.getState().files.find((f) => f.id === file.id);
        if (latestFile?.cropCacheKey !== currentCropKey) {
          // Mark as cropping (including normal)
          useBatchStore.getState().updateResult(`${file.id}_normal`, { status: "cropping" });
          for (const item of items) {
            useBatchStore.getState().updateResult(`${file.id}_${item.id}`, { status: "cropping" });
          }
          try {
            const cropWorkflow = buildWorkflow(
              uploadedName,
              { ...DEFAULT_EXPRESSION },
              cropFactor,
              `faceemotionlab_crop_${Date.now()}`
            );
            const cropPromptId = await submitWorkflow(cropWorkflow, podId);
            const cropImageInfo = await pollResult(cropPromptId, podId);
            const cropUrl = await downloadResult(cropImageInfo, podId);
            useBatchStore.getState().updateFileCroppedUrl(file.id, cropUrl, currentCropKey);
            // Mark "normal" result as complete with the cropped URL
            useBatchStore.getState().updateResult(`${file.id}_normal`, {
              status: "complete",
              resultUrl: cropUrl,
            });
            // Free memory after crop to start emotion generation with clean state
            await freeComfyMemory(podId);
          } catch (cropError) {
            // Mark ALL results for this file as error (including normal), skip to next file
            const errMsg = cropError instanceof Error ? cropError.message : "Ошибка обрезки";
            useBatchStore.getState().updateResult(`${file.id}_normal`, { status: "error", error: errMsg });
            for (const item of items) {
              useBatchStore.getState().updateResult(`${file.id}_${item.id}`, {
                status: "error",
                error: errMsg,
              });
            }
            continue;
          }
        } else {
          // Crop was cached — mark normal as complete with existing URL
          const cachedCropUrl = latestFile?.croppedUrl;
          if (cachedCropUrl) {
            useBatchStore.getState().updateResult(`${file.id}_normal`, {
              status: "complete",
              resultUrl: cachedCropUrl,
            });
          }
        }

        // Process each generation item
        for (let pi = 0; pi < items.length; pi++) {
          if (abort.signal.aborted) break;

          const item = items[pi];
          const resultId = `${file.id}_${item.id}`;
          useBatchStore.getState().setCurrentIndices(fi, pi);
          useBatchStore.getState().updateResult(resultId, { status: "processing" });

          try {
            const scaledParams = scaleParams(item.params, intensity);
            const workflow = buildWorkflow(
              uploadedName,
              scaledParams,
              cropFactor,
              `faceemotionlab_${Date.now()}`
            );
            const promptId = await submitWorkflow(workflow, podId);
            const imageInfo = await pollResult(promptId, podId);

            useBatchStore.getState().updateResult(resultId, { status: "downloading" });
            const resultUrl = await downloadResult(imageInfo, podId);
            useBatchStore.getState().updateResult(resultId, { status: "complete", resultUrl });
            generationCount++;

            // Free ComfyUI memory every 3 generations to prevent OOM
            if (generationCount % 3 === 0) {
              await freeComfyMemory(podId);
            }

            // Small delay between generations to let ComfyUI breathe
            await generationDelay(1000);
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : "Ошибка генерации";
            useBatchStore.getState().updateResult(resultId, { status: "error", error: errMsg });
          }
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Ошибка";
      toast.error(message);
    }

    // Final status
    const finalResults = useBatchStore.getState().results;
    const completed = finalResults.filter((r) => r.status === "complete").length;
    const errors = finalResults.filter((r) => r.status === "error").length;
    const total = finalResults.length;

    if (abort.signal.aborted) {
      useBatchStore.getState().setStatus("cancelled");
      toast.info(`Отменено. Готово: ${completed} из ${total}`);
    } else {
      useBatchStore.getState().setStatus("complete");
      if (errors > 0) {
        toast.error(`Завершено с ошибками: ${completed} успешно, ${errors} ошибок`);
      } else {
        toast.success(`Готово: ${completed} из ${total}`);
      }
    }

    abortRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    useBatchStore.getState().setStatus("cancelled");
  }, []);

  return { generate, cancel };
}
