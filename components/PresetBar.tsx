"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useExpressionStore } from "@/stores/useExpressionStore";
import { useBatchStore } from "@/stores/useBatchStore";
import { EKMAN_PRESETS } from "@/lib/constants";
import { EmotionPreset } from "@/lib/types";
import { Plus, X, CheckSquare, Square, SlidersHorizontal, Layers } from "lucide-react";
import { useState } from "react";

export function PresetBar() {
  const { customPresets, applyPreset, saveCustomPreset, deleteCustomPreset } =
    useExpressionStore();
  const { inputMode, selectedPresetIds, togglePreset, selectAllPresets, clearPresets } =
    useBatchStore();
  const [showSave, setShowSave] = useState(false);
  const [newName, setNewName] = useState("");

  const handleSave = () => {
    if (newName.trim()) {
      saveCustomPreset(newName.trim());
      setNewName("");
      setShowSave(false);
    }
  };

  // Generate mode doesn't use emotion presets
  if (inputMode === "generate") return null;

  const allPresets: EmotionPreset[] = [...EKMAN_PRESETS, ...customPresets];
  const allIds = allPresets.map((p) => p.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedPresetIds.includes(id));
  const isPresetMode = selectedPresetIds.length > 0;

  const handlePresetClick = (preset: EmotionPreset) => {
    togglePreset(preset.id);
    // Load preset params into sliders so user can see/tweak them
    applyPreset(preset);
  };

  const renderPreset = (preset: EmotionPreset) => {
    const isSelected = selectedPresetIds.includes(preset.id);
    return (
      <Button
        key={preset.id}
        variant={isSelected ? "default" : "outline"}
        size="sm"
        className="h-8 text-xs gap-1 shrink-0"
        onClick={() => handlePresetClick(preset)}
      >
        <span>{preset.emoji}</span>
        <span>{preset.name}</span>
      </Button>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          Пресеты{selectedPresetIds.length > 0 && ` (${selectedPresetIds.length})`}
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() =>
              allSelected ? clearPresets() : selectAllPresets(allIds)
            }
          >
            {allSelected ? (
              <><Square className="h-3 w-3 mr-1" />Сбросить</>
            ) : (
              <><CheckSquare className="h-3 w-3 mr-1" />Все</>
            )}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {EKMAN_PRESETS.map(renderPreset)}
      </div>

      {customPresets.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {customPresets.map((preset) => (
            <div key={preset.id} className="relative group">
              {renderPreset(preset)}
              <button
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteCustomPreset(preset.id);
                }}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Mode indicator */}
      <div className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md ${
        isPresetMode
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground"
      }`}>
        {isPresetMode ? (
          <>
            <Layers className="h-3 w-3" />
            <span>Генерация по пресетам ({selectedPresetIds.length})</span>
          </>
        ) : (
          <>
            <SlidersHorizontal className="h-3 w-3" />
            <span>Генерация по параметрам</span>
          </>
        )}
      </div>

      {showSave ? (
        <div className="flex gap-1">
          <Input
            className="h-7 text-xs"
            placeholder="Название пресета"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
          />
          <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
            Сохранить
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowSave(false)}
          >
            Отмена
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => setShowSave(true)}
        >
          <Plus className="h-3 w-3" />
          Сохранить пресет
        </Button>
      )}
    </div>
  );
}
