import { ExpressionParams } from "./types";

export function buildWorkflow(
  filename: string,
  params: ExpressionParams,
  cropFactor: number,
  filenamePrefix?: string
) {
  const prefix = filenamePrefix || `faceemotionlab_${Date.now()}`;

  return {
    "1": {
      class_type: "LoadImage",
      inputs: { image: filename },
    },
    "2": {
      class_type: "ExpressionEditor",
      inputs: {
        src_image: ["1", 0],
        rotate_pitch: params.rotate_pitch,
        rotate_yaw: params.rotate_yaw,
        rotate_roll: params.rotate_roll,
        blink: params.blink,
        eyebrow: params.eyebrow,
        wink: params.wink,
        pupil_x: params.pupil_x,
        pupil_y: params.pupil_y,
        aaa: params.aaa,
        eee: params.eee,
        woo: params.woo,
        smile: params.smile,
        src_ratio: 1.0,
        sample_ratio: 1.0,
        sample_parts: "OnlyExpression",
        crop_factor: cropFactor,
      },
    },
    "3": {
      class_type: "ImageScale",
      inputs: {
        image: ["2", 0],
        upscale_method: "lanczos",
        width: 512,
        height: 512,
        crop: "center",
      },
    },
    "4": {
      class_type: "SaveImage",
      inputs: {
        images: ["3", 0],
        filename_prefix: prefix,
      },
    },
  };
}

// ExpressionEditor node limits from ComfyUI-AdvancedLivePortrait
const NODE_LIMITS: Record<keyof ExpressionParams, { min: number; max: number }> = {
  rotate_pitch: { min: -20, max: 20 },
  rotate_yaw:   { min: -20, max: 20 },
  rotate_roll:  { min: -20, max: 20 },
  blink:        { min: -20, max: 5 },
  eyebrow:      { min: -10, max: 15 },
  wink:         { min: 0,   max: 25 },
  pupil_x:      { min: -15, max: 15 },
  pupil_y:      { min: -15, max: 15 },
  aaa:          { min: -30, max: 120 },
  eee:          { min: -20, max: 15 },
  woo:          { min: -20, max: 15 },
  smile:        { min: -0.3, max: 1.3 },
};

export function scaleParams(
  params: ExpressionParams,
  intensity: number
): ExpressionParams {
  const scaled = { ...params };
  for (const key of Object.keys(scaled) as (keyof ExpressionParams)[]) {
    const val = scaled[key] * intensity;
    const lim = NODE_LIMITS[key];
    scaled[key] = Math.max(lim.min, Math.min(lim.max, val));
  }
  return scaled;
}

export function comfyuiBaseUrl(podId: string): string {
  return `https://${podId}-8188.proxy.runpod.net`;
}
