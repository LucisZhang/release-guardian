import { readFile } from "node:fs/promises";

const DIRECT_FACT_RULES = [
  "breaking_api",
  "irreversible_schema",
  "auth_boundary",
  "major_dependency",
  "monitoring_gap",
];

function assertWeight(value, name) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`invalid rule weight: ${name}`);
  }
}

function validateRules(rules) {
  if (!rules || typeof rules !== "object" || Array.isArray(rules)) {
    throw new Error("invalid scoring rules");
  }

  for (const name of [...DIRECT_FACT_RULES, "rollback_untested", "missing_evidence_each"]) {
    assertWeight(rules[name], name);
  }

  const bands = rules.bands;
  if (
    !bands
    || !["critical", "high", "medium", "low"].every((name) => Number.isFinite(bands[name]))
    || !(bands.critical > bands.high && bands.high > bands.medium && bands.medium > bands.low)
    || bands.low !== 0
  ) {
    throw new Error("invalid risk bands");
  }
}

function levelFor(score, bands) {
  if (score >= bands.critical) return "critical";
  if (score >= bands.high) return "high";
  if (score >= bands.medium) return "medium";
  return "low";
}

export function scoreScenario(scenario, rules) {
  validateRules(rules);
  if (!scenario || typeof scenario !== "object" || Array.isArray(scenario)) {
    throw new Error("invalid scenario");
  }

  const facts = scenario.facts;
  if (!facts || typeof facts !== "object" || Array.isArray(facts)) {
    throw new Error("invalid scenario facts");
  }

  const allowedFacts = new Set([...DIRECT_FACT_RULES, "rollback_tested"]);
  for (const [name, value] of Object.entries(facts)) {
    if (!allowedFacts.has(name)) throw new Error(`unknown scoring fact: ${name}`);
    if (typeof value !== "boolean") throw new Error(`invalid scoring fact: ${name}`);
  }
  for (const name of allowedFacts) {
    if (typeof facts[name] !== "boolean") throw new Error(`missing scoring fact: ${name}`);
  }

  const missingEvidence = scenario.missing_evidence;
  if (
    !Array.isArray(missingEvidence)
    || missingEvidence.some((item) => typeof item !== "string" || item.trim() === "")
  ) {
    throw new Error("invalid missing evidence");
  }

  let score = 0;
  for (const name of DIRECT_FACT_RULES) {
    if (facts[name]) score += rules[name];
  }
  if (!facts.rollback_tested) score += rules.rollback_untested;
  score += missingEvidence.length * rules.missing_evidence_each;
  score = Math.min(100, score);

  const blockers = [];
  if (!facts.rollback_tested) blockers.push("rollback not tested");
  if (facts.monitoring_gap) blockers.push("monitoring gap");
  for (const item of missingEvidence) blockers.push(`missing evidence: ${item}`);

  return { score, level: levelFor(score, rules.bands), blockers };
}

async function main(argv) {
  const scenarioId = argv[0];
  if (!scenarioId) throw new Error("usage: npm run replay -- <scenario-id>");

  const fixture = JSON.parse(
    await readFile(new URL("../replay/synthetic-scenarios.json", import.meta.url), "utf8"),
  );
  const scenario = fixture.scenarios.find((item) => item.id === scenarioId);
  if (!scenario) throw new Error("unknown scenario id");

  const result = scoreScenario(scenario, fixture.rules);
  process.stdout.write(`${JSON.stringify({
    scenario_id: scenario.id,
    ...result,
    fixed_disclosure: fixture.fixed_disclosure,
  }, null, 2)}\n`);
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "replay failed"}\n`);
    process.exitCode = 1;
  });
}
