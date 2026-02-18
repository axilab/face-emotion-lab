"use client";

import { useCallback } from "react";
import { useGenerateImageStore } from "@/stores/useGenerateImageStore";
import { useBatchStore } from "@/stores/useBatchStore";
import { apiUrl } from "@/lib/constants";
import { toast } from "sonner";

export function useImageGenerate() {
  const generate = useCallback(async () => {
    const { prompt, aspectRatio, quantity } =
      useGenerateImageStore.getState();

    if (!prompt.trim()) {
      toast.error("Введите промпт для генерации");
      return;
    }

    useGenerateImageStore.getState().clearGeneratedImages();
    useGenerateImageStore.getState().setStatus("generating");

    try {
      for (let i = 0; i < quantity; i++) {
        const res = await fetch(apiUrl("/api/imagen/generate"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt.trim(), aspectRatio }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Ошибка ${res.status}`);
        }

        useGenerateImageStore.getState().addGeneratedImage(data.base64, data.mimeType);
      }

      useGenerateImageStore.getState().setStatus("done");
      const count = useGenerateImageStore.getState().generatedImages.length;
      toast.success(count === 1 ? "Портрет сгенерирован!" : `Сгенерировано ${count} портретов!`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка генерации";
      useGenerateImageStore.getState().setError(msg);
      toast.error(msg);
    }
  }, []);

  const useForEmotions = useCallback(() => {
    const { generatedImages, selectedIds } =
      useGenerateImageStore.getState();
    if (!generatedImages.length) return;

    // Use selected images, or all if nothing selected
    const targetImages = selectedIds.length > 0
      ? generatedImages.filter((img) => selectedIds.includes(img.id))
      : generatedImages;

    if (!targetImages.length) return;

    const files: File[] = targetImages.map((img, idx) => {
      const binary = atob(img.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: img.mimeType });
      const ext = img.mimeType.includes("png") ? "png" : "jpg";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      return new File([blob], `portrait_${timestamp}_${idx + 1}.${ext}`, { type: img.mimeType });
    });

    const store = useBatchStore.getState();
    store.addFiles(files);
    store.setInputMode("batch");
    const word = files.length === 1 ? "Фото добавлено" : `${files.length} фото добавлены`;
    toast.success(`${word} в обработку. Выберите эмоции и нажмите Генерировать.`);
  }, []);

  return { generate, useForEmotions };
}
