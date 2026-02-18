"use client";

import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { SliderConfig } from "@/lib/types";

interface ParamSliderProps {
  config: SliderConfig;
  value: number;
  onChange: (value: number) => void;
}

export function ParamSlider({ config, value, onChange }: ParamSliderProps) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v)) {
      onChange(Math.min(config.max, Math.max(config.min, v)));
    }
  };

  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-20 flex items-center gap-1 shrink-0">
        <Label
          className="text-xs text-muted-foreground cursor-pointer select-none truncate"
          onDoubleClick={() => onChange(config.default)}
          title="Двойной клик для сброса"
        >
          {config.label}
        </Label>
        {config.description && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground cursor-help shrink-0" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px] text-[11px] leading-snug">
                {config.description}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <Slider
        className="flex-1"
        min={config.min}
        max={config.max}
        step={config.step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
      <Input
        type="number"
        className="w-16 h-7 text-xs text-center px-1"
        value={value}
        min={config.min}
        max={config.max}
        step={config.step}
        onChange={handleInputChange}
      />
    </div>
  );
}
