"use client";

import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { useExpressionStore } from "@/stores/useExpressionStore";
import { INTENSITY_CONFIG } from "@/lib/constants";

const QUICK_VALUES = [0.5, 1.0, 1.5];

export function IntensityControl() {
  const { intensity, setIntensity } = useExpressionStore();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-1">
          Интенсивность
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px] text-[11px] leading-snug">
                Множитель для всех параметров выражения. 1.0x = без изменений, 0.5x = ослабить вдвое, 2.0x = усилить вдвое.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </span>
        <span className="text-xs text-muted-foreground">{intensity.toFixed(1)}x</span>
      </div>
      <Slider
        min={INTENSITY_CONFIG.min}
        max={INTENSITY_CONFIG.max}
        step={INTENSITY_CONFIG.step}
        value={[intensity]}
        onValueChange={([v]) => setIntensity(v)}
      />
      <div className="flex gap-1">
        {QUICK_VALUES.map((v) => (
          <Button
            key={v}
            variant={intensity === v ? "default" : "outline"}
            size="sm"
            className="h-6 text-xs flex-1"
            onClick={() => setIntensity(v)}
          >
            {v}x
          </Button>
        ))}
      </div>
    </div>
  );
}
