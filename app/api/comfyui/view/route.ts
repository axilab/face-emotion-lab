import { NextRequest, NextResponse } from "next/server";
import { comfyuiBaseUrl } from "@/lib/comfyui";
import { proxyFetch } from "@/lib/fetch";

export async function GET(req: NextRequest) {
  const podId = req.headers.get("x-pod-id");
  if (!podId) {
    return NextResponse.json({ error: "Missing x-pod-id header" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const filename = searchParams.get("filename");
  const subfolder = searchParams.get("subfolder") || "";
  const type = searchParams.get("type") || "output";

  if (!filename) {
    return NextResponse.json({ error: "Missing filename" }, { status: 400 });
  }

  try {
    const baseUrl = comfyuiBaseUrl(podId);
    const res = await proxyFetch(
      `${baseUrl}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(type)}`
    );

    if (!res.ok) {
      return NextResponse.json({ error: `View failed: ${res.status}` }, { status: res.status });
    }

    return new Response(res.body, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "image/png",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
