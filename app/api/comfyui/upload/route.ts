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
    const formData = await req.formData();
    const baseUrl = comfyuiBaseUrl(podId);

    const res = await proxyFetch(`${baseUrl}/upload/image`, {
      method: "POST",
      body: formData as unknown as BodyInit,
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Upload failed: ${res.status} ${text}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
