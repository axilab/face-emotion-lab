"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { GeneratedImage, PromptPreset } from "@/lib/types";

type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
type GenStatus = "idle" | "generating" | "done" | "error";

interface GenerateImageState {
  prompt: string;
  aspectRatio: AspectRatio;
  quantity: number;
  status: GenStatus;
  error: string | null;
  generatedImages: GeneratedImage[];
  selectedIds: string[];
  customPromptPresets: PromptPreset[];

  setPrompt: (prompt: string) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
  setQuantity: (n: number) => void;
  setStatus: (status: GenStatus) => void;
  setError: (error: string | null) => void;
  addGeneratedImage: (base64: string, mimeType: string) => void;
  clearGeneratedImages: () => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  removeSelected: () => void;
  saveCustomPreset: (name: string) => void;
  deleteCustomPreset: (id: string) => void;
  loadPreset: (preset: PromptPreset) => void;
  reset: () => void;
}

export const useGenerateImageStore = create<GenerateImageState>()(
  persist(
    (set, get) => ({
      prompt: "",
      aspectRatio: "1:1",
      quantity: 1,
      status: "idle",
      error: null,
      generatedImages: [],
      selectedIds: [],
      customPromptPresets: [],

      setPrompt: (prompt) => set({ prompt }),
      setAspectRatio: (aspectRatio) => set({ aspectRatio }),
      setQuantity: (quantity) => set({ quantity }),
      setStatus: (status) => set({ status }),
      setError: (error) => set({ error, status: error ? "error" : "idle" }),

      addGeneratedImage: (base64, mimeType) => {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const image: GeneratedImage = {
          id: crypto.randomUUID(),
          url,
          base64,
          mimeType,
        };

        set((state) => ({
          generatedImages: [...state.generatedImages, image],
        }));
      },

      clearGeneratedImages: () => {
        const { generatedImages } = get();
        for (const img of generatedImages) URL.revokeObjectURL(img.url);
        set({ generatedImages: [], selectedIds: [], status: "idle", error: null });
      },

      toggleSelect: (id) => {
        const { selectedIds } = get();
        if (selectedIds.includes(id)) {
          set({ selectedIds: selectedIds.filter((sid) => sid !== id) });
        } else {
          set({ selectedIds: [...selectedIds, id] });
        }
      },

      selectAll: () => {
        set((state) => ({
          selectedIds: state.generatedImages.map((img) => img.id),
        }));
      },

      clearSelection: () => set({ selectedIds: [] }),

      removeSelected: () => {
        const { generatedImages, selectedIds } = get();
        for (const img of generatedImages) {
          if (selectedIds.includes(img.id)) URL.revokeObjectURL(img.url);
        }
        set({
          generatedImages: generatedImages.filter((img) => !selectedIds.includes(img.id)),
          selectedIds: [],
        });
      },

      saveCustomPreset: (name) => {
        const { prompt, customPromptPresets } = get();
        if (!prompt.trim()) return;
        const preset: PromptPreset = {
          id: `custom_${Date.now()}`,
          name,
          prompt: prompt.trim(),
        };
        set({ customPromptPresets: [...customPromptPresets, preset] });
      },

      deleteCustomPreset: (id) => {
        set({ customPromptPresets: get().customPromptPresets.filter((p) => p.id !== id) });
      },

      loadPreset: (preset) => set({ prompt: preset.prompt }),

      reset: () => {
        const { generatedImages } = get();
        for (const img of generatedImages) URL.revokeObjectURL(img.url);
        set({
          prompt: "",
          status: "idle",
          error: null,
          generatedImages: [],
          selectedIds: [],
        });
      },
    }),
    {
      name: "fel-generate-image",
      partialize: (state) => ({
        customPromptPresets: state.customPromptPresets,
        aspectRatio: state.aspectRatio,
        quantity: state.quantity,
      }),
    }
  )
);
