package com.codeit.careeros.auth;

import com.codeit.careeros.TestSupport;
import com.codeit.careeros.common.enums.ConsentMethod;
import com.codeit.careeros.common.enums.ConsentType;
import com.codeit.careeros.entity.ConsentRecord;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.repository.ConsentRecordRepository;
import com.codeit.careeros.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ConsentIntegrationTest {

    private static final AtomicInteger SEQ = new AtomicInteger();

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private ConsentRecordRepository consentRecordRepository;
    @Autowired
    private UserRepository userRepository;

    @Value("${app.privacy.policy-version}")
    private String policyVersion;

    private String email() {
        return "consent" + SEQ.incrementAndGet() + "@test.local";
    }

    private MvcResult register(String email) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Consent Student",
                                  "email": "%s",
                                  "mobile": "9876543210",
                                  "password": "Password1",
                                  "termsAccepted": true
                                }
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
    }

    private User user(String email) {
        return userRepository.findByEmail(email).orElseThrow();
    }

    @Test
    @DisplayName("Registration durably stores consent evidence with the policy version and method")
    void registration_persistsDurableConsent() throws Exception {
        String email = email();
        MvcResult result = register(email);

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.path("data").path("consentRequired").asBoolean()).isFalse();
        assertThat(body.path("data").path("consentPolicyVersion").asText()).isEqualTo(policyVersion);

        List<ConsentRecord> records = consentRecordRepository.findAll().stream()
                .filter(r -> r.getUser().getId().equals(user(email).getId()))
                .toList();
        assertThat(records).hasSize(1);
        ConsentRecord record = records.get(0);
        assertThat(record.getConsentType()).isEqualTo(ConsentType.TERMS_AND_PRIVACY);
        assertThat(record.getPolicyVersion()).isEqualTo(policyVersion);
        assertThat(record.getMethod()).isEqualTo(ConsentMethod.PASSWORD_REGISTRATION);
        assertThat(record.getEvidence())
                .isEqualTo(ConsentRecord.EVIDENCE_REGISTRATION_CHECKBOX);
        assertThat(record.getAcceptedAt()).isNotNull();
        assertThat(record.getAcceptedAt()).isBefore(Instant.now().plusSeconds(5));
    }

    @Test
    @DisplayName("Registration without explicit consent creates neither an account nor evidence")
    void registration_withoutConsent_createsNothing() throws Exception {
        String email = email();

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "No Consent",
                                  "email": "%s",
                                  "mobile": "9876543210",
                                  "password": "Password1",
                                  "termsAccepted": false
                                }
                                """.formatted(email)))
                .andExpect(status().isBadRequest());

        assertThat(userRepository.findByEmail(email)).isEmpty();
        assertThat(consentRecordRepository.countByUserId(-1L)).isZero();
    }

    @Test
    @DisplayName("Consent endpoints require authentication")
    void consentEndpoints_requireAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/auth/consent"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/auth/consent")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"termsAccepted\": true}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Repeated consent submissions are idempotent and do not rewrite evidence")
    void repeatedConsent_isIdempotent() throws Exception {
        String email = email();
        MvcResult reg = register(email);
        String token = TestSupport.token(reg, "accessToken");
        Instant originalAcceptedAt = consentRecordRepository
                .findFirstByUserIdAndConsentTypeOrderByAcceptedAtDesc(
                        user(email).getId(), ConsentType.TERMS_AND_PRIVACY)
                .orElseThrow().getAcceptedAt();

        for (int i = 0; i < 2; i++) {
            mockMvc.perform(post("/api/v1/auth/consent")
                            .header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"termsAccepted\": true}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.consentCurrent").value(true))
                    .andExpect(jsonPath("$.data.currentPolicyVersion").value(policyVersion));
        }

        assertThat(consentRecordRepository.countByUserId(user(email).getId())).isEqualTo(1);
        assertThat(consentRecordRepository
                .findFirstByUserIdAndConsentTypeOrderByAcceptedAtDesc(
                        user(email).getId(), ConsentType.TERMS_AND_PRIVACY)
                .orElseThrow().getAcceptedAt()).isEqualTo(originalAcceptedAt);
    }

    @Test
    @DisplayName("Explicitly false re-consent is rejected and records nothing new")
    void reconsent_false_isRejected() throws Exception {
        String email = email();
        MvcResult reg = register(email);
        String token = TestSupport.token(reg, "accessToken");
        User user = user(email);
        long before = consentRecordRepository.countByUserId(user.getId());

        mockMvc.perform(post("/api/v1/auth/consent")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"termsAccepted\": false}"))
                .andExpect(status().isBadRequest());

        assertThat(consentRecordRepository.countByUserId(user.getId())).isEqualTo(before);
    }

    @Test
    @DisplayName("A legacy account without evidence signs in but is flagged consentRequired")
    void legacyAccount_flagsConsentRequired_andCanReconsent() throws Exception {
        String email = email();
        MvcResult reg = register(email);
        User user = user(email);

        // Simulate an account created before the consent table existed.
        consentRecordRepository.deleteAll(
                consentRecordRepository.findAll().stream()
                        .filter(r -> r.getUser().getId().equals(user.getId()))
                        .toList());

        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "%s", "password": "Password1"}
                                """.formatted(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.consentRequired").value(true))
                .andReturn();
        String token = TestSupport.token(login, "accessToken");

        mockMvc.perform(get("/api/v1/auth/consent")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.consentCurrent").value(false))
                .andExpect(jsonPath("$.data.acceptedAt").doesNotExist());

        mockMvc.perform(post("/api/v1/auth/consent")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"termsAccepted\": true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.consentCurrent").value(true));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email": "%s", "password": "Password1"}
                                """.formatted(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.consentRequired").value(false));
    }

    @Test
    @DisplayName("A policy version change requires new evidence and preserves the old record")
    void policyUpdate_keepsHistoryAndRequiresNewConsent() throws Exception {
        String email = email();
        MvcResult reg = register(email);
        String token = TestSupport.token(reg, "accessToken");
        User user = user(email);

        consentRecordRepository.deleteAll(
                consentRecordRepository.findAll().stream()
                        .filter(r -> r.getUser().getId().equals(user.getId()))
                        .toList());
        consentRecordRepository.save(ConsentRecord.builder()
                .user(user)
                .consentType(ConsentType.TERMS_AND_PRIVACY)
                .policyVersion("2020-01-01")
                .method(ConsentMethod.PASSWORD_REGISTRATION)
                .evidence(ConsentRecord.EVIDENCE_REGISTRATION_CHECKBOX)
                .acceptedAt(Instant.now().minus(365, ChronoUnit.DAYS))
                .build());

        mockMvc.perform(get("/api/v1/auth/consent")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.consentCurrent").value(false))
                .andExpect(jsonPath("$.data.acceptedPolicyVersion").value("2020-01-01"));

        mockMvc.perform(post("/api/v1/auth/consent")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"termsAccepted\": true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.consentCurrent").value(true))
                .andExpect(jsonPath("$.data.acceptedPolicyVersion").value(policyVersion));

        List<ConsentRecord> records = consentRecordRepository.findAll().stream()
                .filter(r -> r.getUser().getId().equals(user.getId()))
                .toList();
        assertThat(records).hasSize(2);
        assertThat(records).extracting(ConsentRecord::getPolicyVersion)
                .containsExactlyInAnyOrder("2020-01-01", policyVersion);
    }

    @Test
    @DisplayName("Consent evidence cannot be changed through the ordinary profile update API")
    void profileUpdate_cannotMutateConsentEvidence() throws Exception {
        String email = email();
        MvcResult reg = register(email);
        String token = TestSupport.token(reg, "accessToken");
        User user = user(email);
        ConsentRecord before = consentRecordRepository
                .findFirstByUserIdAndConsentTypeOrderByAcceptedAtDesc(
                        user.getId(), ConsentType.TERMS_AND_PRIVACY)
                .orElseThrow();

        mockMvc.perform(put("/api/v1/students/me")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Renamed Student",
                                  "termsAccepted": true,
                                  "consentRecords": [],
                                  "policyVersion": "9999-12-31"
                                }
                                """))
                .andExpect(status().isOk());

        List<ConsentRecord> after = consentRecordRepository.findAll().stream()
                .filter(r -> r.getUser().getId().equals(user.getId()))
                .toList();
        assertThat(after).hasSize(1);
        assertThat(after.get(0).getId()).isEqualTo(before.getId());
        assertThat(after.get(0).getPolicyVersion()).isEqualTo(before.getPolicyVersion());
        assertThat(after.get(0).getAcceptedAt()).isEqualTo(before.getAcceptedAt());
    }
}
