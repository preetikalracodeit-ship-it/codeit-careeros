package com.codeit.careeros.auth;

import com.codeit.careeros.TestSupport;
import com.codeit.careeros.common.enums.UserStatus;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.repository.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Sprint 8 authorization hardening: anonymous/invalid/expired/wrong-issuer
 * tokens are rejected, STUDENT cannot reach ADMIN APIs, sessions revoke on
 * logout, and owner-scoped endpoints never leak across students.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthSecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private UserRepository userRepository;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Test
    @DisplayName("Student profile without token returns 401")
    void studentsMe_anonymous_unauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/students/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("Tampered JWT signature returns 401")
    void studentsMe_tamperedToken_unauthorized() throws Exception {
        MvcResult reg = register("tamper@test.local");
        String access = TestSupport.token(reg, "accessToken");
        String tampered = access.substring(0, access.length() - 2) + (access.endsWith("aa") ? "bb" : "aa");

        mockMvc.perform(get("/api/v1/students/me")
                        .header("Authorization", "Bearer " + tampered))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("JWT with wrong issuer returns 401")
    void studentsMe_wrongIssuer_unauthorized() throws Exception {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        Instant now = Instant.now();
        String forged = Jwts.builder()
                .subject("999999")
                .issuer("evil-issuer")
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(600)))
                .claim("email", "evil@test.local")
                .claim("role", "STUDENT")
                .signWith(key)
                .compact();

        mockMvc.perform(get("/api/v1/students/me")
                        .header("Authorization", "Bearer " + forged))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Expired JWT returns 401")
    void studentsMe_expiredToken_unauthorized() throws Exception {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        Instant past = Instant.now().minusSeconds(3600);
        String expired = Jwts.builder()
                .subject("999999")
                .issuer("careeros")
                .issuedAt(Date.from(past))
                .expiration(Date.from(past.plusSeconds(600)))
                .claim("email", "old@test.local")
                .claim("role", "STUDENT")
                .signWith(key)
                .compact();

        mockMvc.perform(get("/api/v1/students/me")
                        .header("Authorization", "Bearer " + expired))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("STUDENT token cannot reach ADMIN APIs (403)")
    void adminEndpoints_student_forbidden() throws Exception {
        MvcResult reg = register("student-admin@test.local");
        String access = TestSupport.token(reg, "accessToken");

        mockMvc.perform(get("/api/v1/admin/careers")
                        .header("Authorization", "Bearer " + access))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("FORBIDDEN"));
    }

    @Test
    @DisplayName("Logout revokes the refresh token")
    void logout_revokesRefreshToken() throws Exception {
        MvcResult reg = register("logout@test.local");
        String refresh = TestSupport.token(reg, "refreshToken");

        mockMvc.perform(post("/api/v1/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\": \"" + refresh + "\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\": \"" + refresh + "\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Logout without any token still succeeds (no-op)")
    void logout_withoutToken_success() throws Exception {
        mockMvc.perform(post("/api/v1/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("Each student only ever sees their own profile")
    void students_areIsolated() throws Exception {
        MvcResult regA = register("owner-a@test.local");
        MvcResult regB = register("owner-b@test.local");
        String accessA = TestSupport.token(regA, "accessToken");
        String accessB = TestSupport.token(regB, "accessToken");

        mockMvc.perform(get("/api/v1/students/me")
                        .header("Authorization", "Bearer " + accessA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value("owner-a@test.local"));

        mockMvc.perform(get("/api/v1/students/me")
                        .header("Authorization", "Bearer " + accessB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value("owner-b@test.local"));
    }

    @Test
    @DisplayName("CV download is owner-scoped: another student gets 404, owner gets 200")
    void cvDownload_isOwnerScoped() throws Exception {
        MvcResult regA = register("cv-a@test.local");
        MvcResult regB = register("cv-b@test.local");
        String accessA = TestSupport.token(regA, "accessToken");
        String accessB = TestSupport.token(regB, "accessToken");

        byte[] pdf = minimalPdf();
        mockMvc.perform(multipart("/api/v1/cvs")
                        .file(new MockMultipartFile("file", "a-cv.pdf", "application/pdf", pdf))
                        .header("Authorization", "Bearer " + accessA))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/cvs/download")
                        .header("Authorization", "Bearer " + accessB))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/cvs/download")
                        .header("Authorization", "Bearer " + accessA))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Deactivating an account immediately invalidates access and refresh tokens")
    void deactivatedAccount_cannotUseExistingSession() throws Exception {
        MvcResult reg = register("deactivated@test.local");
        String access = TestSupport.token(reg, "accessToken");
        String refresh = TestSupport.token(reg, "refreshToken");

        User user = userRepository.findByEmail("deactivated@test.local").orElseThrow();
        user.setStatus(UserStatus.INACTIVE);
        userRepository.saveAndFlush(user);

        mockMvc.perform(get("/api/v1/students/me")
                        .header("Authorization", "Bearer " + access))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\": \"" + refresh + "\"}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "deactivated@test.local", "password": "Password1"}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Authentication responses are marked non-cacheable")
    void authResponses_areNoStore() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "nobody@test.local", "password": "WrongPass1"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("Cache-Control", "no-store"));

        MvcResult reg = register("cache@test.local");
        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + TestSupport.token(reg, "accessToken")))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    /** Hand-built single-page PDF (no xref; PDFBox/Tika rebuild it). */
    private static byte[] minimalPdf() {
        String content = "BT /F1 12 Tf 50 750 Td 16 TL "
                + "(Jane Student) Tj T* "
                + "(Skills) Tj T* "
                + "(Java, SQL, Git) Tj ET";
        byte[] contentBytes = content.getBytes(StandardCharsets.US_ASCII);
        String pdf = "%PDF-1.4\n"
                + "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
                + "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
                + "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
                + "/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
                + "4 0 obj\n<< /Length " + contentBytes.length + " >>\nstream\n"
                + content + "\nendstream\nendobj\n"
                + "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
                + "trailer\n<< /Root 1 0 R >>\n";
        return pdf.getBytes(StandardCharsets.US_ASCII);
    }

    private MvcResult register(String email) throws Exception {        return mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Student %s",
                                  "email": "%s",
                                  "mobile": "9876543210",
                                  "password": "Password1", "termsAccepted": true}
                                """.formatted(email, email)))
                .andExpect(status().isCreated())
                .andReturn();
    }
}
