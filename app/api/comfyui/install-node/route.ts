import { NextRequest, NextResponse } from "next/server";
import { comfyuiBaseUrl } from "@/lib/comfyui";
import { proxyFetch } from "@/lib/fetch";

const REPO_URL = "https://github.com/PowerHouseMan/ComfyUI-AdvancedLivePortrait";

// ComfyUI-Manager uses this format for custom node install
const NODE_INFO = {
  id: REPO_URL,
  title: "ComfyUI-AdvancedLivePortrait",
  reference: REPO_URL,
  files: [REPO_URL],
  install_type: "git-clone",
  description: "ExpressionEditor for LivePortrait",
  author: "PowerHouseMan",
  pip: [],
  js_path: "",
};

export async function POST(req: NextRequest) {
  const podId = req.headers.get("x-pod-id");
  if (!podId) {
    return NextResponse.json({ error: "Missing x-pod-id header" }, { status: 400 });
  }

  const baseUrl = comfyuiBaseUrl(podId);

  // Step 1: Check if ComfyUI-Manager is available
  let hasManager = false;
  try {
    const managerRes = await proxyFetch(`${baseUrl}/manager/queue_count`, {
      signal: AbortSignal.timeout(10000),
    });
    hasManager = managerRes.ok;
  } catch {
    // try alternative endpoint
    try {
      const altRes = await proxyFetch(`${baseUrl}/manager/reboot`, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });
      hasManager = altRes.status !== 404;
    } catch {
      hasManager = false;
    }
  }

  if (!hasManager) {
    return NextResponse.json(
      { error: "ComfyUI-Manager not found on this pod. Manual installation required." },
      { status: 404 }
    );
  }

  // Step 2: Install via ComfyUI-Manager
  try {
    const installRes = await proxyFetch(`${baseUrl}/customnode/install`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(NODE_INFO),
      signal: AbortSignal.timeout(120000), // 2 min — cloning + pip install can be slow
    });

    if (!installRes.ok) {
      const text = await installRes.text();
      return NextResponse.json(
        { error: `Install failed: ${installRes.status} ${text}` },
        { status: 500 }
      );
    }

    // Step 3: Restart ComfyUI via Manager
    try {
      await proxyFetch(`${baseUrl}/manager/reboot`, {
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      // reboot endpoint often kills the server before responding — this is expected
    }

    return NextResponse.json({
      success: true,
      message: "ExpressionEditor installed. ComfyUI is restarting (~60s).",
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Install failed: ${message}` }, { status: 500 });
  }
}
