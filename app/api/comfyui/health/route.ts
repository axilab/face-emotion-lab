import { NextRequest, NextResponse } from "next/server";
import { comfyuiBaseUrl } from "@/lib/comfyui";
import { proxyFetch } from "@/lib/fetch";

export async function GET(req: NextRequest) {
  const podId = req.headers.get("x-pod-id");
  if (!podId) {
    return NextResponse.json({ error: "Missing x-pod-id header" }, { status: 400 });
  }

  const baseUrl = comfyuiBaseUrl(podId);
  let comfyui = false;
  let expressionEditor = false;
  let manager = false;
  let comfyuiError: string | null = null;

  // Check ComfyUI
  try {
    const statsRes = await proxyFetch(`${baseUrl}/system_stats`, {
      signal: AbortSignal.timeout(15000),
    });
    if (statsRes.ok) {
      comfyui = true;
    } else {
      comfyuiError = `HTTP ${statsRes.status}: ${statsRes.statusText}`;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("fetch failed") || msg.includes("ECONNREFUSED")) {
      comfyuiError = "Connection refused — ComfyUI not started yet";
    } else if (msg.includes("TimeoutError") || msg.includes("timed out") || msg.includes("aborted")) {
      comfyuiError = "Timeout — pod may still be booting";
    } else if (msg.includes("ENOTFOUND") || msg.includes("getaddrinfo")) {
      comfyuiError = "DNS resolution failed — check Pod ID";
    } else {
      comfyuiError = msg;
    }
  }

  if (comfyui) {
    // Check ExpressionEditor
    try {
      const nodeRes = await proxyFetch(`${baseUrl}/object_info/ExpressionEditor`, {
        signal: AbortSignal.timeout(10000),
      });
      if (nodeRes.ok) {
        const data = await nodeRes.json();
        expressionEditor = !!data?.ExpressionEditor;
      }
    } catch {
      expressionEditor = false;
    }

    // Check ComfyUI-Manager
    try {
      const managerRes = await proxyFetch(`${baseUrl}/manager/queue_count`, {
        signal: AbortSignal.timeout(5000),
      });
      manager = managerRes.ok;
    } catch {
      manager = false;
    }
  }

  return NextResponse.json({
    comfyui,
    expressionEditor,
    manager,
    url: baseUrl,
    error: comfyuiError,
  });
}
