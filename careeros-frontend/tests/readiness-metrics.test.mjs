import test from "node:test";
import assert from "node:assert/strict";
import { hasReadinessEvidence, summarizeSkillGaps } from "../lib/readiness-metrics.mjs";

test("unassessed skills are not counted as gaps or readiness evidence", () => {
  const summary = summarizeSkillGaps([
    { assessed: true, metTarget: false },
    { assessed: true, metTarget: true },
    { assessed: false, metTarget: false },
  ]);

  assert.equal(summary.assessedCount, 2);
  assert.equal(summary.needsWorkCount, 1);
  assert.equal(summary.onTargetCount, 1);
  assert.equal(summary.unassessedCount, 1);
  assert.equal(hasReadinessEvidence({ hasTarget: true, totalSkills: 3, assessedSkills: 0, readinessPercent: 0 }), false);
  assert.equal(hasReadinessEvidence({ hasTarget: true, totalSkills: 3, assessedSkills: 1, readinessPercent: 0 }), true);
});
