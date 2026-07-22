import net from "node:net";

const BLOCKED_HOSTNAMES = new Set(["localhost"]);

/**
 * Blocks the obvious SSRF cases for tenant-supplied webhook URLs: loopback,
 * private/link-local IP ranges, and non-http(s) schemes. This is a basic
 * literal-IP/hostname check, not full DNS-rebinding protection — acceptable
 * for v1, worth revisiting (e.g. resolve-then-pin the IP at request time)
 * before this is exposed to untrusted third-party tenants at scale.
 */
export function isSafeWebhookUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) return false;

  if (net.isIP(hostname)) {
    return !isPrivateOrReservedIp(hostname);
  }

  return true;
}

function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 127) return true; // loopback
    if (a === 10) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata)
    if (a === 0) return true;
    return false;
  }

  // IPv6: block loopback (::1), unique local (fc00::/7), and link-local (fe80::/10).
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }
  return false;
}
