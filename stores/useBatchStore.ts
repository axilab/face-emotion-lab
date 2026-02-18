"use client";

import { create } from "zustand";
import { BatchFile, BatchResult, BatchStatus, InputMode } from "@/lib/types";
import { MAX_FILE_SIZE_MB } from "@/lib/constants";

interface BatchState {
  inputMode: InputMode;
  files: BatchFile[];
  selectedPresetIds: string[];
  status: BatchStatus;
  currentFileIndex: number;
  currentPresetIndex: number;
  results: BatchResult[];

  setInputMode: (mode: InputMode) => void;
  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  togglePreset: (presetId: string) => void;
  selectAllPresets: (ids: string[]) => void;
  clearPresets: () => void;
  setStatus: (s: BatchStatus) => void;
  setCurrentIndices: (fi: number, pi: number) => void;
  updateFileUploadedName: (fileId: string, name: string) => void;
  updateFileCroppedUrl: (fileId: string, url: string, cacheKey: string) => void;
  initResults: (results: BatchResult[]) => void;
  updateResult: (id: string, patch: Partial<BatchResult>) => void;
  resetBatch: () => void;
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

function deduplicateName(name: string, existing: string[]): string {
  if (!existing.includes(name)) return name;
  let i = 2;
  while (existing.includes(`${name}_${i}`)) i++;
  return `${name}_${i}`;
}

export const useBatchStore = create<BatchState>((set, get) => ({
  inputMode: "generate",
  files: [],
  selectedPresetIds: [],
  status: "idle",
  currentFileIndex: 0,
  currentPresetIndex: 0,
  results: [],

  setInputMode: (mode) => set({ inputMode: mode }),

  addFiles: (newFiles) => {
    const state = get();
    const existingNames = state.files.map((f) => f.displayName);
    const validFiles: BatchFile[] = [];

    for (const file of newFiles) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) continue;

      const baseName = stripExtension(file.name);
      const displayName = deduplicateName(baseName, [
        ...existingNames,
        ...validFiles.map((f) => f.displayName),
      ]);

      validFiles.push({
        id: crypto.randomUUID(),
        file,
        displayName,
        previewUrl: URL.createObjectURL(file),
        uploadedName: null,
        croppedUrl: null,
        cropCacheKey: null,
      });
    }

    set({ files: [...state.files, ...validFiles] });
  },

  removeFile: (id) => {
    const state = get();
    const file = state.files.find((f) => f.id === id);
    if (file) {
      URL.revokeObjectURL(file.previewUrl);
      if (file.croppedUrl) URL.revokeObjectURL(file.croppedUrl);
    }
    // Also remove related results
    const relatedResults = state.results.filter((r) => r.fileId === id);
    for (const r of relatedResults) {
      if (r.resultUrl) URL.revokeObjectURL(r.resultUrl);
    }
    set({
      files: state.files.filter((f) => f.id !== id),
      results: state.results.filter((r) => r.fileId !== id),
    });
  },

  clearFiles: () => {
    const state = get();
    for (const f of state.files) {
      URL.revokeObjectURL(f.previewUrl);
      if (f.croppedUrl) URL.revokeObjectURL(f.croppedUrl);
    }
    for (const r of state.results) {
      if (r.resultUrl) URL.revokeObjectURL(r.resultUrl);
    }
    set({ files: [], results: [] });
  },

  togglePreset: (presetId) => {
    const { selectedPresetIds } = get();
    if (selectedPresetIds.includes(presetId)) {
      set({ selectedPresetIds: selectedPresetIds.filter((id) => id !== presetId) });
    } else {
      set({ selectedPresetIds: [...selectedPresetIds, presetId] });
    }
  },

  selectAllPresets: (ids) => set({ selectedPresetIds: ids }),
  clearPresets: () => set({ selectedPresetIds: [] }),

  setStatus: (s) => set({ status: s }),
  setCurrentIndices: (fi, pi) => set({ currentFileIndex: fi, currentPresetIndex: pi }),

  updateFileUploadedName: (fileId, name) => {
    set((state) => ({
      files: state.files.map((f) =>
        f.id === fileId ? { ...f, uploadedName: name } : f
      ),
    }));
  },

  updateFileCroppedUrl: (fileId, url, cacheKey) => {
    set((state) => ({
      files: state.files.map((f) => {
        if (f.id !== fileId) return f;
        if (f.croppedUrl) URL.revokeObjectURL(f.croppedUrl);
        return { ...f, croppedUrl: url, cropCacheKey: cacheKey };
      }),
    }));
  },

  initResults: (results) => {
    const state = get();
    // Collect crop URLs still referenced by files — don't revoke them
    const activeCropUrls = new Set(
      state.files.map((f) => f.croppedUrl).filter(Boolean)
    );
    // Revoke old result URLs (but not ones still used as cached crops)
    for (const r of state.results) {
      if (r.resultUrl && !activeCropUrls.has(r.resultUrl)) {
        URL.revokeObjectURL(r.resultUrl);
      }
    }
    set({ results });
  },

  updateResult: (id, patch) => {
    set((state) => ({
      results: state.results.map((r) =>
        r.id === id ? { ...r, ...patch } : r
      ),
    }));
  },

  resetBatch: () => {
    const state = get();
    for (const f of state.files) {
      URL.revokeObjectURL(f.previewUrl);
      if (f.croppedUrl) URL.revokeObjectURL(f.croppedUrl);
    }
    for (const r of state.results) {
      if (r.resultUrl) URL.revokeObjectURL(r.resultUrl);
    }
    set({
      files: [],
      selectedPresetIds: [],
      status: "idle",
      currentFileIndex: 0,
      currentPresetIndex: 0,
      results: [],
    });
  },
}));
