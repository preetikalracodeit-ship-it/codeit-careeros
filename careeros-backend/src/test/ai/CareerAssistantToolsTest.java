package com.codeit.careeros.ai;

import com.codeit.careeros.dto.insight.ReadinessResponse;
import com.codeit.careeros.service.CareerInsightService;
import com.codeit.careeros.service.CvAnalysisService;
import com.codeit.careeros.service.LinkedInService;
import com.codeit.careeros.service.ProjectService;
import com.codeit.careeros.service.RoadmapService;
import com.codeit.careeros.service.StudentProfileService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.ai.support.ToolCallbacks;
import org.springframework.ai.tool.ToolCallback;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for the native tool surface: the LLM sees exactly the eight
 * allowlisted CareerOS tools (no more, no less), and argument clamping from
 * the legacy {@code execute} path also applies to native calls.
 */
class CareerAssistantToolsTest {

    private CareerAssistantTools tools() {
        return new CareerAssistantTools(
                Mockito.mock(StudentProfileService.class),
                Mockito.mock(CareerInsightService.class),
                Mockito.mock(RoadmapService.class),
                Mockito.mock(ProjectService.class),
                Mockito.mock(CvAnalysisService.class),
                Mockito.mock(LinkedInService.class));
    }

    @Test
    @DisplayName("Native tool surface matches the allowlist exactly")
    void nativeTools_matchAllowlist() {
        ToolCallback[] callbacks = ToolCallbacks.from(tools());
        assertThat(callbacks).hasSize(8);
        assertThat(java.util.Arrays.stream(callbacks)
                .map(callback -> callback.getToolDefinition().name())
                .sorted()
                .toList())
                .containsExactlyInAnyOrderElementsOf(tools().toolNames());
    }

    @Test
    @DisplayName("getSkillGaps clamps out-of-range topN like the legacy path")
    void skillGaps_clampsTopN() {
        CareerInsightService insight = Mockito.mock(CareerInsightService.class);
        Mockito.when(insight.myReadiness()).thenReturn(new ReadinessResponse(
                1L, "Java Developer", true, 10, "Beginner", 0, 0, 0, 0, null,
                List.of(), List.of(), List.of()));
        CareerAssistantTools tools = new CareerAssistantTools(
                Mockito.mock(StudentProfileService.class), insight,
                Mockito.mock(RoadmapService.class), Mockito.mock(ProjectService.class),
                Mockito.mock(CvAnalysisService.class), Mockito.mock(LinkedInService.class));

        assertThat(tools.getSkillGaps(null)).isEmpty();
        assertThat(tools.getSkillGaps(99)).isEmpty();
        assertThat(tools.execute("getSkillGaps", Map.of("topN", 99))).isEqualTo(List.of());
    }

    @Test
    @DisplayName("Unknown tool name is rejected by the legacy path")
    void execute_unknownToolRejected() {
        org.assertj.core.api.Assertions.assertThatThrownBy(
                        () -> tools().execute("dropTables", Map.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
