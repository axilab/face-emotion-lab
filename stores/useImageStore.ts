"use client";

import { create } from "zustand";
import { GenerationStep } from "@/lib/types";

interface ImageState {
  originalFile: File | null;
  originalPreviewUrl: string | null;
  croppedOriginalUrl: string | null;
  resultImageUrl: string | null;
  generationStep: GenerationStep;
  generationError: string | null;
  // Track what file+cropFactor the cropped original was generated for
  cropCacheKey: string | null;

  setOriginalFile: (file: File | null) => void;
  setCroppedOriginalUrl: (url: string | null) => void;
  setResultImageUrl: (url: string | null) => void;
  setGenerationStep: (step: GenerationStep) => void;
  setGenerationError: (error: string | null) => void;
  setCropCacheKey: (key: string | null) => void;
  reset: () => void;
}

export const useImageStore = create<ImageState>((set, get) => ({
  originalFile: null,
  originalPreviewUrl: null,
  croppedOriginalUrl: null,
  resultImageUrl: null,
  generationStep: "idle",
  generationError: null,
  cropCacheKey: null,

  setOriginalFile: (file) => {
    const prev = get().originalPreviewUrl;
    if (prev) URL.revokeObjectURL(prev);

    const prevCrop = get().croppedOriginalUrl;
    if (prevCrop) URL.revokeObjectURL(prevCrop);

    const prevResult = get().resultImageUrl;
    if (prevResult) URL.revokeObjectURL(prevResult);

    set({
      originalFile: file,
      originalPreviewUrl: file ? URL.createObjectURL(file) : null,
      croppedOriginalUrl: null,
      resultImageUrl: null,
      generationStep: "idle",
      generationError: null,
      cropCacheKey: null,
    });
  },

  setCroppedOriginalUrl: (url) => {
    const prev = get().croppedOriginalUrl;
    if (prev && prev !== url) URL.revokeObjectURL(prev);
    set({ croppedOriginalUrl: url });
  },

  setResultImageUrl: (url) => {
    const prev = get().resultImageUrl;
    if (prev && prev !== url) URL.revokeObjectURL(prev);
    set({ resultImageUrl: url });
  },

  setGenerationStep: (step) => set({ generationStep: step }),
  setGenerationError: (error) => set({ generationError: error, generationStep: error ? "error" : "idle" }),
  setCropCacheKey: (key) => set({ cropCacheKey: key }),

  reset: () => {
    const { originalPreviewUrl, croppedOriginalUrl, resultImageUrl } = get();
    if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl);
    if (croppedOriginalUrl) URL.revokeObjectURL(croppedOriginalUrl);
    if (resultImageUrl) URL.revokeObjectURL(resultImageUrl);
    set({
      originalFile: null,
      originalPreviewUrl: null,
      croppedOriginalUrl: null,
      resultImageUrl: null,
      generationStep: "idle",
      generationError: null,
      cropCacheKey: null,
    });
  },
}));
