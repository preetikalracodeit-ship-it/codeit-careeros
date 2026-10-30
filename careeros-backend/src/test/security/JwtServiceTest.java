package com.codeit.careeros.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String SECRET = "unit-test-secret-key-0123456789abcdef-0123456789";

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(SECRET, "careeros", 900_000, 604_800_000);
    }

    @Test
    void generateAccessToken_producesParsableClaims() {
        String token = jwtService.generateAccessToken(42L, "stu@test.local", "STUDENT");

        Claims claims = jwtService.parseClaims(token);

        assertThat(claims.getSubject()).isEqualTo("42");
        assertThat(claims.get("email", String.class)).isEqualTo("stu@test.local");
        assertThat(claims.get("role", String.class)).isEqualTo("STUDENT");
        assertThat(claims.getIssuer()).isEqualTo("careeros");
        assertThat(claims.getExpiration()).isAfter(Date.from(Instant.now().plusSeconds(600)));
    }

    @Test
    void parseClaims_rejectsTamperedToken() {
        String token = jwtService.generateAccessToken(1L, "a@b.local", "ADMIN");
        String tampered = token.substring(0, token.length() - 2) + "xy";

        assertThatThrownBy(() -> jwtService.parseClaims(tampered))
                .isInstanceOf(JwtException.class);
    }

    @Test
    void parseClaims_rejectsExpiredToken() {
        JwtService shortLived = new JwtService(SECRET, "careeros", -1000, 1000);
        String token = shortLived.generateAccessToken(1L, "a@b.local", "STUDENT");

        assertThatThrownBy(() -> shortLived.parseClaims(token))
                .isInstanceOf(ExpiredJwtException.class);
    }

    @Test
    void parseClaims_rejectsTokenFromDifferentKey() {
        JwtService other = new JwtService("another-secret-key-0123456789abcdef-0123456789", "careeros", 900_000, 604_800_000);
        String token = other.generateAccessToken(1L, "a@b.local", "STUDENT");

        assertThatThrownBy(() -> jwtService.parseClaims(token))
                .isInstanceOf(JwtException.class);
    }
}