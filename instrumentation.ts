export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { syncSSHKeys } = await import("./instrumentation-node");
    await syncSSHKeys();
  }
}
