"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ExpressionParams, ExpressionKey, EmotionPreset } from "@/lib/types";
import { DEFAULT_EXPRESSION, CROP_FACTOR_CONFIG, INTENSITY_CONFIG } from "@/lib/constants";

interface ExpressionState {
  params: ExpressionParams;
  cropFactor: number;
  intensity: number;
  activePresetId: string | null;
  customPresets: EmotionPreset[];

  setParam: (key: ExpressionKey, value: number) => void;
  setParams: (params: ExpressionParams) => void;
  setCropFactor: (value: number) => void;
  setIntensity: (value: number) => void;
  resetAll: () => void;
  applyPreset: (preset: EmotionPreset) => void;
  saveCustomPreset: (name: string) => void;
  deleteCustomPreset: (id: string) => void;
}

export const useExpressionStore = create<ExpressionState>()(
  persist(
    (set, get) => ({
      params: { ...DEFAULT_EXPRESSION },
      cropFactor: CROP_FACTOR_CONFIG.default,
      intensity: INTENSITY_CONFIG.default,
      activePresetId: null,
      customPresets: [],

      setParam: (key, value) =>
        set((state) => ({
          params: { ...state.params, [key]: value },
          activePresetId: null,
        })),

      setParams: (params) => set({ params, activePresetId: null }),

      setCropFactor: (value) => set({ cropFactor: value }),

      setIntensity: (value) => set({ intensity: value }),

      resetAll: () =>
        set({
          params: { ...DEFAULT_EXPRESSION },
          intensity: INTENSITY_CONFIG.default,
          activePresetId: null,
        }),

      applyPreset: (preset) => {
        const newParams = { ...DEFAULT_EXPRESSION };
        for (const [key, value] of Object.entries(preset.params)) {
          newParams[key as ExpressionKey] = value as number;
        }
        set({ params: newParams, activePresetId: preset.id });
      },

      saveCustomPreset: (name) => {
        const { params, customPresets } = get();
        const id = `custom_${Date.now()}`;
        const nonZeroParams: Partial<ExpressionParams> = {};
        for (const [key, value] of Object.entries(params)) {
          if (value !== 0) nonZeroParams[key as ExpressionKey] = value;
        }
        set({
          customPresets: [
            ...customPresets,
            { id, name, emoji: "🎭", params: nonZeroParams },
          ],
        });
      },

      deleteCustomPreset: (id) =>
        set((state) => ({
          customPresets: state.customPresets.filter((p) => p.id !== id),
          activePresetId: state.activePresetId === id ? null : state.activePresetId,
        })),
    }),
    {
      name: "fel-expression",
      partialize: (state) => ({
        customPresets: state.customPresets,
        cropFactor: state.cropFactor,
      }),
    }
  )
);
