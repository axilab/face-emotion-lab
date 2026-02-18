import { NextRequest, NextResponse } from "next/server";
import { wasAutoStopped, getIdleInfo, extendTime, trackActivity } from "@/lib/idle-tracker";

export async function GET(req: NextRequest) {
  const podId = req.headers.get("x-pod-id");
  if (!podId) {
    return NextResponse.json({ error: "Missing x-pod-id header" }, { status: 400 });
  }

  // Auto-init idle timer if not yet started for this pod.
  // This handles cases where the pod was started externally (RunPod UI)
  // or the server restarted while the pod was running.
  let idle = getIdleInfo(podId);
  if (!idle) {
    trackActivity(podId);
    idle = getIdleInfo(podId);
  }

  return NextResponse.json({
    wasAutoStopped: wasAutoStopped(podId),
    idle,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { podId, extraMs } = await req.json();
    if (!podId || typeof extraMs !== "number" || extraMs <= 0) {
      return NextResponse.json({ error: "Invalid podId or extraMs" }, { status: 400 });
    }

    const ok = extendTime(podId, extraMs);
    if (!ok) {
      return NextResponse.json({ error: "No active timer for this pod" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, idle: getIdleInfo(podId) });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
