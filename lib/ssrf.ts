import { isIP } from "net";
import { lookup } from "dns/promises";

// SSRF guard: block requests to private/reserved IP space so a public demo
// can't be used to reach internal services or cloud metadata endpoints.
//
// ponytail: blocks if ANY resolved address is private. A determined DNS-rebinding
// attacker still has a TOCTOU window between this lookup and fetch's own resolution.
// Closing it fully needs pinning the resolved IP into the socket (custom undici
// dispatcher). Acceptable for a public demo; upgrade there if it becomes a target.

function isPrivateV4(ip: string): boolean {
  const o = ip.split(".").map(Number);
  if (o.length !== 4 || o.some((n) => Number.isNaN(n) || n < 0 || n > 255))
    return true;
  const [a, b] = o;
  if (a === 0 || a === 127) return true; // this-host, loopback
  if (a === 10) return true; // private
  if (a === 169 && b === 254) return true; // link-local + metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback, unspecified
  // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded v4
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateV4(mapped[1]);
  // Allow only global unicast (2000::/3); everything else (fc00::/7 ULA,
  // fe80::/10 link-local, ff00::/8 multicast) is treated as private.
  const first = parseInt(lower.split(":")[0] || "0", 16);
  return first < 0x2000 || first > 0x3fff;
}

export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isPrivateV4(ip);
  if (v === 6) return isPrivateV6(ip);
  return true; // unparseable -> unsafe
}

/** Throws if the hostname resolves to (or is) a private/reserved address. */
export async function assertPublicHost(hostname: string): Promise<void> {
  // Literal IP in the URL
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("Indirizzo IP privato non consentito.");
    return;
  }
  let addrs;
  try {
    addrs = await lookup(hostname, { all: true });
  } catch {
    throw new Error("Host non risolvibile.");
  }
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) {
    throw new Error("L'host punta a un indirizzo privato/interno.");
  }
}

// ponytail: inline self-check. Run with `npx tsx lib/ssrf.ts`.
function demo() {
  const assert = (c: boolean, m: string) => {
    if (!c) throw new Error("FAIL: " + m);
  };
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fe80::1", "fc00::1"])
    assert(isPrivateIp(ip), `${ip} should be private`);
  for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"])
    assert(!isPrivateIp(ip), `${ip} should be public`);
  assert(isPrivateIp("::ffff:127.0.0.1"), "ipv4-mapped loopback is private");
  assert(isPrivateIp("not-an-ip"), "garbage is unsafe");
  console.log("ssrf self-check OK");
}

if (require.main === module) demo();
