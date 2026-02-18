import { Client } from "ssh2";
import { execSync } from "child_process";
import { readFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const SSH_DIR = path.join(process.cwd(), ".tmp", "ssh");
const KEY_PATH = path.join(SSH_DIR, "fel_key");
const KEY_PUB_PATH = path.join(SSH_DIR, "fel_key.pub");

/**
 * Ensure SSH key pair exists. Returns public key string.
 * Key is generated once and reused for all pods.
 */
export function ensureSSHKey(): string {
  if (!existsSync(KEY_PATH)) {
    mkdirSync(SSH_DIR, { recursive: true });
    execSync(
      `ssh-keygen -t ed25519 -f "${KEY_PATH}" -N "" -C "faceemotionlab" 2>/dev/null`
    );
  }
  return readFileSync(KEY_PUB_PATH, "utf-8").trim();
}

/**
 * Get the public key if it exists, or generate and return it.
 */
export function getPublicKey(): string {
  return ensureSSHKey();
}

function getPrivateKey(): Buffer {
  ensureSSHKey();
  return readFileSync(KEY_PATH);
}

/**
 * Execute a command on a remote host via SSH.
 * Returns stdout+stderr combined output.
 */
export async function sshExec(
  host: string,
  port: number,
  command: string,
  timeoutMs: number = 60000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        conn.end();
        reject(new Error(`SSH command timed out after ${timeoutMs / 1000}s`));
      }
    }, timeoutMs);

    conn.on("ready", () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          settled = true;
          conn.end();
          reject(err);
          return;
        }
        stream.on("data", (data: Buffer) => {
          output += data.toString();
        });
        stream.stderr.on("data", (data: Buffer) => {
          output += data.toString();
        });
        stream.on("close", () => {
          clearTimeout(timer);
          settled = true;
          conn.end();
          resolve(output);
        });
      });
    });

    conn.on("error", (err) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    conn.connect({
      host,
      port,
      username: "root",
      privateKey: getPrivateKey(),
      readyTimeout: 15000,
      algorithms: {
        serverHostKey: [
          "ssh-ed25519",
          "ecdsa-sha2-nistp256",
          "ecdsa-sha2-nistp384",
          "ecdsa-sha2-nistp521",
          "rsa-sha2-512",
          "rsa-sha2-256",
          "ssh-rsa",
        ],
      },
    });
  });
}

/**
 * Wait until SSH is available on the given host:port.
 */
export async function waitForSSH(
  host: string,
  port: number,
  timeoutMs: number = 300000
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const result = await sshExec(host, port, "echo SSH_OK", 10000);
      if (result.includes("SSH_OK")) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 10000));
  }
  return false;
}
