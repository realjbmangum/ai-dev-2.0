/*
 * Bearer gate for the estate API.
 *
 * Lifted almost whole from directory-machine's automation-auth.ts, which is the most
 * carefully reasoned version of this in the estate. Scheduled agents run headless: no
 * browser session, so no cookie auth, and no access to Brian's Mac, so no wrangler and
 * therefore no direct D1. This API is the bridge, so it is also the entire attack
 * surface. Everything here fails closed.
 */

import type { Bindings } from "../types";

/** Same shape for every rejection, so responses never become an oracle. */
function deny(status: number, message: string, extra?: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Nothing here should ever be cached or indexed.
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

/**
 * Length-safe, constant-time comparison.
 *
 * A plain === on secrets leaks length and prefix through timing. Length is compared
 * first because a differing length is not a secret worth hiding, and the loop below
 * requires equal lengths to be meaningful.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/*
 * Two ceilings, both fixed-window per minute.
 *
 * PER_IP catches a stolen token driven from one machine. GLOBAL is the backstop for the
 * case PER_IP misses, the same token driven from many addresses, and it also caps the
 * damage a runaway agent can do on its own.
 */
const PER_IP_PER_MINUTE = 90;
const GLOBAL_PER_MINUTE = 300;

type Guard = { ok: true } | { ok: false; response: Response };

/**
 * Enforce both ceilings. Runs BEFORE authentication on purpose: an unauthenticated
 * flood should be stopped at the door rather than allowed to pay for a token
 * comparison first, and probing for a valid token is exactly the traffic this blunts.
 *
 * Pruning old windows happens in scheduled(), not here. It used to be gated on
 * `globalHits % 50`, which only ever fires above 50 requests a minute; a quiet fleet
 * never reached it and the table grew forever.
 *
 * Fails OPEN if the limiter itself errors. This is the one place in the API where that
 * is the right call. A transient D1 problem should not take the fleet offline, and the
 * auth check behind it still has to pass. Failing closed here turns a storage blip into
 * an outage.
 */
async function enforceRateLimit(
  request: Request,
  db: D1Database | undefined,
  adminToken: string | undefined
): Promise<Guard> {
  if (!db) return { ok: true };
  try {
    const minute = Math.floor(Date.now() / 60000);
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";

    const bump = async (bucket: string): Promise<number> => {
      const row = await db
        .prepare(
          `INSERT INTO rate_limit (bucket_key, hits, window_start)
           VALUES (?, 1, ?)
           ON CONFLICT(bucket_key) DO UPDATE SET hits = hits + 1
           RETURNING hits`
        )
        .bind(bucket, minute)
        .first<{ hits: number }>();
      return row?.hits ?? 0;
    };

    const ipHits = await bump(`ip:${ip}:${minute}`);
    const globalHits = await bump(`global:${minute}`);

    /*
     * The admin token is exempt from the global ceiling.
     *
     * The global bucket is a single shared counter, so anyone who can reach the
     * hostname could pin it above 300 from a handful of addresses and lock out every
     * agent AND the desk AND any attempt to fix it. Per-IP still applies, so this is
     * not a bypass; it only means the operator cannot be locked out of their own estate
     * by unauthenticated traffic.
     *
     * Checked here rather than after authenticate() because the whole point of running
     * the limiter first is to refuse a flood before paying for a token comparison.
     */
    const auth = request.headers.get("authorization") ?? "";
    const presented = auth.replace(/^Bearer\s+/i, "");
    const isAdmin =
      typeof adminToken === "string" &&
      adminToken.length >= 32 &&
      timingSafeEqual(presented, adminToken);

    if (ipHits > PER_IP_PER_MINUTE || (!isAdmin && globalHits > GLOBAL_PER_MINUTE)) {
      const retryAfter = 60 - (Math.floor(Date.now() / 1000) % 60);
      const res = deny(429, "Rate limit exceeded", { retry_after_seconds: retryAfter });
      res.headers.set("Retry-After", String(retryAfter));
      return { ok: false, response: res };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

/** Lowercase hex SHA-256, the form stored in registry.token_sha256. */
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Who is calling.
 *
 * `admin` is Brian, the desk, or a cockpit session, holding ESTATE_TOKEN. `key` is a
 * single agent, holding its own token, and it may only ever act as itself.
 *
 * With one shared token this distinction did not exist, which meant any agent could
 * report a run as any other agent. Attribution in agent_runs was a convention, and the
 * watcher's whole picture rested on it. Now the token IS the identity.
 */
export type Identity = { admin: boolean; key: string | null };

async function authenticate(request: Request, env: Bindings): Promise<
  { ok: true; identity: Identity } | { ok: false; response: Response }
> {
  const admin = env.ESTATE_TOKEN;

  /*
   * Fail closed when the admin secret is missing. The tempting alternative, allow
   * everything when nothing is configured, would mean a deploy that forgot the secret
   * silently exposes the whole estate. A 503 is loud and safe; an open door is quiet
   * and not. A short token is treated as unconfigured, never as weak-but-valid.
   */
  if (typeof admin !== "string" || admin.length < 32) {
    return { ok: false, response: deny(503, "Estate API is not configured") };
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, response: deny(401, "Unauthorized") };

  // Admin first, and in constant time. A plain === here would leak the admin secret's
  // length and prefix through response timing.
  if (timingSafeEqual(token, admin)) {
    return { ok: true, identity: { admin: true, key: null } };
  }

  /*
   * Otherwise look the token up by hash. Only the hash is ever stored, so this database
   * never holds a value that could impersonate its own agents, and a dump of the
   * registry is not a set of credentials.
   *
   * The lookup itself does not need to be constant-time: the attacker controls the full
   * token, the comparison happens on a 256-bit digest, and no prefix information is
   * recoverable from how long an index probe takes.
   */
  /*
   * The same 32-character floor the admin token gets. Without it any non-empty string
   * was hashed and looked up, so token quality rested entirely on whoever issued it, and
   * a single unsalted SHA-256 of a memorable string is offline-crackable. It also means
   * a garbage token no longer costs a D1 read.
   */
  if (token.length < 32) return { ok: false, response: deny(401, "Unauthorized") };

  const hash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT key, status FROM registry WHERE token_sha256 = ?`
  )
    .bind(hash)
    .first<{ key: string; status: string }>();

  /*
   * Allowlist, not denylist, and the same 401 either way.
   *
   * This was written as "reject retired or paused", which let a `planned` token
   * authenticate fully. That is the worst of both worlds: Watchy only evaluates rows
   * with status 'active', so a planned agent was live AND invisible. It also broke
   * revocation, because the API's own error message tells an operator to use 'planned'
   * while working out a cadence, and doing that would have left the token working.
   *
   * The response is identical to an unknown token on purpose. A distinguishable 403
   * confirmed that a presented token matched a real row, which turns a blind guess into
   * a confirmable one.
   */
  if (!row || row.status !== "active") {
    return { ok: false, response: deny(401, "Unauthorized") };
  }

  return { ok: true, identity: { admin: false, key: row.key } };
}

/**
 * Rate limit, then authenticate. The order matters, see enforceRateLimit.
 *
 * Callers must return the response as-is rather than constructing their own, so an
 * unauthenticated caller cannot tell an unset secret from a wrong token from an absent
 * route.
 */
export async function guard(
  request: Request,
  env: Bindings
): Promise<{ ok: true; identity: Identity } | { ok: false; response: Response }> {
  const limited = await enforceRateLimit(request, env.DB, env.ESTATE_TOKEN);
  if (!limited.ok) return limited;
  return authenticate(request, env);
}

/** Mint a token's stored form. Used by the registry route when issuing one. */
export async function hashToken(token: string): Promise<string> {
  return sha256Hex(token);
}

/**
 * Read a JSON body with a hard cap.
 *
 * An agent is an automated client and can be wrong at speed; an unbounded body on a
 * Worker is a cheap way to burn CPU. content-length is checked first, then the actual
 * text length, so a lying header does not help.
 */
export async function readJsonBody<T>(request: Request, maxBytes = 64 * 1024): Promise<T> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new Error("body too large");
  const text = await request.text();
  if (text.length > maxBytes) throw new Error("body too large");
  return JSON.parse(text) as T;
}
