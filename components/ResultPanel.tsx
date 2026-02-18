"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useGenerateImageStore } from "@/stores/useGenerateImageStore";
import { useBatchStore } from "@/stores/useBatchStore";
import { useImageGenerate } from "@/hooks/useImageGenerate";
import { BatchResultGallery } from "@/components/BatchResultGallery";
import { downloadResultsAsZip } from "@/lib/zip";
import {
  Download, ImageIcon, ArrowRight, Loader2, Wand2,
  Archive, CheckSquare, Trash2,
} from "lucide-react";

export function ResultPanel() {
  const { inputMode, results, status: batchStatus } = useBatchStore();
  const {
    status: genStatus,
    generatedImages,
    selectedIds,
    quantity,
    toggleSelect,
    selectAll,
    clearSelection,
    removeSelected,
  } = useGenerateImageStore();
  const { useForEmotions } = useImageGenerate();
  const [zipping, setZipping] = useState(false);

  // Generate mode: show AI-generated images
  if (inputMode === "generate") {
    const isGenerating = genStatus === "generating";
    const hasImages = generatedImages.length > 0;
    const allSelected = hasImages && selectedIds.length === generatedImages.length;

    const handleToggleAll = () => {
      if (allSelected) clearSelection();
      else selectAll();
    };

    const handleZipDownload = async () => {
      setZipping(true);
      try {
        const targets = selectedIds.length > 0
          ? generatedImages.filter((img) => selectedIds.includes(img.id))
          : generatedImages;

        const items = targets.map((img, idx) => {
          const ext = img.mimeType.includes("png") ? "png" : "jpg";
          return { url: img.url, filename: `generated_portrait_${idx + 1}.${ext}` };
        });

        if (items.length) {
          await downloadResultsAsZip(items, "generated-portraits.zip");
        }
      } finally {
        setZipping(false);
      }
    };

    const handleDownloadSingle = (url: string, name: string) => {
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
    };

    // Empty state
    if (!hasImages && !isGenerating) {
      return (
        <div className="flex flex-col items-center gap-4 w-full h-full">
          <Card className="w-full max-w-[512px] aspect-square flex items-center justify-center overflow-hidden bg-black/20">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Wand2 className="h-12 w-12 opacity-30" />
              <p className="text-sm">Сгенерированный портрет появится здесь</p>
            </div>
          </Card>
        </div>
      );
    }

    // Generating state
    if (isGenerating) {
      return (
        <div className="flex flex-col items-center gap-4 w-full h-full">
          {/* Progress */}
          <div className="w-full max-w-[512px] space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Генерация {generatedImages.length}/{quantity}</span>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: `${(generatedImages.length / quantity) * 100}%` }}
              />
            </div>
          </div>

          {/* Already generated images */}
          {generatedImages.length > 0 && (
            <div className="grid grid-cols-2 gap-2 w-full max-w-[512px]">
              {generatedImages.map((img) => (
                <Card key={img.id} className="relative overflow-hidden bg-black/10">
                  <div className="aspect-square">
                    <img
                      src={img.url}
                      alt="Сгенерированный портрет"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </Card>
              ))}
              {/* Placeholder for remaining */}
              {Array.from({ length: quantity - generatedImages.length }).map((_, idx) => (
                <Card key={`placeholder-${idx}`} className="overflow-hidden bg-black/10">
                  <div className="aspect-square flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Done — single image (no checkboxes needed for 1 image)
    if (generatedImages.length === 1) {
      const img = generatedImages[0];
      const ext = img.mimeType.includes("png") ? "png" : "jpg";
      return (
        <div className="flex flex-col items-center gap-4 w-full h-full">
          <Card className="w-full max-w-[512px] aspect-square flex items-center justify-center overflow-hidden bg-black/20">
            <img
              src={img.url}
              alt="Сгенерированный портрет"
              className="w-full h-full object-contain"
            />
          </Card>
          <div className="flex gap-2 w-full max-w-[512px]">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1 text-xs"
              onClick={() => handleDownloadSingle(img.url, `generated_portrait.${ext}`)}
            >
              <Download className="h-3 w-3" />
              Скачать
            </Button>
            <Button
              size="sm"
              className="flex-1 gap-1 text-xs"
              onClick={useForEmotions}
            >
              <ArrowRight className="h-3 w-3" />
              Использовать для эмоций
            </Button>
          </div>
        </div>
      );
    }

    // Done — multiple images with checkboxes
    return (
      <div className="flex flex-col gap-3 w-full h-full">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1"
              onClick={handleToggleAll}
            >
              <CheckSquare className="h-3 w-3" />
              {allSelected ? "Снять выбор" : "Выбрать все"}
            </Button>
            {selectedIds.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1 text-destructive"
                onClick={removeSelected}
              >
                <Trash2 className="h-3 w-3" />
                Удалить ({selectedIds.length})
              </Button>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground">
            {selectedIds.length > 0
              ? `Выбрано: ${selectedIds.length} из ${generatedImages.length}`
              : `${generatedImages.length} фото`}
          </span>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-2 w-full">
          {generatedImages.map((img, idx) => {
            const isSelected = selectedIds.includes(img.id);
            return (
              <Card
                key={img.id}
                className={`relative overflow-hidden cursor-pointer transition-all ${
                  isSelected ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-primary/50"
                }`}
                onClick={() => toggleSelect(img.id)}
              >
                <div className="absolute top-2 left-2 z-10">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(img.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-background/80 backdrop-blur-sm"
                  />
                </div>
                <div className="aspect-square">
                  <img
                    src={img.url}
                    alt={`Портрет ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              </Card>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1 text-xs"
            onClick={handleZipDownload}
            disabled={zipping}
          >
            {zipping ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Archive className="h-3 w-3" />
            )}
            Скачать ZIP{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1 text-xs"
            onClick={useForEmotions}
          >
            <ArrowRight className="h-3 w-3" />
            Для эмоций{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
          </Button>
        </div>
      </div>
    );
  }

  // Single & Batch mode: show gallery when results exist
  if (results.length > 0) {
    return <BatchResultGallery />;
  }

  // Empty state
  const isRunning = batchStatus === "running";

  return (
    <div className="flex flex-col items-center gap-4 w-full h-full">
      <Card className="w-full max-w-[512px] aspect-square flex items-center justify-center overflow-hidden bg-black/20">
        {isRunning ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Подготовка...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImageIcon className="h-12 w-12 opacity-30" />
            <p className="text-sm">Результат появится здесь</p>
          </div>
        )}
      </Card>
    </div>
  );
}
