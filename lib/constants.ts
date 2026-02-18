import { SliderGroupConfig, EmotionPreset, ExpressionParams, PromptPreset } from "./types";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Prefix an internal API path with basePath, e.g. apiUrl("/api/pod/list") */
export function apiUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}

export const DEFAULT_EXPRESSION: ExpressionParams = {
  smile: 0,
  aaa: 0,
  eee: 0,
  woo: 0,
  blink: 0,
  eyebrow: 0,
  wink: 0,
  pupil_x: 0,
  pupil_y: 0,
  rotate_pitch: 0,
  rotate_yaw: 0,
  rotate_roll: 0,
};

export const SLIDER_GROUPS: SliderGroupConfig[] = [
  {
    id: "mouth",
    label: "Рот",
    sliders: [
      { key: "smile", label: "Улыбка", min: -0.3, max: 1.3, step: 0.01, default: 0, description: "Положительные — уголки рта вверх. Отрицательные — вниз." },
      { key: "aaa", label: "Ааа", min: -30, max: 120, step: 1, default: 0, description: "Вертикальное раскрытие рта. 0 = закрыт, 15 = широко открыт." },
      { key: "eee", label: "Иии", min: -20, max: 15, step: 0.2, default: 0, description: "Горизонтальное растяжение губ. Положительные — оскал, отрицательные — сжатие." },
      { key: "woo", label: "Ууу", min: -20, max: 15, step: 0.2, default: 0, description: "Вытягивание губ трубочкой. Также влияет на область носа." },
    ],
  },
  {
    id: "eyes",
    label: "Глаза",
    sliders: [
      { key: "blink", label: "Моргание", min: -20, max: 5, step: 0.5, default: 0, description: "Отрицательные — прищур/закрытие. Положительные — широко открытые глаза." },
      { key: "eyebrow", label: "Брови", min: -10, max: 15, step: 0.5, default: 0, description: "Положительные — подняты (удивление). Отрицательные — нахмурены (гнев)." },
      { key: "wink", label: "Подмигивание", min: 0, max: 25, step: 0.5, default: 0, description: "Закрытие одного глаза." },
      { key: "pupil_x", label: "Зрачок X", min: -15, max: 15, step: 0.5, default: 0, description: "Направление взгляда влево/вправо." },
      { key: "pupil_y", label: "Зрачок Y", min: -15, max: 15, step: 0.5, default: 0, description: "Направление взгляда вверх/вниз." },
    ],
  },
  {
    id: "head",
    label: "Голова",
    sliders: [
      { key: "rotate_pitch", label: "Наклон", min: -20, max: 20, step: 1, default: 0, description: "Кивок: положительные — подбородок вниз, отрицательные — вверх." },
      { key: "rotate_yaw", label: "Поворот", min: -20, max: 20, step: 1, default: 0, description: "Поворот головы в сторону." },
      { key: "rotate_roll", label: "Крен", min: -20, max: 20, step: 1, default: 0, description: "Наклон головы вбок, к плечу." },
    ],
  },
];

export const CROP_FACTOR_CONFIG = {
  min: 1.5,
  max: 2.5,
  step: 0.1,
  default: 1.7,
};

export const INTENSITY_CONFIG = {
  min: 0.1,
  max: 3.0,
  step: 0.1,
  default: 1.0,
};

export const EKMAN_PRESETS: EmotionPreset[] = [
  {
    id: "joy",
    name: "Радость",
    emoji: "😊",
    builtIn: true,
    params: { smile: 0.6, eyebrow: 2.0, blink: -2.0 },
  },
  {
    id: "anger",
    name: "Гнев",
    emoji: "😠",
    builtIn: true,
    params: { smile: -0.15, eyebrow: -6.0, blink: -1.0, eee: 2.0 },
  },
  {
    id: "fear",
    name: "Страх",
    emoji: "😨",
    builtIn: true,
    params: { smile: -0.05, eyebrow: 8.0, blink: 3.0, aaa: 5, eee: -2.0 },
  },
  {
    id: "sadness",
    name: "Печаль",
    emoji: "😢",
    builtIn: true,
    params: { smile: -0.2, eyebrow: 4.0, blink: -3.0, woo: 2.0 },
  },
  {
    id: "surprise",
    name: "Удивление",
    emoji: "😲",
    builtIn: true,
    params: { smile: 0.0, eyebrow: 10.0, blink: 4.0, aaa: 15 },
  },
  {
    id: "disgust",
    name: "Отвращение",
    emoji: "🤢",
    builtIn: true,
    params: { smile: -0.15, eyebrow: -3.0, blink: -2.0, eee: 3.0, woo: 4.0 },
  },
  {
    id: "contempt",
    name: "Презрение",
    emoji: "😏",
    builtIn: true,
    params: { smile: 0.15, eyebrow: -2.0, blink: -1.5, wink: 2.0, rotate_yaw: 3 },
  },
];

export const DEFAULT_PROMPT_PRESETS: PromptPreset[] = [
  {
    id: "man-30",
    name: "Мужчина 30 лет",
    builtIn: true,
    prompt:
      "Generate a photorealistic portrait photo of a man in his early 30s. He has a completely neutral facial expression — relaxed face, lips gently closed, eyes looking straight at the camera. The shot is a tight close-up from shoulders up, centered on the face. Clean studio background (solid light gray). Soft, even studio lighting with no harsh shadows. The image should look like a professional headshot photograph. High resolution, sharp focus on the face.",
  },
  {
    id: "woman-30",
    name: "Женщина 30 лет",
    builtIn: true,
    prompt:
      "Generate a photorealistic portrait photo of a woman in her late 20s. She has a completely neutral facial expression — relaxed face, lips gently closed, eyes looking straight at the camera. The shot is a tight close-up from shoulders up, centered on the face. Clean studio background (solid light gray). Soft, even studio lighting with no harsh shadows. The image should look like a professional headshot photograph. High resolution, sharp focus on the face.",
  },
  {
    id: "child-8-10",
    name: "Ребенок 8-10 лет",
    builtIn: true,
    prompt:
      "Generate a photorealistic portrait photo of a child around 8-10 years old. The child has a completely neutral facial expression — relaxed face, lips gently closed, eyes looking straight at the camera. The shot is a tight close-up from shoulders up, centered on the face. Clean studio background (solid light gray). Soft, even studio lighting with no harsh shadows. The image should look like a professional headshot photograph. High resolution, sharp focus on the face.",
  },
];

export const RUNPOD_TEMPLATE_ID = "cw3nka7d08";

export const POD_CREATE_CONFIG = {
  gpuCount: 1,
  volumeInGb: 75,
  containerDiskInGb: 20,
  minVcpuCount: 4,
  minMemoryInGb: 16,
  publicKey: "ssh-ed25519 AAAA placeholder-for-web-app",
};

export const POLL_INTERVAL_MS = 2000;
export const GENERATION_TIMEOUT_MS = 180000;
export const POD_POLL_INTERVAL_MS = 15000;
export const MAX_FILE_SIZE_MB = 10;
