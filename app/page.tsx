"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { ImageUpload } from "@/components/ImageUpload";
import { PresetBar } from "@/components/PresetBar";
import { IntensityControl } from "@/components/IntensityControl";
import { SliderPanel } from "@/components/SliderPanel";
import { GenerateButton } from "@/components/GenerateButton";
import { ResultPanel } from "@/components/ResultPanel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useImageStore } from "@/stores/useImageStore";
import { useBatchStore } from "@/stores/useBatchStore";
import { useGenerateImageStore } from "@/stores/useGenerateImageStore";
import { usePodPolling } from "@/hooks/usePodPolling";
import { InputMode } from "@/lib/types";
import { cn } from "@/lib/utils";

function SidebarContent({ isGenerateMode }: { isGenerateMode: boolean }) {
  return (
    <div className="space-y-4">
      <ImageUpload />
      {!isGenerateMode && (
        <>
          <PresetBar />
          <IntensityControl />
          <SliderPanel />
        </>
      )}
      <GenerateButton />
    </div>
  );
}

export default function Home() {
  usePodPolling();
  const { generationStep } = useImageStore();
  const batchStatus = useBatchStore((s) => s.status);
  const inputMode = useBatchStore((s) => s.inputMode);
  const setInputMode = useBatchStore((s) => s.setInputMode);
  const genStatus = useGenerateImageStore((s) => s.status);
  const isGenerateMode = inputMode === "generate";

  const isRunning = batchStatus === "running";
  const isGenerating = genStatus === "generating";
  const tabsDisabled = isRunning || isGenerating;

  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Prevent page unload during generation
  useEffect(() => {
    const isSingleGenerating = !["idle", "complete", "error"].includes(generationStep);
    const isBatchRunning = batchStatus === "running";
    const isImagenGenerating = genStatus === "generating";
    if (!isSingleGenerating && !isBatchRunning && !isImagenGenerating) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [generationStep, batchStatus, genStatus]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <Header sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} />

      <Tabs
        value={inputMode}
        onValueChange={(v) => !tabsDisabled && setInputMode(v as InputMode)}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="relative flex flex-1 min-h-0 flex-row">
          {/* Overlay backdrop on mobile when sidebar is open */}
          {sidebarOpen && (
            <div
              className="lg:hidden fixed inset-0 top-[45px] z-30 bg-black/40"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <div
            className={cn(
              "flex flex-col shrink-0 border-r border-border/50 bg-background overflow-hidden",
              "transition-[width,transform] duration-200",
              "fixed lg:relative top-[45px] lg:top-0 bottom-0 left-0 z-40",
              sidebarOpen
                ? "w-[380px] lg:w-[420px] translate-x-0"
                : "w-[380px] -translate-x-full lg:translate-x-0 lg:w-0 lg:border-r-0"
            )}
          >
            <div className="shrink-0 px-4 pt-3 pb-2 border-b border-border/30">
              <TabsList className="w-full">
                <TabsTrigger value="generate" disabled={tabsDisabled} className="flex-1 text-xs">
                  Генерация фото
                </TabsTrigger>
                <TabsTrigger value="batch" disabled={tabsDisabled} className="flex-1 text-xs">
                  Обработка фото
                </TabsTrigger>
              </TabsList>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <SidebarContent isGenerateMode={isGenerateMode} />
            </div>
          </div>

          {/* Right Panel - Result */}
          <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
            <ResultPanel />
          </div>
        </div>
      </Tabs>
    </div>
  );
}
