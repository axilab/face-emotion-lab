"use client";

import { SliderGroup } from "@/components/SliderGroup";
import { ParamSlider } from "@/components/ParamSlider";
import { Button } from "@/components/ui/button";
import { useExpressionStore } from "@/stores/useExpressionStore";
import { SLIDER_GROUPS, CROP_FACTOR_CONFIG } from "@/lib/constants";
import { ExpressionKey } from "@/lib/types";
import { RotateCcw } from "lucide-react";

export function SliderPanel() {
  const { params, cropFactor, setParam, setCropFactor, resetAll } = useExpressionStore();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Параметры</span>
        <Button variant="ghost" size="sm" onClick={resetAll} className="h-7 text-xs gap-1">
          <RotateCcw className="h-3 w-3" />
          Сбросить все
        </Button>
      </div>

      {SLIDER_GROUPS.map((group) => (
        <SliderGroup
          key={group.id}
          group={group}
          values={params as unknown as Record<string, number>}
          onChange={(key: ExpressionKey, value: number) => setParam(key, value)}
        />
      ))}

      <div className="pt-1">
        <ParamSlider
          config={{
            key: "crop_factor",
            label: "Обрезка",
            description: "Множитель области обрезки лица. Больше = больше фона вокруг лица.",
            min: CROP_FACTOR_CONFIG.min,
            max: CROP_FACTOR_CONFIG.max,
            step: CROP_FACTOR_CONFIG.step,
            default: CROP_FACTOR_CONFIG.default,
          }}
          value={cropFactor}
          onChange={setCropFactor}
        />
      </div>
    </div>
  );
}
