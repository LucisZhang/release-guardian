import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { scoreScenario } from "../scripts/replay.mjs";

const fixture = JSON.parse(
  await readFile(new URL("../replay/synthetic-scenarios.json", import.meta.url), "utf8"),
);

const authScenario = fixture.scenarios.find((scenario) => scenario.id === "SYN-AUTH-01");
const schemaScenario = fixture.scenarios.find((scenario) => scenario.id === "SYN-SCHEMA-02");

test("scores the bounded authentication scenario deterministically", () => {
  assert.deepEqual(scoreScenario(authScenario, fixture.rules), {
    score: 25,
    level: "medium",
    blockers: [],
  });
});

test("flags the destructive schema scenario as critical", () => {
  const result = scoreScenario(schemaScenario, fixture.rules);
  assert.equal(result.score, 90);
  assert.equal(result.level, "critical");
  assert.deepEqual(result.blockers, [
    "rollback not tested",
    "monitoring gap",
    "missing evidence: Tested restore procedure",
    "missing evidence: Export failure monitor",
  ]);
});

test("keeps the public replay disconnected from private source and live models", () => {
  assert.match(
    fixture.fixed_disclosure,
    /not connected to the private repository or a live model/iu,
  );
});

test("fails closed on unknown facts or malformed rule bands", () => {
  assert.throws(
    () => scoreScenario({ facts: { unknown_rule: true }, missing_evidence: [] }, fixture.rules),
    /unknown scoring fact/iu,
  );
  assert.throws(
    () => scoreScenario(authScenario, { ...fixture.rules, bands: { low: 0 } }),
    /invalid risk bands/iu,
  );
});
