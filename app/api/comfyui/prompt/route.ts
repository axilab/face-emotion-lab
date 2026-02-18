import { NextRequest, NextResponse } from "next/server";
import { comfyuiBaseUrl } from "@/lib/comfyui";
import { proxyFetch } from "@/lib/fetch";
import { trackActivity } from "@/lib/idle-tracker";

export async function POST(req: NextRequest) {
  const podId = req.headers.get("x-pod-id");
  if (!podId) {
    return NextResponse.json({ error: "Missing x-pod-id header" }, { status: 400 });
  }

  try {
    trackActivity(podId);
    const body = await req.json();
    const baseUrl = comfyuiBaseUrl(podId);

    const res = await proxyFetch(`${baseUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let text = "";
      try { text = await res.text(); } catch {}
      // Don't include Cloudflare HTML error pages in the response
      const isHtml = text.includes("<!DOCTYPE") || text.includes("<html");
      const errorMsg = isHtml
        ? `ComfyUI вернул ${res.status} — сервер временно недоступен`
        : `Prompt failed: ${res.status} ${text.slice(0, 200)}`;
      return NextResponse.json({ error: errorMsg }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
