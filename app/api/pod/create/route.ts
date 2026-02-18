import { NextRequest, NextResponse } from "next/server";
import { createPod } from "@/lib/runpod";
import { getPublicKey } from "@/lib/ssh";

export async function POST(req: NextRequest) {
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RUNPOD_API_KEY not configured" }, { status: 500 });
  }

  try {
    const { podName, gpuType } = await req.json();
    const publicKey = getPublicKey();
    const pod = await createPod(apiKey, podName || "emotion-gen", gpuType || "NVIDIA RTX A6000", publicKey);
    return NextResponse.json({ pod });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
