package com.codeit.careeros.auth;

import com.codeit.careeros.entity.StudentProfile;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.repository.StudentProfileRepository;
import com.codeit.careeros.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RegisterMobilePersistenceTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StudentProfileRepository studentProfileRepository;

    @Test
    @DisplayName("Register persists the mobile number on the student profile")
    void register_persistsMobileOnProfile() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName": "Mobile Student",
                                  "email": "mobilepersist@test.local",
                                  "mobile": "9876543210",
                                  "password": "Password1", "termsAccepted": true}
                                """))
                .andExpect(status().isCreated());

        User user = userRepository.findByEmail("mobilepersist@test.local").orElseThrow();
        StudentProfile profile = studentProfileRepository.findByUserId(user.getId()).orElseThrow();
        assertThat(profile.getMobile()).isEqualTo("9876543210");
    }
}
