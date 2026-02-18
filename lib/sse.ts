/**
 * Parse SSE stream from a fetch Response.
 * Calls onLog for each "log" event, returns final result on "done" or throws on "error".
 */
export async function readSetupSSE(
  res: Response,
  onLog?: (message: string) => void
): Promise<{ success: boolean; message: string; alreadyInstalled?: boolean }> {
  if (!res.body) {
    throw new Error("No response body");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  let result: { success: boolean; message: string; alreadyInstalled?: boolean } | null = null;
  let error: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE messages are separated by double newlines
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      if (!part.trim()) continue;

      let eventType = "message";
      let data = "";

      for (const line of part.split("\n")) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7);
        } else if (line.startsWith("data: ")) {
          data = line.slice(6);
        }
      }

      if (!data) continue;

      try {
        const parsed = JSON.parse(data);

        if (eventType === "log") {
          onLog?.(parsed.message);
        } else if (eventType === "done") {
          result = parsed;
        } else if (eventType === "error") {
          error = parsed.error;
        }
      } catch {
        // skip malformed JSON
      }
    }
  }

  if (error) {
    throw new Error(error);
  }

  if (!result) {
    throw new Error("Setup stream ended without completion");
  }

  return result;
}
