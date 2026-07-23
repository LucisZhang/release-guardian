import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SWITCH = "[English](README.md) | [简体中文](README.zh-CN.md)";
const EXPECTED_ASSETS = [
  "docs/architecture.mmd",
  "evidence/data/cost-evidence.csv",
  "evidence/data/evaluation-live.csv",
  "evidence/data/evaluation-stub.csv",
  "evidence/data/findings.csv",
  "evidence/source-manifest.json",
  "replay/synthetic-scenarios.json",
];

function fail(message) {
  throw new Error(message);
}

async function read(path) {
  return readFile(resolve(root, path));
}

async function sha256(path) {
  return createHash("sha256").update(await read(path)).digest("hex");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/u, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) fail("unterminated CSV quote");
  if (field !== "" || row.length > 0) {
    row.push(field.replace(/\r$/u, ""));
    rows.push(row);
  }

  const [headers, ...records] = rows.filter((item) => item.some((value) => value !== ""));
  if (!headers) fail("empty CSV");
  return records.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]])));
}

function assertEvaluation(rows, expected) {
  if (rows.length !== 8) fail(`${expected.mode} evaluation must contain eight metrics`);
  for (const row of rows) {
    if (row.aggregate_gate_pass !== "true") fail(`${expected.mode} aggregate gate failed`);
    if (row.mode !== expected.mode) fail(`${expected.mode} mode mismatch`);
    if (row.evidence_class !== expected.evidenceClass) fail(`${expected.mode} evidence class mismatch`);
    if (row.strict_flagged_scenarios !== expected.flagged || row.strict_total_scenarios !== "44") {
      fail(`${expected.mode} strict residual mismatch`);
    }
  }
}

function paragraphWith(text, token) {
  return text.split(/\n\s*\n/u).find((paragraph) => paragraph.includes(token));
}

function assertReadme(text, locale) {
  if (!text.startsWith(`${SWITCH}\n\n# `)) fail(`${locale} README switch/title mismatch`);
  if (/\b(?:TODO|TBD|placeholder)\b/iu.test(text)) fail(`${locale} README contains placeholder text`);

  const live = paragraphWith(text, "30/44");
  const stub = paragraphWith(text, "15/44");
  if (!live || !/(?:aggregate|聚合)/iu.test(live) || !/(?:live|实测)/iu.test(live)) {
    fail(`${locale} README live residual is not adjacent to aggregate live wording`);
  }
  if (!stub || !/(?:aggregate|聚合)/iu.test(stub) || !/stub/iu.test(stub)) {
    fail(`${locale} README stub residual is not adjacent to aggregate stub wording`);
  }
  if (!/(?:private repository|私有仓库)/iu.test(text) || !/(?:live model|实时模型)/iu.test(text)) {
    fail(`${locale} README missing public replay boundary`);
  }
}

const manifest = JSON.parse((await read("evidence/manifest.json")).toString("utf8"));
if (manifest.schema_version !== 1 || manifest.package !== "release-guardian-public-replay-v1") {
  fail("publication manifest identity mismatch");
}
if (manifest.publication_record?.approved_scope_date !== "2026-07-22") {
  fail("publication record date mismatch");
}

const manifestPaths = manifest.assets.map((asset) => asset.path).sort();
if (new Set(manifestPaths).size !== manifestPaths.length) fail("duplicate manifest asset path");
if (JSON.stringify(manifestPaths) !== JSON.stringify([...EXPECTED_ASSETS].sort())) {
  fail("publication asset allowlist mismatch");
}
for (const asset of manifest.assets) {
  if (!/^[a-f0-9]{64}$/u.test(asset.sha256)) fail(`invalid asset hash: ${asset.path}`);
  if ((await sha256(asset.path)) !== asset.sha256) fail(`asset hash mismatch: ${asset.path}`);
}

const sourceManifest = JSON.parse((await read("evidence/source-manifest.json")).toString("utf8"));
if (
  sourceManifest.status !== "candidate_for_human_review"
  || sourceManifest.approval?.exact_asset_hash_approval !== "pending"
  || sourceManifest.approval?.publication_or_deploy !== "not approved"
) {
  fail("historical source manifest was rewritten");
}

const evidenceDirectory = await readdir(resolve(root, "evidence"));
if (evidenceDirectory.includes("screenshots")) fail("candidate screenshots are not publication assets");

const liveRows = parseCsv((await read("evidence/data/evaluation-live.csv")).toString("utf8"));
const stubRows = parseCsv((await read("evidence/data/evaluation-stub.csv")).toString("utf8"));
assertEvaluation(liveRows, { mode: "live", evidenceClass: "measured", flagged: "30" });
assertEvaluation(stubRows, { mode: "stub", evidenceClass: "deterministic", flagged: "15" });

const costRows = parseCsv((await read("evidence/data/cost-evidence.csv")).toString("utf8"));
const costClasses = [...new Set(costRows.map((row) => row.evidence_class))].sort();
if (JSON.stringify(costClasses) !== JSON.stringify(["estimated", "measured", "modeled", "projected"])) {
  fail("cost evidence classes mismatch");
}

const findings = parseCsv((await read("evidence/data/findings.csv")).toString("utf8"));
if (findings.length !== 13 || findings[0]?.id !== "W3-01" || findings.at(-1)?.id !== "W3-13") {
  fail("sanitized findings inventory mismatch");
}

const replay = JSON.parse((await read("replay/synthetic-scenarios.json")).toString("utf8"));
if (!/not connected to the private repository or a live model/iu.test(replay.fixed_disclosure)) {
  fail("replay disclosure mismatch");
}
if (!Array.isArray(replay.scenarios) || replay.scenarios.length !== 4) fail("replay scenario count mismatch");

assertReadme((await read("README.md")).toString("utf8"), "English");
assertReadme((await read("README.zh-CN.md")).toString("utf8"), "Chinese");

const publicText = [
  "README.md",
  "README.zh-CN.md",
  "docs/architecture.mmd",
  "evidence/manifest.json",
  "replay/synthetic-scenarios.json",
].map(async (path) => (await read(path)).toString("utf8"));
for (const text of await Promise.all(publicText)) {
  if (/\/Users\/|\/private\/tmp\//u.test(text)) fail("private absolute path leaked");
}

process.stdout.write(
  `Evidence verified: ${manifest.assets.length} assets; ${liveRows.length} live metrics + 30/44 residual; ${stubRows.length} stub metrics + 15/44 residual.\n`,
);
