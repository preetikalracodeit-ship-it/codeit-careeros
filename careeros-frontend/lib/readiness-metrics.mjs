export function summarizeSkillGaps(gaps = []) {
  const items = Array.isArray(gaps) ? gaps : [];
  const assessed = items.filter((item) => item?.assessed === true);
  return {
    assessedCount: assessed.length,
    onTargetCount: assessed.filter((item) => item.metTarget === true).length,
    needsWorkCount: assessed.filter((item) => item.metTarget !== true).length,
    unassessedCount: items.length - assessed.length,
    assessedGaps: assessed,
  };
}

export function hasReadinessEvidence(readiness) {
  return Boolean(
    readiness?.hasTarget
      && (readiness.totalSkills ?? 0) > 0
      && (readiness.assessedSkills ?? 0) > 0
      && readiness.readinessPercent != null,
  );
}
