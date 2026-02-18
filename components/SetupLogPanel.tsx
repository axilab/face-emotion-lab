"use client";

import { useRef, useEffect } from "react";
import { CheckCircle, XCircle, Terminal } from "lucide-react";

interface SetupLogPanelProps {
  logs: string[];
  status?: "running" | "done" | "error";
}

export function SetupLogPanel({ logs, status = "running" }: SetupLogPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  if (logs.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-[#0d1117] overflow-hidden">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#161b22] border-b border-border">
        <Terminal className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground font-medium">Лог установки</span>
        {status === "done" && <CheckCircle className="h-3 w-3 text-green-500 ml-auto" />}
        {status === "error" && <XCircle className="h-3 w-3 text-red-500 ml-auto" />}
        {status === "running" && (
          <span className="ml-auto flex gap-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          </span>
        )}
      </div>
      <div className="max-h-48 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed space-y-0.5">
        {logs.map((line, i) => (
          <div
            key={i}
            className={
              line.startsWith("ERROR")
                ? "text-red-400"
                : line.includes("ready") || line.includes("installed") || line.includes("cloned")
                  ? "text-green-400"
                  : "text-gray-400"
            }
          >
            <span className="text-gray-600 select-none">$ </span>
            {line}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
