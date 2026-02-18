"use client";

import { create } from "zustand";
import { PodInfo } from "@/lib/types";

interface PodState {
  pods: PodInfo[];
  isLoading: boolean;
  error: string | null;

  setPods: (pods: PodInfo[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const usePodStore = create<PodState>((set) => ({
  pods: [],
  isLoading: false,
  error: null,

  setPods: (pods) => set({ pods }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
