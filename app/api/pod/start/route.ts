import { NextRequest, NextResponse } from "next/server";
import { startPodWithFallback } from "@/lib/runpod";
import { trackActivity } from "@/lib/idle-tracker";

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
    const { pod, startedPodId, fallback } = await startPodWithFallback(apiKey, podId);
    // Start idle timer immediately so countdown shows in the header
    trackActivity(startedPodId);
    return NextResponse.json({ pod, startedPodId, fallback });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[pod/start] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
