import { NextResponse } from "next/server";
import { queryPods, queryGpuTypes } from "@/lib/runpod";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RUNPOD_API_KEY not configured" }, { status: 500 });
  }

  try {
    // Fetch pods and GPU types in parallel
    const [pods, gpuTypes] = await Promise.all([
      queryPods(apiKey),
      queryGpuTypes(apiKey).catch(() => []),
    ]);

    // Build a map: gpuDisplayName -> available
    const availabilityMap = new Map<string, boolean>();
    for (const gpu of gpuTypes) {
      availabilityMap.set(gpu.displayName, gpu.communityCloud || gpu.secureCloud);
    }

    // Enrich pods with GPU availability
    const enrichedPods = pods.map((pod: { machine?: { gpuDisplayName?: string } }) => ({
      ...pod,
      gpuAvailable: pod.machine?.gpuDisplayName
        ? availabilityMap.get(pod.machine.gpuDisplayName) ?? null
        : null,
    }));

    return NextResponse.json({ pods: enrichedPods });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
