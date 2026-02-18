import { EnvHttpProxyAgent } from "undici";

/**
 * Proxy-aware fetch for server-side API routes.
 *
 * Node.js built-in fetch() does NOT respect HTTP_PROXY/HTTPS_PROXY env vars.
 * This wrapper uses undici's EnvHttpProxyAgent which reads proxy config from
 * environment variables automatically.
 *
 * If no proxy is configured, it behaves like regular fetch.
 */

let _dispatcher: EnvHttpProxyAgent | undefined;

function getDispatcher(): EnvHttpProxyAgent {
  if (!_dispatcher) {
    _dispatcher = new EnvHttpProxyAgent();
  }
  return _dispatcher;
}

export function proxyFetch(
  url: string | URL,
  init?: RequestInit
): Promise<Response> {
  return fetch(url, {
    ...init,
    // @ts-expect-error -- dispatcher is undici-specific, not in standard RequestInit
    dispatcher: getDispatcher(),
  });
}
