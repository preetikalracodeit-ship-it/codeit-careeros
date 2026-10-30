package com.codeit.careeros.service;

import com.codeit.careeros.common.enums.ResultLevel;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AssessmentScoringTest {

    @Test
    @DisplayName("skillScore computes the share answered correctly (rounded)")
    void skillScore_roundsToNearestPercent() {
        assertEquals(100, AssessmentScoring.skillScore(2, 2));
        assertEquals(50, AssessmentScoring.skillScore(1, 2));
        assertEquals(0, AssessmentScoring.skillScore(0, 4));
        assertEquals(67, AssessmentScoring.skillScore(2, 3));
        assertEquals(0, AssessmentScoring.skillScore(3, 0));
    }

    @Test
    @DisplayName("overallScore weights by career competency weights")
    void overallScore_weightedMean() {
        int overall = AssessmentScoring.overallScore(List.of(
                new AssessmentScoring.WeightedScore(70, 50),
                new AssessmentScoring.WeightedScore(30, 100)));
        assertEquals(65, overall);
    }

    @Test
    @DisplayName("overallScore falls back to an equal average when all weights are zero")
    void overallScore_fallsBackToAverage() {
        int overall = AssessmentScoring.overallScore(List.of(
                new AssessmentScoring.WeightedScore(0, 40),
                new AssessmentScoring.WeightedScore(0, 80)));
        assertEquals(60, overall);
    }

    @Test
    @DisplayName("overallScore is zero for no scores")
    void overallScore_emptyIsZero() {
        assertEquals(0, AssessmentScoring.overallScore(List.of()));
        assertEquals(0, AssessmentScoring.overallScore(null));
    }

    @Test
    @DisplayName("ResultLevel maps score thresholds")
    void resultLevel_thresholds() {
        assertEquals(ResultLevel.STRONG, ResultLevel.fromScore(80));
        assertEquals(ResultLevel.GOOD, ResultLevel.fromScore(65));
        assertEquals(ResultLevel.DEVELOPING, ResultLevel.fromScore(50));
        assertEquals(ResultLevel.NEEDS_IMPROVEMENT, ResultLevel.fromScore(35));
        assertEquals(ResultLevel.PRIORITY_GAP, ResultLevel.fromScore(0));
    }
}