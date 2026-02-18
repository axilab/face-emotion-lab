import { NextResponse } from "next/server";
import { queryGpuTypes } from "@/lib/runpod";

export async function GET() {
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RUNPOD_API_KEY not configured" }, { status: 500 });
  }

  try {
    const gpuTypes = await queryGpuTypes(apiKey);
    return NextResponse.json({ gpuTypes });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
