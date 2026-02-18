"use client";

import { useCallback, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useBatchStore } from "@/stores/useBatchStore";
import { useGenerateImageStore } from "@/stores/useGenerateImageStore";
import { useImageGenerate } from "@/hooks/useImageGenerate";
import { MAX_FILE_SIZE_MB, DEFAULT_PROMPT_PRESETS } from "@/lib/constants";
import { PromptPreset } from "@/lib/types";
import { Upload, X, Trash2, Plus, Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ImageUpload() {
  const { files, addFiles, removeFile, clearFiles, status } = useBatchStore();
  const {
    prompt, setPrompt,
    aspectRatio, setAspectRatio,
    quantity, setQuantity,
    status: genStatus,
    customPromptPresets, saveCustomPreset, deleteCustomPreset, loadPreset,
  } = useGenerateImageStore();

  const { generate: imagenGenerate } = useImageGenerate();

  const inputRef = useRef<HTMLInputElement>(null);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState("");

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const fileList = Array.from(e.dataTransfer.files);
      if (fileList.length) addFiles(fileList);
    },
    [addFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const isRunning = status === "running";
  const isGenerating = genStatus === "generating";

  const allPromptPresets: PromptPreset[] = [...DEFAULT_PROMPT_PRESETS, ...customPromptPresets];

  const handleSavePreset = () => {
    if (presetName.trim()) {
      saveCustomPreset(presetName.trim());
      setPresetName("");
      setShowSavePreset(false);
      toast.success("Пресет сохранён");
    }
  };

  return (
    <>
      {/* Generate mode */}
      <TabsContent value="generate" className="space-y-3 mt-0">
        {/* Prompt presets */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Шаблоны промптов</span>
          <div className="flex flex-wrap gap-1">
            {allPromptPresets.map((preset) => (
              <div key={preset.id} className="relative group">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] px-2"
                  onClick={() => loadPreset(preset)}
                  disabled={isGenerating}
                >
                  {preset.name}
                </Button>
                {!preset.builtIn && (
                  <button
                    className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCustomPreset(preset.id);
                    }}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Prompt textarea + generate button */}
        <div className="relative">
          <Textarea
            placeholder="Опишите портрет для генерации..."
            className="min-h-[100px] text-xs resize-none pr-10"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isGenerating}
          />
          <Button
            size="icon"
            className="absolute bottom-2 right-2 h-7 w-7"
            disabled={!prompt.trim() || isGenerating}
            onClick={imagenGenerate}
            title="Сгенерировать портрет"
          >
            {isGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {/* Settings row */}
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <span className="text-[10px] text-muted-foreground">Пропорции</span>
            <Select
              value={aspectRatio}
              onValueChange={(v) => setAspectRatio(v as typeof aspectRatio)}
              disabled={isGenerating}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1:1">1:1</SelectItem>
                <SelectItem value="3:4">3:4</SelectItem>
                <SelectItem value="4:3">4:3</SelectItem>
                <SelectItem value="9:16">9:16</SelectItem>
                <SelectItem value="16:9">16:9</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-20 space-y-1">
            <span className="text-[10px] text-muted-foreground">Кол-во</span>
            <Select
              value={String(quantity)}
              onValueChange={(v) => setQuantity(Number(v))}
              disabled={isGenerating}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Save preset */}
        {showSavePreset ? (
          <div className="flex gap-1">
            <Input
              className="h-7 text-xs"
              placeholder="Название пресета"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
              autoFocus
            />
            <Button size="sm" className="h-7 text-xs" onClick={handleSavePreset}>
              Сохранить
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowSavePreset(false)}
            >
              Отмена
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setShowSavePreset(true)}
            disabled={!prompt.trim() || isGenerating}
          >
            <Plus className="h-3 w-3" />
            Сохранить промпт
          </Button>
        )}
      </TabsContent>

      {/* Batch mode */}
      <TabsContent value="batch" className="space-y-2 mt-0">
        {files.length > 0 && (
          <div className="flex items-center justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground"
              onClick={clearFiles}
              disabled={isRunning}
            >
              <Trash2 className="h-3 w-3" />
              Очистить все
            </Button>
          </div>
        )}

        {files.length > 0 && (
          <Card className="divide-y divide-border/50">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-2 p-2">
                <img
                  src={f.previewUrl}
                  alt={f.displayName}
                  className="h-8 w-8 rounded object-cover bg-black/20 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate">{f.displayName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {(f.file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => removeFile(f.id)}
                  disabled={isRunning}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </Card>
        )}

        <Card
          className="border-dashed border-2 cursor-pointer hover:border-primary/50 transition-colors"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => inputRef.current?.click()}
        >
          <div className="flex flex-col items-center justify-center gap-1 p-4 text-muted-foreground">
            <Upload className="h-5 w-5" />
            <p className="text-xs font-medium">
              {files.length > 0 ? "Добавить ещё" : "Перетащите изображения или нажмите"}
            </p>
            <p className="text-[10px]">PNG, JPG до {MAX_FILE_SIZE_MB} МБ</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const fileList = e.target.files;
              if (fileList?.length) addFiles(Array.from(fileList));
              e.target.value = "";
            }}
          />
        </Card>
      </TabsContent>
    </>
  );
}
