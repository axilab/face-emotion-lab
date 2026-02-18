"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useBatchStore } from "@/stores/useBatchStore";
import { downloadResultsAsZip } from "@/lib/zip";
import { Download, Archive, Loader2, AlertCircle, X, ImageIcon } from "lucide-react";

function handleDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

export function BatchResultGallery() {
  const { results, status } = useBatchStore();
  const [zipping, setZipping] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const completed = results.filter((r) => r.status === "complete").length;
  const errors = results.filter((r) => r.status === "error").length;
  const total = results.length;

  const handleZipDownload = async () => {
    setZipping(true);
    try {
      const items: Array<{ url: string; filename: string }> = [];

      // All results (including "normal" cropped originals)
      for (const result of results) {
        if (result.resultUrl) {
          items.push({
            url: result.resultUrl,
            filename: `${result.originalFileName}_${result.presetName}.png`,
          });
        }
      }

      if (items.length) {
        await downloadResultsAsZip(items, "face-emotion-lab-results.zip");
      }
    } finally {
      setZipping(false);
    }
  };

  const selectedResult = selectedId ? results.find((r) => r.id === selectedId) : null;

  // Full-area view when a photo is selected
  if (selectedResult && selectedResult.resultUrl) {
    return (
      <div className="flex flex-col w-full h-[calc(100dvh-45px-2rem)]">
        {/* Toolbar */}
        <div className="flex items-center justify-between pb-2 shrink-0">
          <span className="text-xs text-muted-foreground">
            {selectedResult.originalFileName}_{selectedResult.presetName}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() =>
                handleDownload(
                  selectedResult.resultUrl!,
                  `${selectedResult.originalFileName}_${selectedResult.presetName}.png`
                )
              }
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSelectedId(null)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {/* Image fills remaining space */}
        <div className="flex-1 min-h-0 flex items-center justify-center bg-black/10 rounded-lg overflow-hidden">
          <img
            src={selectedResult.resultUrl}
            alt={`${selectedResult.originalFileName}_${selectedResult.presetName}`}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Готово {completed}/{total}
            {errors > 0 && <span className="text-red-400">, ошибок: {errors}</span>}
          </span>
          <span className="capitalize">
            {status === "running" && "Обработка..."}
            {status === "complete" && "Завершено"}
            {status === "cancelled" && "Отменено"}
          </span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: total > 0 ? `${((completed + errors) / total) * 100}%` : "0%" }}
          />
        </div>
      </div>

      {/* Results grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {results.map((result) => (
          <Card
            key={result.id}
            className={`relative overflow-hidden cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all ${
              selectedId === result.id ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => {
              if (result.resultUrl) setSelectedId(result.id);
            }}
          >
            <div className="aspect-square flex items-center justify-center bg-black/10">
              {result.status === "complete" && result.resultUrl ? (
                <img
                  src={result.resultUrl}
                  alt={`${result.originalFileName}_${result.presetName}`}
                  className="w-full h-full object-cover"
                />
              ) : result.status === "error" ? (
                <div className="flex flex-col items-center gap-1 text-red-400 p-2">
                  <AlertCircle className="h-5 w-5" />
                  <p className="text-[9px] text-center line-clamp-2">{result.error}</p>
                </div>
              ) : result.status === "pending" ? (
                <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="p-1 text-[10px] text-muted-foreground truncate text-center">
              {result.originalFileName}_{result.presetName}
            </div>
          </Card>
        ))}
      </div>

      {/* Download buttons */}
      {completed > 0 && (
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
            Скачать все (ZIP)
          </Button>
        </div>
      )}
    </div>
  );
}
