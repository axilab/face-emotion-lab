"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  podId: string;
  podName: string;
  gpuType: string;
  setPodId: (id: string) => void;
  setPodName: (name: string) => void;
  setGpuType: (type: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      podId: "",
      podName: "emotion-gen",
      gpuType: "NVIDIA RTX 4000 Ada Generation",
      setPodId: (id) => set({ podId: id }),
      setPodName: (name) => set({ podName: name }),
      setGpuType: (type) => set({ gpuType: type }),
    }),
    { name: "fel-settings" }
  )
);
