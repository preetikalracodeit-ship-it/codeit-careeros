package com.codeit.careeros.ops;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Deployment smoke checks that must remain public and non-sensitive.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OperationalEndpointsIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Public build identity is exposed without authentication")
    void version_isPublicAndNonSensitive() throws Exception {
        mockMvc.perform(get("/api/v1/meta/version"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.service").value("careeros-backend"))
                .andExpect(jsonPath("$.data.version").isNotEmpty())
                .andExpect(jsonPath("$.data.buildTime").isNotEmpty())
                .andExpect(jsonPath("$.data.commit").isNotEmpty());
    }

    @Test
    @DisplayName("Liveness and readiness probes are public and distinct")
    void healthProbes_arePublic() throws Exception {
        mockMvc.perform(get("/actuator/health/liveness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));

        mockMvc.perform(get("/actuator/health/readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("Every request receives a correlation id")
    void requestId_isReturned() throws Exception {
        mockMvc.perform(get("/api/v1/meta/version"))
                .andExpect(status().isOk())
                .andExpect(header().exists("X-Request-Id"));

        mockMvc.perform(get("/api/v1/meta/version")
                        .header("X-Request-Id", "smoke-test-1234"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Request-Id", "smoke-test-1234"));
    }
}
