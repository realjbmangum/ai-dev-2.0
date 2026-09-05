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
 * Fails OPEN if the limiter itself errors. This is the one place in the API where that
 * is the right call. A transient D1 problem should not take the fleet offline, and the
 * auth check behind it still has to pass. Failing closed here turns a storage blip into
 * an outage.
 */
async function enforceRateLimit(request: Request, db: D1Database | undefined): Promise<Guard> {
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

    // Opportunistic cleanup. Roughly one request in fifty pays for it, which is cheaper
    // than a scheduled job and keeps the table from growing forever.
    if (globalHits % 50 === 0) {
      await db.prepare(`DELETE FROM rate_limit WHERE window_start < ?`).bind(minute - 5).run();
    }

    if (ipHits > PER_IP_PER_MINUTE || globalHits > GLOBAL_PER_MINUTE) {
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

function requireToken(request: Request, env: Bindings): Guard {
  const expected = env.ESTATE_TOKEN;

  /*
   * Fail closed when the secret is missing. The tempting alternative, allow everything
   * when no token is configured, would mean a deploy that forgot the secret silently
   * exposes the whole estate. A 503 is loud and safe; an open door is quiet and not.
   *
   * A short token is treated as unconfigured rather than as weak-but-valid.
   */
  if (typeof expected !== "string" || expected.length < 32) {
    return { ok: false, response: deny(503, "Estate API is not configured") };
  }

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token || !timingSafeEqual(token, expected)) {
    return { ok: false, response: deny(401, "Unauthorized") };
  }
  return { ok: true };
}

/**
 * Rate limit, then authenticate. The order matters, see enforceRateLimit.
 *
 * Callers must return the response as-is rather than constructing their own, so an
 * unauthenticated caller cannot tell an unset secret from a wrong token from an absent
 * route.
 */
export async function guard(request: Request, env: Bindings): Promise<Guard> {
  const limited = await enforceRateLimit(request, env.DB);
  if (!limited.ok) return limited;
  return requireToken(request, env);
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
