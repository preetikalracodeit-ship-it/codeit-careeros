package com.codeit.careeros.auth;

import com.codeit.careeros.common.enums.ConsentMethod;
import com.codeit.careeros.common.enums.ConsentType;
import com.codeit.careeros.entity.ConsentRecord;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.repository.ConsentRecordRepository;
import com.codeit.careeros.repository.UserRepository;
import com.codeit.careeros.service.GoogleTokenVerifier;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Google authentication proves identity, not consent. These tests replace the
 * network-dependent token verifier so the account-linking and consent rules
 * can be exercised deterministically.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GoogleSignInConsentIntegrationTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ConsentRecordRepository consentRecordRepository;
    @Autowired
    private UserRepository userRepository;

    @MockitoBean
    private GoogleTokenVerifier googleTokenVerifier;

    private void verifyGoogleIdentity(String email, String name) {
        when(googleTokenVerifier.verify(anyString())).thenReturn(
                new GoogleTokenVerifier.VerifiedGoogleUser(email, name, "google-sub", null));
    }

    private List<ConsentRecord> consentFor(String email) {
        User user = userRepository.findByEmail(email).orElseThrow();
        return consentRecordRepository.findAll().stream()
                .filter(r -> r.getUser().getId().equals(user.getId()))
                .toList();
    }

    @Test
    @DisplayName("A new Google identity without explicit consent cannot create an account")
    void newGoogleUser_withoutConsent_isRejected() throws Exception {
        String email = "google-no-consent@test.local";
        verifyGoogleIdentity(email, "No Consent");

        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idToken\": \"stub\", \"termsAccepted\": false}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        org.hamcrest.Matchers.containsString("Terms")));

        assertThat(userRepository.findByEmail(email)).isEmpty();
    }

    @Test
    @DisplayName("A new Google registration with explicit consent stores GOOGLE_REGISTRATION evidence")
    void newGoogleUser_withConsent_persistsEvidence() throws Exception {
        String email = "google-consent@test.local";
        verifyGoogleIdentity(email, "Google Student");

        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idToken\": \"stub\", \"termsAccepted\": true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.consentRequired").value(false));

        List<ConsentRecord> records = consentFor(email);
        assertThat(records).hasSize(1);
        assertThat(records.get(0).getMethod()).isEqualTo(ConsentMethod.GOOGLE_REGISTRATION);
        assertThat(records.get(0).getConsentType()).isEqualTo(ConsentType.TERMS_AND_PRIVACY);
        assertThat(records.get(0).getEvidence())
                .isEqualTo(ConsentRecord.EVIDENCE_GOOGLE_SIGNUP_CHECKBOX);
    }

    @Test
    @DisplayName("An existing Google user can still sign in without re-consenting")
    void existingGoogleUser_signsInWithoutReconsent() throws Exception {
        String email = "google-existing@test.local";

        // Create the account first, then simulate a pre-consent-table user.
        verifyGoogleIdentity(email, "Existing Student");
        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idToken\": \"stub\", \"termsAccepted\": true}"))
                .andExpect(status().isOk());
        consentRecordRepository.deleteAll(consentFor(email));

        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idToken\": \"stub\", \"termsAccepted\": false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.consentRequired").value(true));

        // Signing in must not fabricate consent evidence.
        assertThat(consentFor(email)).isEmpty();
    }

    @Test
    @DisplayName("A deactivated account cannot sign in with Google")
    void deactivatedGoogleUser_isRejected() throws Exception {
        String email = "google-disabled@test.local";
        verifyGoogleIdentity(email, "Disabled Student");

        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idToken\": \"stub\", \"termsAccepted\": true}"))
                .andExpect(status().isOk());

        User user = userRepository.findByEmail(email).orElseThrow();
        user.setStatus(com.codeit.careeros.common.enums.UserStatus.INACTIVE);
        userRepository.saveAndFlush(user);

        mockMvc.perform(post("/api/v1/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idToken\": \"stub\", \"termsAccepted\": true}"))
                .andExpect(status().isForbidden());
    }
}
