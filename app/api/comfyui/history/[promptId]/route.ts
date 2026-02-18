import { NextRequest, NextResponse } from "next/server";
import { comfyuiBaseUrl } from "@/lib/comfyui";
import { proxyFetch } from "@/lib/fetch";

export async function GET(
  req: NextRequest,
  { params }: { params: { promptId: string } }
) {
  const podId = req.headers.get("x-pod-id");
  if (!podId) {
    return NextResponse.json({ error: "Missing x-pod-id header" }, { status: 400 });
  }

  try {
    const baseUrl = comfyuiBaseUrl(podId);
    const res = await proxyFetch(`${baseUrl}/history/${params.promptId}`);

    if (!res.ok) {
      return NextResponse.json(
        { error: `History failed: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
