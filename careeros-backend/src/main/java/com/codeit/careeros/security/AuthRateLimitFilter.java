package com.codeit.careeros.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Sprint 8 brute-force protection for the public auth endpoints
 * (login / register / token refresh). In-memory sliding-window limiter
 * keyed by client IP — no extra infrastructure, correct for a monolith.
 * Disabled in the {@code test} profile so MockMvc suites never trip it.
 */
@Slf4j
@Component
@Profile("!test")
public class AuthRateLimitFilter extends OncePerRequestFilter {

    private static final long WINDOW_SECONDS = 60;
    private static final int MAX_TRACKED_CLIENTS = 10_000;
    private static final String OVERFLOW_KEY = "__limiter_overflow__";

    private final int maxPerMinute;
    private final ObjectMapper objectMapper;
    private final List<IpAddressMatcher> trustedProxies;
    private final Map<String, Deque<Instant>> hits = new ConcurrentHashMap<>();
    private final AtomicLong lastPurgeEpochSecond = new AtomicLong();

    public AuthRateLimitFilter(@Value("${app.auth.rate-limit-per-minute:60}") int maxPerMinute,
                               @Value("${app.auth.trusted-proxy-cidrs:}") String trustedProxyCidrs,
                               ObjectMapper objectMapper) {
        this.maxPerMinute = Math.max(1, maxPerMinute);
        this.objectMapper = objectMapper;
        this.trustedProxies = parseMatchers(trustedProxyCidrs);
    }

    private static List<IpAddressMatcher> parseMatchers(String value) {
        List<IpAddressMatcher> matchers = new ArrayList<>();
        if (value == null || value.isBlank()) {
            return matchers;
        }
        for (String entry : value.split(",")) {
            String candidate = entry.trim();
            if (candidate.isEmpty()) {
                continue;
            }
            try {
                matchers.add(new IpAddressMatcher(candidate));
            } catch (IllegalArgumentException ex) {
                log.warn("Ignoring invalid auth trusted-proxy CIDR '{}'", candidate);
            }
        }
        return matchers;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI();
        return !("/api/v1/auth/login".equals(path)
                || "/api/v1/auth/register".equals(path)
                || "/api/v1/auth/refresh".equals(path)
                || "/api/v1/auth/google".equals(path)
                // Invitation acceptance is a public credential-adjacent
                // endpoint and is rate limited like login.
                || (path.startsWith("/api/v1/invitations/") && path.endsWith("/accept")));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String key = clientIp(request);
        Instant now = Instant.now();
        // Bound memory even under a large distributed source-IP attack. New
        // keys beyond the cap share one bucket (fail closed, not unbounded).
        if (hits.size() >= MAX_TRACKED_CLIENTS && !hits.containsKey(key)) {
            key = OVERFLOW_KEY;
        }
        Deque<Instant> deque = hits.computeIfAbsent(key, ignored -> new ArrayDeque<>());
        boolean limited;
        synchronized (deque) {
            Instant cutoff = now.minusSeconds(WINDOW_SECONDS);
            while (!deque.isEmpty() && deque.peekFirst().isBefore(cutoff)) {
                deque.pollFirst();
            }
            if (deque.size() >= maxPerMinute) {
                limited = true;
            } else {
                deque.addLast(now);
                limited = false;
            }
        }
        if (hits.size() > MAX_TRACKED_CLIENTS) {
            // Purging on every request while the cap is exceeded would let a
            // distributed attack turn the limiter into a CPU sink. Purge at
            // most once per rate-limit window; the overflow bucket still
            // bounds cardinality in the meantime.
            long lastPurge = lastPurgeEpochSecond.get();
            if (now.getEpochSecond() - lastPurge >= WINDOW_SECONDS
                    && lastPurgeEpochSecond.compareAndSet(lastPurge, now.getEpochSecond())) {
                purgeExpired(now);
            }
        }
        if (limited) {
            log.warn("Auth rate limit exceeded for client {}", key);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            // Map.of rejects null values; the API envelope intentionally has
            // a null "data" field on errors.
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("success", false);
            body.put("message", "Too many attempts. Please wait a minute and try again.");
            body.put("data", null);
            body.put("errorCode", "RATE_LIMITED");
            body.put("timestamp", Instant.now().toString());
            objectMapper.writeValue(response.getWriter(), body);
            return;
        }
        filterChain.doFilter(request, response);
    }

    private void purgeExpired(Instant now) {
        Instant cutoff = now.minusSeconds(WINDOW_SECONDS);
        hits.entrySet().removeIf(entry -> {
            Deque<Instant> deque = entry.getValue();
            synchronized (deque) {
                while (!deque.isEmpty() && deque.peekFirst().isBefore(cutoff)) {
                    deque.pollFirst();
                }
                return deque.isEmpty();
            }
        });
    }

    private String clientIp(HttpServletRequest request) {
        String remote = normalize(request.getRemoteAddr());
        if (remote != null && isTrustedProxy(remote)) {
            // Use the closest untrusted hop rather than the left-most value,
            // which a client can supply. A trusted proxy must append (not
            // blindly copy) the peer address for this to be meaningful.
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                String[] hops = forwarded.split(",");
                for (int i = hops.length - 1; i >= 0; i--) {
                    String candidate = normalize(hops[i]);
                    if (candidate != null && !isTrustedProxy(candidate)) {
                        return candidate;
                    }
                }
            }
            String realIp = normalize(request.getHeader("X-Real-IP"));
            if (realIp != null && !isTrustedProxy(realIp)) {
                return realIp;
            }
        }
        return remote != null ? remote : "unknown";
    }

    private boolean isTrustedProxy(String address) {
        for (IpAddressMatcher matcher : trustedProxies) {
            try {
                if (matcher.matches(address)) {
                    return true;
                }
            } catch (IllegalArgumentException ignored) {
                // Not an IP literal; do not treat it as a trusted proxy.
            }
        }
        return false;
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
