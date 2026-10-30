package com.codeit.careeros.ai;

import com.codeit.careeros.service.CareerInsightService;
import com.codeit.careeros.service.CvAnalysisService;
import com.codeit.careeros.service.LinkedInService;
import com.codeit.careeros.service.ProjectService;
import com.codeit.careeros.service.RoadmapService;
import com.codeit.careeros.service.StudentProfileService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Routing tests for the no-LLM offline engine: general questions (including a
 * bare technology word) are answered directly with zero CareerOS tool calls,
 * while role-skills combinations keep the two-part general + personal shape.
 * Services are unstubbed mocks, so every snapshot degrades to "no data" —
 * routing itself is what is verified here.
 */
class OfflineRoutingTest {

    private OfflineGuidanceEngine engine() {
        return new OfflineGuidanceEngine(
                Mockito.mock(StudentProfileService.class),
                Mockito.mock(CareerInsightService.class),
                Mockito.mock(RoadmapService.class),
                Mockito.mock(ProjectService.class),
                Mockito.mock(CvAnalysisService.class),
                Mockito.mock(LinkedInService.class));
    }

    @Test
    @DisplayName("Bare 'Java' is answered generally with no CareerOS tools")
    void bareJava_generalAnswerNoTools() {
        OfflineGuidanceEngine.GuidanceResult result = engine().reply("Java", java.util.List.of());
        assertThat(result.reply()).contains("Java — explained");
        assertThat(result.reply()).doesNotContain("readiness", "Readiness");
        assertThat(result.toolsUsed()).isEmpty();
    }

    @Test
    @DisplayName("Bare 'SQL' is answered generally with no CareerOS tools")
    void bareSql_generalAnswerNoTools() {
        OfflineGuidanceEngine.GuidanceResult result = engine().reply("SQL", java.util.List.of());
        assertThat(result.reply()).contains("SQL");
        assertThat(result.toolsUsed()).isEmpty();
    }

    @Test
    @DisplayName("'What is Java?' is answered generally with no CareerOS tools")
    void whatIsJava_generalAnswerNoTools() {
        OfflineGuidanceEngine.GuidanceResult result = engine().reply("What is Java?", java.util.List.of());
        assertThat(result.reply()).contains("Java — explained");
        assertThat(result.toolsUsed()).isEmpty();
    }

    @Test
    @DisplayName("'What is my Java score?' stays personal and uses CareerOS tools")
    void myJavaScore_personalWithTools() {
        OfflineGuidanceEngine.GuidanceResult result =
                engine().reply("What is my Java score?", java.util.List.of());
        assertThat(result.reply()).contains("Assessment");
        assertThat(result.toolsUsed()).isNotEmpty();
    }

    @Test
    @DisplayName("Role skills plus 'which ones am I missing' keeps the two-part shape")
    void roleSkillsWithPersonalAsk_twoPartAnswer() {
        OfflineGuidanceEngine.GuidanceResult result = engine().reply(
                "What skills do I need for Java development and which ones am I missing?",
                java.util.List.of());
        assertThat(result.reply()).contains("Skills needed to become");
        assertThat(result.reply()).contains("How this maps to YOU");
    }

    @Test
    @DisplayName("Mixed Spring Boot question explains generally then covers personal standing")
    void mixedQuestion_generalPlusPersonal() {
        OfflineGuidanceEngine.GuidanceResult result = engine().reply(
                "What is Spring Boot and how good am I at it?", java.util.List.of());
        assertThat(result.reply()).contains("Spring Boot");
        // No target career in this harness, so the personal part guides setup
        // instead of scoring; with real data it names the measured standing.
        assertThat(result.reply()).contains("Your personal standing");
    }

    @Test
    @DisplayName("Curated general topics have offline answers; unknown topics do not")
    void curatedGeneralAnswers_knownVsUnknown() {
        assertThat(engine().hasCuratedGeneralAnswer("What is Java?")).isTrue();
        assertThat(engine().hasCuratedGeneralAnswer("Explain Spring Boot.")).isTrue();
        assertThat(engine().hasCuratedGeneralAnswer("What is Python?")).isTrue();
        assertThat(engine().hasCuratedGeneralAnswer("What is SQL?")).isTrue();
        assertThat(engine().hasCuratedGeneralAnswer("What is JavaScript?")).isTrue();
        assertThat(engine().hasCuratedGeneralAnswer("Give me Java interview questions.")).isTrue();
        assertThat(engine().hasCuratedGeneralAnswer("Write a Java program for palindrome.")).isTrue();
        assertThat(engine().hasCuratedGeneralAnswer("What is trending in Java right now?")).isTrue();
        assertThat(engine().hasCuratedGeneralAnswer("What is the capital of France?")).isFalse();
        assertThat(engine().hasCuratedGeneralAnswer("What is photosynthesis?")).isFalse();
        assertThat(engine().hasCuratedGeneralAnswer("   ")).isFalse();
        assertThat(engine().hasCuratedGeneralAnswer(null)).isFalse();
    }

    @Test
    @DisplayName("'What is JavaScript?' is answered as JavaScript, not Java")
    void whatIsJavaScript_answersJavaScript() {
        OfflineGuidanceEngine.GuidanceResult result =
                engine().reply("What is JavaScript?", java.util.List.of());
        assertThat(result.reply()).contains("JavaScript — explained");
        assertThat(result.toolsUsed()).isEmpty();
    }

    @Test
    @DisplayName("Curated 'What is Python?' and 'What is SQL?' get specific explainers")
    void whatIsPythonAndSql_specificExplainers() {
        assertThat(engine().reply("What is Python?", java.util.List.of()).reply())
                .contains("Python — explained");
        assertThat(engine().reply("What is SQL?", java.util.List.of()).reply())
                .contains("SQL — explained");
    }
}
