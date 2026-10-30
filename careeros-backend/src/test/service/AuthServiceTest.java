package com.codeit.careeros.service;

import com.codeit.careeros.common.enums.Role;
import com.codeit.careeros.common.enums.UserStatus;
import com.codeit.careeros.dto.auth.AuthResponse;
import com.codeit.careeros.dto.auth.LoginRequest;
import com.codeit.careeros.dto.auth.RegisterRequest;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.exception.BusinessException;
import com.codeit.careeros.repository.RefreshTokenRepository;
import com.codeit.careeros.repository.StudentProfileRepository;
import com.codeit.careeros.repository.UserRepository;
import com.codeit.careeros.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private StudentProfileRepository studentProfileRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private AuthenticationManager authenticationManager;
    @Mock
    private JwtService jwtService;
    @Mock
    private GoogleTokenVerifier googleTokenVerifier;
    @Mock
    private ConsentService consentService;

    @InjectMocks
    private AuthService authService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(authService, "refreshExpirationMs", 604_800_000L);
    }

    @Test
    void register_createsStudentAndProfileAndEncodesPassword() {
        when(userRepository.existsByEmail("john@test.local")).thenReturn(false);
        User saved = User.builder().id(7L).email("john@test.local")
                .passwordHash("$2a$10$encoded").fullName("John Doe")
                .role(Role.STUDENT).status(UserStatus.ACTIVE).build();
        when(userRepository.save(any(User.class))).thenReturn(saved);
        when(passwordEncoder.encode("Password1")).thenReturn("$2a$10$encoded");
        when(jwtService.generateAccessToken(any(), anyString(), anyString())).thenReturn("access-token");
        when(jwtService.getAccessExpirationMs()).thenReturn(900_000L);

        RegisterRequest request = new RegisterRequest("John Doe", "john@test.local", "9876543210", "Password1", true);
        AuthResponse response = authService.register(request);

        assertThat(response.accessToken()).isEqualTo("access-token");
        assertThat(response.refreshToken()).isNotBlank();
        assertThat(response.user().role()).isEqualTo("STUDENT");
        assertThat(response.user().email()).isEqualTo("john@test.local");
        verify(passwordEncoder).encode("Password1");
        verify(studentProfileRepository).save(any());
    }

    @Test
    void register_duplicateEmail_throwsConflict() {
        when(userRepository.existsByEmail("john@test.local")).thenReturn(true);

        RegisterRequest request = new RegisterRequest("John Doe", "john@test.local", "9876543210", "Password1", true);

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("already exists");
        verify(userRepository, never()).save(any());
        verify(studentProfileRepository, never()).save(any());
    }

    @Test
    void login_validCredentials_returnsTokens() {
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(new UsernamePasswordAuthenticationToken("john@test.local", "Password1"));
        when(userRepository.findByEmail("john@test.local")).thenReturn(
                java.util.Optional.of(User.builder().id(1L).email("john@test.local")
                        .fullName("John Doe").role(Role.STUDENT).status(UserStatus.ACTIVE).build()));
        when(jwtService.generateAccessToken(1L, "john@test.local", "STUDENT")).thenReturn("access-token");
        when(jwtService.getAccessExpirationMs()).thenReturn(900_000L);

        LoginRequest request = new LoginRequest("john@test.local", "Password1");
        AuthResponse response = authService.login(request);

        assertThat(response.accessToken()).isEqualTo("access-token");
        assertThat(response.refreshToken()).isNotBlank();
        assertThat(response.user().fullName()).isEqualTo("John Doe");
    }

    @Test
    void login_wrongPassword_propagatesBadCredentials() {
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenThrow(new BadCredentialsException("Bad credentials"));

        LoginRequest request = new LoginRequest("john@test.local", "WrongPass1");

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(BadCredentialsException.class);
        verify(userRepository, never()).findByEmail(anyString());
    }

    @Test
    void register_withoutConsent_isRejectedBeforeCreatingAccount() {
        RegisterRequest request = new RegisterRequest(
                "John Doe", "john@test.local", "9876543210", "Password1", false);

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Terms");
        verify(userRepository, never()).existsByEmail(anyString());
        verify(userRepository, never()).save(any());
    }

    @Test
    void googleLogin_newAccountWithoutConsent_isRejected() {
        when(googleTokenVerifier.verify("google-token")).thenReturn(
                new GoogleTokenVerifier.VerifiedGoogleUser(
                        "new-google@test.local", "New Google", "sub-1", null));
        when(userRepository.findByEmail("new-google@test.local")).thenReturn(java.util.Optional.empty());

        assertThatThrownBy(() -> authService.googleLogin("google-token", false))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Terms");
        verify(userRepository, never()).save(any());
    }

    @Test
    void googleLogin_existingAccountDoesNotRequireRepeatConsent() {
        User existing = User.builder().id(42L).email("existing-google@test.local")
                .fullName("Existing Google").role(Role.STUDENT).status(UserStatus.ACTIVE).build();
        when(googleTokenVerifier.verify("google-token")).thenReturn(
                new GoogleTokenVerifier.VerifiedGoogleUser(
                        "existing-google@test.local", "Existing Google", "sub-2", null));
        when(userRepository.findByEmail("existing-google@test.local"))
                .thenReturn(java.util.Optional.of(existing));
        when(jwtService.generateAccessToken(42L, "existing-google@test.local", "STUDENT"))
                .thenReturn("access-token");
        when(jwtService.getAccessExpirationMs()).thenReturn(900_000L);

        AuthResponse response = authService.googleLogin("google-token", null);

        assertThat(response.accessToken()).isEqualTo("access-token");
        assertThat(response.user().email()).isEqualTo("existing-google@test.local");
        verify(studentProfileRepository, never()).save(any());
    }

    @Test
    void googleLogin_newAccountWithConsent_createsStudent() {
        when(googleTokenVerifier.verify("google-token")).thenReturn(
                new GoogleTokenVerifier.VerifiedGoogleUser(
                        "consented-google@test.local", "Consented Google", "sub-3", null));
        when(userRepository.findByEmail("consented-google@test.local")).thenReturn(java.util.Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("$2a$10$encoded");
        User saved = User.builder().id(43L).email("consented-google@test.local")
                .passwordHash("$2a$10$encoded").fullName("Consented Google")
                .role(Role.STUDENT).status(UserStatus.ACTIVE).build();
        when(userRepository.save(any(User.class))).thenReturn(saved);
        when(jwtService.generateAccessToken(43L, "consented-google@test.local", "STUDENT"))
                .thenReturn("access-token");
        when(jwtService.getAccessExpirationMs()).thenReturn(900_000L);

        AuthResponse response = authService.googleLogin("google-token", true);

        assertThat(response.accessToken()).isEqualTo("access-token");
        verify(studentProfileRepository).save(any());
    }
}