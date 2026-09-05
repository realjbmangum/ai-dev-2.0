-- 0004 - rate limiting for the estate API, backed by D1 rather than KV.
--
-- Lifted from directory-machine (2026-08-31-rate-limit.sql). Fixed window rather than
-- sliding: it costs a single upsert per request, and the failure mode (up to 2x the
-- limit across a window boundary) is irrelevant at these volumes.
--
-- The limiter runs BEFORE authentication, so this table is written by unauthenticated
-- traffic by design. That is the point: an unauthenticated flood gets stopped at the
-- door rather than being allowed to pay for a token comparison first.

CREATE TABLE IF NOT EXISTS rate_limit (
  bucket_key   TEXT PRIMARY KEY,   -- scope + identity + window, e.g. "ip:1.2.3.4:29334981"
  hits         INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL    -- unix minute, for cleanup
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON rate_limit(window_start);
