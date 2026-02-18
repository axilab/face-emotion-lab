import { NextRequest, NextResponse } from "next/server";
import { stopPod } from "@/lib/runpod";
import { clearTracking } from "@/lib/idle-tracker";

export async function POST(req: NextRequest) {
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RUNPOD_API_KEY not configured" }, { status: 500 });
  }

  try {
    const { podId } = await req.json();
    if (!podId) {
      return NextResponse.json({ error: "Missing podId" }, { status: 400 });
    }
    clearTracking(podId);
    const result = await stopPod(apiKey, podId);
    return NextResponse.json({ pod: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
