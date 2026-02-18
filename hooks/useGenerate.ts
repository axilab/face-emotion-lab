"use client";

import { useCallback } from "react";
import { useImageStore } from "@/stores/useImageStore";
import { useExpressionStore } from "@/stores/useExpressionStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { buildWorkflow, scaleParams } from "@/lib/comfyui";
import { autoSetupPod, uploadImage, submitWorkflow, pollResult, downloadResult } from "@/lib/pipeline";
import { DEFAULT_EXPRESSION } from "@/lib/constants";
import { toast } from "sonner";

export function useGenerate() {
  const { podId } = useSettingsStore();
  const { params, cropFactor, intensity } = useExpressionStore();
  const {
    originalFile,
    cropCacheKey,
    setGenerationStep,
    setGenerationError,
    setCroppedOriginalUrl,
    setResultImageUrl,
    setCropCacheKey,
  } = useImageStore();

  return useCallback(async () => {
    if (!originalFile || !podId) return;

    setGenerationError(null);

    try {
      // Step 0: Setup pod via SSH (checks ComfyUI + installs ExpressionEditor if needed)
      setGenerationStep("installing_node");
      toast.info("Проверка готовности пода...");
      const setupOk = await autoSetupPod(podId);
      if (!setupOk) {
        throw new Error(
          "Настройка пода не удалась. ComfyUI или ExpressionEditor недоступен. " +
          "Проверьте в Настройках > Проверить соединение."
        );
      }

      // Step 1: Upload image
      setGenerationStep("uploading");
      const uploadedName = await uploadImage(originalFile, podId);

      // Step 2: Cropped original (if needed)
      const currentCropKey = `${originalFile.name}_${originalFile.size}_${cropFactor}`;
      if (cropCacheKey !== currentCropKey) {
        setGenerationStep("processing_crop");
        const cropWorkflow = buildWorkflow(
          uploadedName,
          { ...DEFAULT_EXPRESSION },
          cropFactor,
          `faceemotionlab_crop_${Date.now()}`
        );
        const cropPromptId = await submitWorkflow(cropWorkflow, podId);
        const cropImageInfo = await pollResult(cropPromptId, podId);
        const cropUrl = await downloadResult(cropImageInfo, podId);
        setCroppedOriginalUrl(cropUrl);
        setCropCacheKey(currentCropKey);
      }

      // Step 3: Apply intensity to params
      setGenerationStep("processing_emotion");
      const scaledParams = scaleParams(params, intensity);

      // Step 4: Submit emotion workflow
      const emotionWorkflow = buildWorkflow(
        uploadedName,
        scaledParams,
        cropFactor,
        `faceemotionlab_${Date.now()}`
      );
      const emotionPromptId = await submitWorkflow(emotionWorkflow, podId);

      // Step 5: Poll for result
      const emotionImageInfo = await pollResult(emotionPromptId, podId);

      // Step 6: Download result
      setGenerationStep("downloading");
      const resultUrl = await downloadResult(emotionImageInfo, podId);
      setResultImageUrl(resultUrl);

      setGenerationStep("complete");
      toast.success("Генерация завершена!");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Ошибка генерации";
      setGenerationError(message);
      toast.error(message);
    }
  }, [
    originalFile,
    podId,
    params,
    cropFactor,
    intensity,
    cropCacheKey,
    setGenerationStep,
    setGenerationError,
    setCroppedOriginalUrl,
    setResultImageUrl,
    setCropCacheKey,
  ]);
}
