#!/usr/bin/env node
/**
 * Push roles/ and entities/ into D1, which is what agents actually read at run time.
 *
 * The repo is the source of truth: specs are written, reviewed and diffed as markdown.
 * D1 is the serving copy, so a scheduled routine needs only the API and its token and
 * never has to clone a private repo.
 *
 * THE DRIFT RISK IS THE WHOLE POINT. Edit a spec, merge it, forget to run this, and every
 * agent keeps following the old instructions with nothing anywhere saying so. So:
 *   --check  compares repo against D1, writes nothing, exits 1 on any drift
 *   every row stores the git SHA it came from, and the endpoint returns it
 *
 * Usage:
 *   node scripts/sync-specs.mjs
 *   node scripts/sync-specs.mjs --check
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

function sha(cwd = ROOT) {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd }).toString().trim();
  } catch {
    return null;
  }
}

function d1(args) {
  // wrangler prints banners before the JSON, so take from the first bracket.
  const out = execFileSync("npx", ["wrangler", "d1", "execute", "estate-db", "--remote", ...args], {
    cwd: join(ROOT, "worker"),
    maxBuffer: 64 * 1024 * 1024,
  }).toString();
  const i = out.indexOf("[");
  return i === -1 ? [] : JSON.parse(out.slice(i))[0].results;
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

// ---- gather roles -----------------------------------------------------------
const roles = [];
const rolesDir = join(ROOT, "roles");
for (const name of existsSync(rolesDir) ? readdirSync(rolesDir) : []) {
  const specPath = join(rolesDir, name, "instructions", "spec.md");
  if (!existsSync(specPath)) continue;
  const accessPath = join(rolesDir, name, "access.md");
  roles.push({
    key: name,
    body: readFileSync(specPath, "utf8"),
    access: existsSync(accessPath) ? readFileSync(accessPath, "utf8") : null,
  });
}

// ---- gather hires -----------------------------------------------------------
// entities/<entity>/roster/<role>.md, keyed as "<entity>:<role>" to match registry.key.
const hires = [];
const entDir = join(ROOT, "entities");
for (const entity of existsSync(entDir) ? readdirSync(entDir) : []) {
  const roster = join(entDir, entity, "roster");
  if (!existsSync(roster)) continue;
  for (const file of readdirSync(roster)) {
    if (!file.endsWith(".md")) continue;
    const role = file.replace(/\.md$/, "");
    hires.push({
      registry_key: `${entity}:${role}`,
      role,
      terms: readFileSync(join(roster, file), "utf8"),
    });
  }
}

// ---- gather voice guides ----------------------------------------------------
/*
 * The guides live in the entity's own repository and this file is only the index.
 *
 * Hard rule 9 makes a guide a hard dependency of any drafting role, so a guide
 * named in guides.json and missing from disk is a failure rather than a skip.
 * Silently syncing four of five would mean a role shipping against no guide at
 * all, which is the exact thing the rule exists to prevent.
 */
const guides = [];
const guidesConfig = join(ROOT, "guides.json");
if (existsSync(guidesConfig)) {
  const cfg = JSON.parse(readFileSync(guidesConfig, "utf8"));
  for (const g of cfg.guides ?? []) {
    const full = join(g.root, g.path);
    if (!existsSync(full)) {
      console.error(
        `Voice guide missing: ${g.entity}/${g.surface} expects ${full}\n` +
          `A drafting role reads this, and rule 9 makes a missing guide a hard stop. ` +
          `Fix the path in guides.json or restore the file. Refusing to sync a partial set.`
      );
      process.exit(1);
    }
    guides.push({
      entity: g.entity,
      surface: g.surface,
      body: readFileSync(full, "utf8"),
      source_repo: g.repo,
      source_path: g.path,
      // That repo's HEAD, never this one's. See migration 0014 for why.
      source_sha: sha(g.root),
    });
  }
}

if (roles.length === 0) {
  console.error("No roles found under roles/*/instructions/spec.md. Refusing to sync nothing.");
  process.exit(1);
}

// ---- check ------------------------------------------------------------------
if (CHECK) {
  const remoteRoles = new Map(d1(["--json", "--command", "SELECT key, body, access FROM specs;"]).map((r) => [r.key, r]));
  const remoteHires = new Map(
    d1(["--json", "--command", "SELECT registry_key, role, terms FROM hires;"]).map((r) => [r.registry_key, r])
  );
  const drift = [];

  for (const r of roles) {
    const rem = remoteRoles.get(r.key);
    if (!rem) drift.push(`spec ${r.key}: missing from D1`);
    else if (rem.body !== r.body) drift.push(`spec ${r.key}: body differs`);
    else if ((rem.access ?? null) !== r.access) drift.push(`spec ${r.key}: access table differs`);
  }
  for (const key of remoteRoles.keys()) {
    if (!roles.some((r) => r.key === key)) {
      drift.push(`spec ${key}: in D1 but not in the repo. Delete it by hand if that is intentional.`);
    }
  }
  for (const h of hires) {
    const rem = remoteHires.get(h.registry_key);
    if (!rem) drift.push(`hire ${h.registry_key}: missing from D1`);
    else if (rem.terms !== h.terms) drift.push(`hire ${h.registry_key}: terms differ`);
  }

  if (drift.length) {
    console.error("SPECS OUT OF SYNC. Agents are reading these, not the repo:\n");
    for (const d of drift) console.error("  " + d);
    process.exit(1);
  }
  console.log(`in sync: ${roles.length} role(s), ${hires.length} hire(s)`);
  process.exit(0);
}

// ---- write ------------------------------------------------------------------
// Through a temp .sql file: these bodies are thousands of lines of markdown with quotes
// and backticks, and they do not belong on a shell command line.
const commit = sha();
const lines = [];
for (const r of roles) {
  lines.push(
    `INSERT INTO specs (key, body, access, source_sha, synced_at) VALUES (${q(r.key)}, ${q(r.body)}, ${
      r.access === null ? "NULL" : q(r.access)
    }, ${commit ? q(commit) : "NULL"}, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET body=excluded.body, access=excluded.access,
       source_sha=excluded.source_sha, synced_at=excluded.synced_at;`
  );
}
for (const h of hires) {
  lines.push(
    `INSERT INTO hires (registry_key, role, terms, source_sha, synced_at) VALUES (${q(h.registry_key)}, ${q(
      h.role
    )}, ${q(h.terms)}, ${commit ? q(commit) : "NULL"}, datetime('now'))
     ON CONFLICT(registry_key) DO UPDATE SET role=excluded.role, terms=excluded.terms,
       source_sha=excluded.source_sha, synced_at=excluded.synced_at;`
  );
}

for (const g of guides) {
  lines.push(
    `INSERT INTO guides (entity, surface, body, source_repo, source_path, source_sha, synced_at)
     VALUES (${q(g.entity)}, ${q(g.surface)}, ${q(g.body)}, ${q(g.source_repo)}, ${q(g.source_path)}, ${
      g.source_sha ? q(g.source_sha) : "NULL"
    }, datetime('now'))
     ON CONFLICT(entity, surface) DO UPDATE SET body=excluded.body, source_repo=excluded.source_repo,
       source_path=excluded.source_path, source_sha=excluded.source_sha, synced_at=excluded.synced_at;`
  );
}

const tmp = join(mkdtempSync(join(tmpdir(), "estate-specs-")), "sync.sql");
writeFileSync(tmp, lines.join("\n"));
d1(["--file", tmp]);
console.log(
  `synced ${roles.length} role(s), ${hires.length} hire(s), ${guides.length} guide(s) at ${commit ?? "unknown sha"}`
);
