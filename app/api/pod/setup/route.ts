import { NextRequest, NextResponse } from "next/server";
import { getPodSSHInfo } from "@/lib/runpod";
import { sshExec, waitForSSH } from "@/lib/ssh";

export const maxDuration = 300; // 5 minutes — this is a long-running setup

const COMFYUI_PATH = "/workspace/runpod-slim/ComfyUI";
const PLUGIN_DIR = `${COMFYUI_PATH}/custom_nodes/ComfyUI-AdvancedLivePortrait`;
const REPO_URL = "https://github.com/PowerHouseMan/ComfyUI-AdvancedLivePortrait.git";
const PIP_TARGET = "/workspace/pip_packages";

/**
 * POST /api/pod/setup
 *
 * Full automated setup of a RunPod pod via SSE streaming.
 *
 * Tested pipeline (real timings on RTX A6000):
 * 1. Get SSH info (~12s from pod create)
 * 2. Wait for SSH (~18s)
 * 3. Wait for ComfyUI API (~72s)
 * 4. Check ExpressionEditor → fast path if already loaded
 * 5. Check repo + pip_packages state
 *    5a. Clone repo if missing (~4s)
 * 6. pip install --target /workspace/pip_packages (~30s, skipped if exists)
 * 6a. Create .pth file in site-packages → any Python process sees /workspace/pip_packages
 * 7. Restart ComfyUI with PYTHONPATH (pkill + nohup/disown)
 * 8. Create /workspace/pre_start.sh for future pod restarts (includes .pth creation)
 * 9. Wait for ExpressionEditor (~15s)
 *
 * Persistent pip packages: installed to /workspace/pip_packages (survives pod restart).
 * .pth file in site-packages ensures packages are visible to ANY Python process,
 * including template-auto-restarted ComfyUI (which doesn't have PYTHONPATH set).
 *
 * SSE events:
 * - event: log    — { message: string }
 * - event: done   — { success: true, message: string, alreadyInstalled?: boolean }
 * - event: error  — { error: string }
 *
 * Headers: x-runpod-key, x-pod-id
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.RUNPOD_API_KEY;
  const podId = req.headers.get("x-pod-id");

  if (!apiKey) {
    return NextResponse.json({ error: "RUNPOD_API_KEY not configured" }, { status: 500 });
  }
  if (!podId) {
    return NextResponse.json({ error: "Missing x-pod-id header" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const log = (msg: string) => {
        console.log(`[pod-setup ${podId}] ${msg}`);
        send("log", { message: msg });
      };

      /**
       * Run SSH command with automatic retry on connection errors.
       * SSH can be flaky during pod startup — this handles transient failures.
       */
      const sshWithRetry = async (
        host: string,
        port: number,
        command: string,
        timeoutMs: number,
        retries = 2,
        retryDelayMs = 5000
      ): Promise<string> => {
        let lastError: Error | null = null;
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            return await sshExec(host, port, command, timeoutMs);
          } catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e));
            if (attempt < retries) {
              log(`SSH error, retrying in ${retryDelayMs / 1000}s... (${lastError.message})`);
              await new Promise((r) => setTimeout(r, retryDelayMs));
            }
          }
        }
        throw lastError;
      };

      try {
        // === Step 1: Get SSH info ===
        log("Getting SSH connection info...");
        let sshInfo: { host: string; port: number } | null = null;

        for (let attempt = 0; attempt < 12; attempt++) {
          sshInfo = await getPodSSHInfo(apiKey, podId);
          if (sshInfo) break;
          log(`Waiting for pod networking... (attempt ${attempt + 1}/12)`);
          await new Promise((r) => setTimeout(r, 10000));
        }

        if (!sshInfo) {
          log("ERROR: Could not get SSH info after 2 minutes");
          send("error", { error: "Could not get SSH connection info. Pod may not be fully started." });
          return;
        }

        log(`SSH endpoint: ${sshInfo.host}:${sshInfo.port}`);

        // === Step 2: Wait for SSH ===
        log("Waiting for SSH...");
        const sshReady = await waitForSSH(sshInfo.host, sshInfo.port, 180000, (attempt, error) => {
          log(`SSH not ready (attempt ${attempt}, ${error})`);
        });
        if (!sshReady) {
          log("ERROR: SSH not available after 3 minutes");
          send("error", { error: "SSH not available. Pod may still be booting." });
          return;
        }
        log("SSH ready");

        // === Step 3: Wait for ComfyUI ===
        // ComfyUI HTTP server starts listening ONLY AFTER all custom nodes are loaded.
        // Check: process alive + curl API (ss/netstat may not exist on all pods).
        log("Waiting for ComfyUI...");
        let comfyuiReady = false;
        for (let attempt = 0; attempt < 24; attempt++) {
          try {
            const result = await sshExec(
              sshInfo.host,
              sshInfo.port,
              `CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 5 http://localhost:8188/system_stats 2>/dev/null || echo '000'); echo "HTTP=$CODE"`,
              15000
            );
            const codeMatch = result.match(/HTTP=(\d+)/);
            const code = codeMatch ? codeMatch[1] : "000";
            if (code === "200") {
              comfyuiReady = true;
              break;
            }
            const detail = code === "000" ? "connection refused" : `HTTP ${code}`;
            log(`ComfyUI not ready (attempt ${attempt + 1}/24, ${detail})`);
          } catch {
            log(`ComfyUI not ready (attempt ${attempt + 1}/24, SSH error)`);
          }
          await new Promise((r) => setTimeout(r, 8000));
        }

        if (!comfyuiReady) {
          let logSnippet = "";
          try {
            logSnippet = await sshExec(sshInfo.host, sshInfo.port, `tail -10 /tmp/comfyui.log 2>/dev/null || echo '(no log)'`, 10000);
          } catch { /* ignore */ }
          log("ERROR: ComfyUI not available after ~3 minutes");
          if (logSnippet.trim()) log(`ComfyUI log:\n${logSnippet.trim().slice(0, 500)}`);
          send("error", { error: "ComfyUI did not start. Check pod logs." });
          return;
        }
        log("ComfyUI ready");

        // === Step 4: Check ExpressionEditor ===
        log("Checking ExpressionEditor...");
        const checkResult = await sshWithRetry(
          sshInfo.host,
          sshInfo.port,
          `curl -s -m 10 http://localhost:8188/object_info/ExpressionEditor 2>/dev/null | python3 -c 'import sys,json; d=json.load(sys.stdin); print("EXISTS" if "ExpressionEditor" in d else "NOT_FOUND")' 2>/dev/null || echo 'NOT_FOUND'`,
          20000,
          2,
          3000
        );

        if (checkResult.includes("EXISTS")) {
          log("ExpressionEditor already installed!");
          send("done", {
            success: true,
            message: "Pod is ready. ExpressionEditor already installed.",
            alreadyInstalled: true,
          });
          return;
        }

        log("ExpressionEditor not found in ComfyUI. Checking installation state...");

        // === Step 5: Check existing state ===
        const stateCheck = await sshWithRetry(
          sshInfo.host,
          sshInfo.port,
          `echo "REPO:$(test -d ${PLUGIN_DIR} && echo OK || echo MISSING)" && echo "PIP:$(test -d ${PIP_TARGET}/dill && echo OK || echo MISSING)"`,
          15000
        );

        const repoExists = stateCheck.includes("REPO:OK");
        const pipExists = stateCheck.includes("PIP:OK");

        if (repoExists && pipExists) {
          log("Плагин установлен, но не активен (перезапуск пода). Реактивация...");
        } else {
          log(`State: repo=${repoExists ? "exists" : "missing"}, pip_packages=${pipExists ? "exists" : "missing"}`);
        }

        // === Step 5a: Clone repo (if needed) ===
        if (!repoExists) {
          log("Cloning ComfyUI-AdvancedLivePortrait...");
          const cloneResult = await sshWithRetry(
            sshInfo.host,
            sshInfo.port,
            `cd ${COMFYUI_PATH}/custom_nodes && git clone ${REPO_URL} 2>&1 && echo 'CLONE_OK'`,
            120000
          );

          if (!cloneResult.includes("CLONE_OK") && !cloneResult.includes("already exists")) {
            log(`Clone output: ${cloneResult.slice(0, 300)}`);
            send("error", { error: `Failed to clone ExpressionEditor repo: ${cloneResult.slice(0, 200)}` });
            return;
          }
          log("Repository cloned");
        } else {
          log("Repository already exists, skipping clone");
        }

        // === Step 6: Install pip dependencies to persistent storage (if needed) ===
        // Without pip install, the plugin fails with: ModuleNotFoundError: No module named 'dill'
        // Using --target to install into /workspace/ which survives pod restarts.
        if (!pipExists) {
          log("Installing Python dependencies to persistent storage...");
          const pipResult = await sshWithRetry(
            sshInfo.host,
            sshInfo.port,
            `pip install --target ${PIP_TARGET} -r ${PLUGIN_DIR}/requirements.txt 2>&1 | tail -3 && echo 'PIP_OK'`,
            180000
          );

          if (!pipResult.includes("PIP_OK")) {
            log(`pip output: ${pipResult.slice(-300)}`);
            send("error", { error: "Failed to install Python dependencies." });
            return;
          }
          log("Dependencies installed to persistent storage");
        } else {
          log("pip packages already in persistent storage, skipping install");
        }

        // === Step 6a: Create .pth file so ANY Python process sees persistent packages ===
        // .pth file is on container disk (lost on pod restart), but we recreate it every setup.
        // This is more robust than PYTHONPATH — works even if template auto-restarts ComfyUI.
        log("Registering persistent packages in Python path...");
        await sshWithRetry(
          sshInfo.host,
          sshInfo.port,
          `python3 -c "import site; open(site.getsitepackages()[0] + '/workspace_pip.pth', 'w').write('/workspace/pip_packages\\n')"`,
          15000
        );

        // === Step 7: Restart ComfyUI with PYTHONPATH ===
        // pkill does NOT drop SSH (tested). nohup without disown hangs SSH (tested).
        log("Restarting ComfyUI with persistent packages...");
        await sshWithRetry(
          sshInfo.host,
          sshInfo.port,
          `pkill -f 'python.*main.py' || true`,
          10000
        );

        await new Promise((r) => setTimeout(r, 3000));

        await sshWithRetry(
          sshInfo.host,
          sshInfo.port,
          `bash -c 'cd ${COMFYUI_PATH} && PYTHONPATH=${PIP_TARGET}:$PYTHONPATH nohup python3 main.py --listen 0.0.0.0 --port 8188 > /tmp/comfyui.log 2>&1 & disown; echo STARTED'`,
          30000
        );
        log("ComfyUI restart initiated");

        // === Step 8: Create pre_start.sh for future pod restarts ===
        try {
          await sshWithRetry(
            sshInfo.host,
            sshInfo.port,
            `cat > /workspace/pre_start.sh << 'PRESTART'
#!/bin/bash
if [ -d /workspace/pip_packages ]; then
  python3 -c "import site; open(site.getsitepackages()[0] + '/workspace_pip.pth', 'w').write('/workspace/pip_packages\\n')"
  export PYTHONPATH=/workspace/pip_packages:$PYTHONPATH
fi
PRESTART
chmod +x /workspace/pre_start.sh`,
            10000
          );
          log("Created /workspace/pre_start.sh for future auto-starts");
        } catch {
          log("Warning: could not create pre_start.sh (non-critical)");
        }

        // === Step 9: Wait for ExpressionEditor with diagnostics ===
        // Check: process alive + curl API + object_info for ExpressionEditor node.
        log("Waiting for ExpressionEditor to load...");
        let nodeReady = false;

        for (let attempt = 0; attempt < 30; attempt++) {
          await new Promise((r) => setTimeout(r, 5000));

          let checkResult = "";
          try {
            checkResult = await sshExec(
              sshInfo.host,
              sshInfo.port,
              [
                `PROC=$(pgrep -f 'python.*main.py' > /dev/null 2>&1 && echo 'Y' || echo 'N')`,
                `API='N'; NODE='N'`,
                `CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 5 http://localhost:8188/system_stats 2>/dev/null || echo '000')`,
                `[ "$CODE" = "200" ] && API='Y'`,
                `if [ "$API" = "Y" ]; then`,
                `  curl -s -m 5 http://localhost:8188/object_info/ExpressionEditor 2>/dev/null | python3 -c 'import sys,json; d=json.load(sys.stdin); print("EXISTS" if "ExpressionEditor" in d else "WAIT")' 2>/dev/null | grep -q EXISTS && NODE='Y'`,
                `fi`,
                `echo "PROC=$PROC API=$API NODE=$NODE"`,
              ].join("\n"),
              20000
            );
          } catch {
            log(`SSH error on attempt ${attempt + 1}, retrying...`);
            continue;
          }

          const proc = checkResult.includes("PROC=Y");
          const api = checkResult.includes("API=Y");
          const node = checkResult.includes("NODE=Y");

          if (node) {
            nodeReady = true;
            break;
          }

          if (!proc) {
            log(`ComfyUI process not running (attempt ${attempt + 1}), restarting...`);
            try {
              await sshExec(
                sshInfo.host,
                sshInfo.port,
                `bash -c 'cd ${COMFYUI_PATH} && PYTHONPATH=${PIP_TARGET}:$PYTHONPATH nohup python3 main.py --listen 0.0.0.0 --port 8188 > /tmp/comfyui.log 2>&1 & disown; echo STARTED'`,
                30000
              );
            } catch { /* ignore */ }
            continue;
          }

          const detail = !api
            ? "API not responding yet"
            : "API ready, ExpressionEditor not loaded yet";
          log(`ComfyUI starting up... (attempt ${attempt + 1}, ${detail})`);

          // Check for IMPORT FAILED early — if API is up but node not loaded
          if (api && !node && (attempt === 3 || attempt === 8 || attempt === 15)) {
            try {
              const logCheck = await sshExec(
                sshInfo.host,
                sshInfo.port,
                `grep 'IMPORT FAILED.*AdvancedLivePortrait' /tmp/comfyui.log 2>/dev/null && echo 'IMPORT_FAILED' || echo 'NO_FAILURE'`,
                10000
              );
              if (logCheck.includes("IMPORT_FAILED")) {
                const errorLog = await sshExec(
                  sshInfo.host,
                  sshInfo.port,
                  `grep -A3 'Cannot import.*AdvancedLivePortrait' /tmp/comfyui.log 2>/dev/null | head -5`,
                  10000
                );
                log(`Plugin import failed: ${errorLog.trim().slice(0, 200)}`);
                send("error", { error: `ExpressionEditor plugin failed to load: ${errorLog.trim().slice(0, 200)}` });
                return;
              }
            } catch { /* ignore */ }
          }
        }

        if (!nodeReady) {
          // Final diagnostic
          let logSnippet = "";
          try {
            logSnippet = await sshExec(
              sshInfo.host,
              sshInfo.port,
              `tail -15 /tmp/comfyui.log 2>/dev/null || echo '(no log)'`,
              10000
            );
          } catch { /* ignore */ }

          log("ERROR: ExpressionEditor not available after restart");
          if (logSnippet.trim()) {
            log(`ComfyUI log:\n${logSnippet.trim().slice(0, 500)}`);
          }
          send("error", { error: "ExpressionEditor was installed but failed to load after restart." });
          return;
        }

        log("ExpressionEditor ready!");
        send("done", {
          success: true,
          message: "ExpressionEditor installed and ready.",
          alreadyInstalled: false,
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";
        console.error(`[pod-setup ${podId}] ERROR: ${message}`);
        send("error", { error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
