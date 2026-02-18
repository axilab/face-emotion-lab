export type InputMode = "batch" | "generate";

export interface GeneratedImage {
  id: string;
  url: string;
  base64: string;
  mimeType: string;
}

export interface PromptPreset {
  id: string;
  name: string;
  prompt: string;
  builtIn?: boolean;
}

export interface SliderConfig {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  description?: string;
}

export interface SliderGroupConfig {
  id: string;
  label: string;
  sliders: SliderConfig[];
}

export interface ExpressionParams {
  smile: number;
  aaa: number;
  eee: number;
  woo: number;
  blink: number;
  eyebrow: number;
  wink: number;
  pupil_x: number;
  pupil_y: number;
  rotate_pitch: number;
  rotate_yaw: number;
  rotate_roll: number;
}

export type ExpressionKey = keyof ExpressionParams;

export interface EmotionPreset {
  id: string;
  name: string;
  emoji: string;
  params: Partial<ExpressionParams>;
  builtIn?: boolean;
}

export interface GpuOption {
  id: string;
  displayName: string;
  memoryInGb: number;
  securePrice: number | null;
  communityPrice: number | null;
  lowestPrice: number | null;
  communityCloud: boolean;
  secureCloud: boolean;
  maxGpuCount: number;
}

export interface PodInfo {
  id: string;
  name: string;
  desiredStatus: string;
  costPerHr?: number;
  gpuAvailable?: boolean;
  machine?: {
    gpuDisplayName?: string;
  };
  runtime?: {
    ports?: Array<{
      ip: string;
      isIpPublic: boolean;
      privatePort: number;
      publicPort: number;
      type: string;
    }>;
  };
}

export type GenerationStep =
  | "idle"
  | "installing_node"
  | "uploading"
  | "processing_crop"
  | "processing_emotion"
  | "downloading"
  | "complete"
  | "error";

export interface GenerationState {
  step: GenerationStep;
  error?: string;
}

export interface HealthStatus {
  comfyui: boolean;
  expressionEditor: boolean;
}

// Batch mode types

export type BatchItemStatus = "pending" | "uploading" | "cropping" | "processing" | "downloading" | "complete" | "error";
export type BatchStatus = "idle" | "running" | "cancelled" | "complete";

export interface BatchFile {
  id: string;
  file: File;
  displayName: string;
  previewUrl: string;
  uploadedName: string | null;
  croppedUrl: string | null;
  cropCacheKey: string | null;
}

export interface BatchResult {
  id: string;
  fileId: string;
  presetId: string;
  presetName: string;
  originalFileName: string;
  status: BatchItemStatus;
  resultUrl: string | null;
  error: string | null;
}
