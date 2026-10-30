package com.codeit.careeros.service;

import com.codeit.careeros.dto.student.StudentProfileRequest;
import com.codeit.careeros.dto.student.StudentProfileResponse;
import com.codeit.careeros.entity.StudentProfile;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.exception.BusinessException;
import com.codeit.careeros.common.enums.Role;
import com.codeit.careeros.repository.StudentProfileRepository;
import com.codeit.careeros.security.CustomUserDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StudentProfileServiceTest {

    @Mock
    private StudentProfileRepository studentProfileRepository;

    @InjectMocks
    private StudentProfileService studentProfileService;

    @BeforeEach
    void setUp() {
        User user = User.builder().id(10L).email("stu@test.local").fullName("Rahul")
                .role(Role.STUDENT).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(new CustomUserDetails(user), null,
                        new CustomUserDetails(user).getAuthorities()));
    }

    @AfterEach
    void tearDown() {
        // Never leak authentication into other test classes sharing the thread:
        // a stale context makes headerless MockMvc requests look authenticated.
        SecurityContextHolder.clearContext();
    }

    @Test
    void getCurrentProfile_returnsProfileForCaller() {
        when(studentProfileRepository.findByUserId(10L)).thenReturn(Optional.of(profile()));

        StudentProfileResponse response = studentProfileService.getCurrentProfile();

        assertThat(response.studentId()).isEqualTo("STU000010");
        assertThat(response.email()).isEqualTo("stu@test.local");
        assertThat(response.fullName()).isEqualTo("Rahul");
    }

    @Test
    void getCurrentProfile_noProfile_throwsNotFound() {
        when(studentProfileRepository.findByUserId(10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> studentProfileService.getCurrentProfile())
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void updateCurrentProfile_updatesAndPersists() {
        StudentProfile existing = profile();
        when(studentProfileRepository.findByUserId(10L)).thenReturn(Optional.of(existing));
        when(studentProfileRepository.save(any(StudentProfile.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        StudentProfileRequest request = new StudentProfileRequest(
                "Rahul Sharma", "9876543210", null, "ABC Engineering College",
                "BTech", "Computer Science", 2027, 5, "Hyderabad", null,
                null, "https://portfolio.example.com");

        StudentProfileResponse response = studentProfileService.updateCurrentProfile(request);

        assertThat(response.college()).isEqualTo("ABC Engineering College");
        assertThat(response.branch()).isEqualTo("Computer Science");
        assertThat(response.semester()).isEqualTo(5);
        assertThat(response.portfolioUrl()).isEqualTo("https://portfolio.example.com");
    }

    private StudentProfile profile() {
        User user = User.builder().id(10L).email("stu@test.local").fullName("Rahul")
                .role(Role.STUDENT).build();
        return StudentProfile.builder().id(1L).user(user).studentId("STU000010")
                .fullName("Rahul").semester(1).build();
    }
}