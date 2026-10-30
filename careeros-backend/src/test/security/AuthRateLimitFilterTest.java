package com.codeit.careeros.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class AuthRateLimitFilterTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    @DisplayName("Direct clients cannot spoof their limiter key with X-Forwarded-For")
    void directClient_ignoresForwardedHeader() throws Exception {
        AuthRateLimitFilter filter = new AuthRateLimitFilter(
                2, "127.0.0.1/32", MAPPER);

        assertThat(attempt(filter, "8.8.8.8", "1.1.1.1").getStatus()).isEqualTo(200);
        assertThat(attempt(filter, "8.8.8.8", "2.2.2.2").getStatus()).isEqualTo(200);
        assertThat(attempt(filter, "8.8.8.8", "3.3.3.3").getStatus()).isEqualTo(429);
    }

    @Test
    @DisplayName("Trusted proxies can supply distinct client IPs")
    void trustedProxy_usesForwardedClient() throws Exception {
        AuthRateLimitFilter filter = new AuthRateLimitFilter(
                1, "127.0.0.1/32", MAPPER);

        assertThat(attempt(filter, "127.0.0.1", "1.1.1.1").getStatus()).isEqualTo(200);
        assertThat(attempt(filter, "127.0.0.1", "2.2.2.2").getStatus()).isEqualTo(200);
        assertThat(attempt(filter, "127.0.0.1", "1.1.1.1").getStatus()).isEqualTo(429);
    }

    @Test
    @DisplayName("Right-most untrusted hop is used behind a trusted proxy chain")
    void trustedProxy_usesClosestUntrustedHop() throws Exception {
        AuthRateLimitFilter filter = new AuthRateLimitFilter(
                1, "127.0.0.1/32,10.0.0.0/8", MAPPER);

        assertThat(attempt(filter, "127.0.0.1", "198.51.100.4, 10.0.0.5").getStatus()).isEqualTo(200);
        assertThat(attempt(filter, "127.0.0.1", "203.0.113.9, 10.0.0.5").getStatus()).isEqualTo(200);
        assertThat(attempt(filter, "127.0.0.1", "198.51.100.4, 10.0.0.5").getStatus()).isEqualTo(429);
    }

    @Test
    @DisplayName("Invalid trusted-proxy entries are ignored without breaking the filter")
    void invalidTrustedProxy_ignored() throws Exception {
        AuthRateLimitFilter filter = new AuthRateLimitFilter(
                1, "not-a-cidr,127.0.0.1/32", MAPPER);

        assertThat(attempt(filter, "8.8.8.8", "1.1.1.1").getStatus()).isEqualTo(200);
        assertThat(attempt(filter, "8.8.8.8", "2.2.2.2").getStatus()).isEqualTo(429);
    }

    private static MockHttpServletResponse attempt(AuthRateLimitFilter filter,
                                                   String remoteAddr,
                                                   String forwardedFor) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request.setRemoteAddr(remoteAddr);
        request.addHeader("X-Forwarded-For", forwardedFor);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }
}
