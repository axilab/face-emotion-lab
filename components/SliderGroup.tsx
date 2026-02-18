"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ParamSlider } from "@/components/ParamSlider";
import { SliderGroupConfig, ExpressionKey } from "@/lib/types";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface SliderGroupProps {
  group: SliderGroupConfig;
  values: Record<string, number>;
  onChange: (key: ExpressionKey, value: number) => void;
}

export function SliderGroup({ group, values, onChange }: SliderGroupProps) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-border/50">
        <CollapsibleTrigger asChild>
          <CardHeader className="py-2 px-3 cursor-pointer hover:bg-accent/50 transition-colors">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              {group.label}
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="px-3 pb-2 pt-0 space-y-0">
            {group.sliders.map((slider) => (
              <ParamSlider
                key={slider.key}
                config={slider}
                value={values[slider.key] ?? slider.default}
                onChange={(v) => onChange(slider.key as ExpressionKey, v)}
              />
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
