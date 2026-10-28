package com.codeit.careeros.service;

import com.codeit.careeros.common.enums.ConsentMethod;
import com.codeit.careeros.common.enums.Role;
import com.codeit.careeros.common.enums.UserStatus;
import com.codeit.careeros.dto.auth.AuthResponse;
import com.codeit.careeros.dto.auth.ConsentStatusResponse;
import com.codeit.careeros.dto.auth.LoginRequest;
import com.codeit.careeros.dto.auth.RefreshRequest;
import com.codeit.careeros.dto.auth.RegisterRequest;
import com.codeit.careeros.dto.auth.UserResponse;
import com.codeit.careeros.entity.ConsentRecord;
import com.codeit.careeros.entity.RefreshToken;
import com.codeit.careeros.entity.StudentProfile;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.exception.BusinessException;
import com.codeit.careeros.mapper.UserMapper;
import com.codeit.careeros.repository.RefreshTokenRepository;
import com.codeit.careeros.repository.StudentProfileRepository;
import com.codeit.careeros.repository.UserRepository;
import com.codeit.careeros.security.JwtService;
import com.codeit.careeros.security.SecurityUtils;
import com.codeit.careeros.security.TokenHash;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final GoogleTokenVerifier googleTokenVerifier;
    private final ConsentService consentService;

    @Value("${app.jwt.refresh-expiration-ms:604800000}")
    private long refreshExpirationMs;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.email().toLowerCase().trim();
        requireTerms(request.termsAccepted());
        if (userRepository.existsByEmail(email)) {
            throw BusinessException.conflict("An account with this email already exists");
        }

        User user = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(request.password()))
                .fullName(request.fullName().trim())
                .role(Role.STUDENT)
                .status(UserStatus.ACTIVE)
                .build();
        user = userRepository.save(user);

        StudentProfile profile = StudentProfile.builder()
                .user(user)
                .studentId(generateStudentId(user))
                .fullName(user.getFullName())
                .mobile(request.mobile().trim())
                .semester(1)
                .build();
        studentProfileRepository.save(profile);

        // Durable evidence is written in the same transaction as the account:
        // a registration can never succeed without its consent record.
        consentService.recordCurrentPolicy(user, ConsentMethod.PASSWORD_REGISTRATION,
                ConsentRecord.EVIDENCE_REGISTRATION_CHECKBOX);

        log.info("Registered student {}", user.getId());
        return issueTokens(user);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String email = request.email().toLowerCase().trim();
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(email, request.password()));
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> BusinessException.forbidden("Account is disabled"));
        log.info("Logged in user {} ({})", user.getEmail(), user.getId());
        return issueTokens(user);
    }

    /**
     * Sign in (or auto-register) with a Google ID token verified server-side.
     * Existing email accounts are linked automatically; new Google users get a
     * STUDENT account with a random unusable password hash (password login
     * stays disabled for them — they must keep using Google).
     */
    @Transactional
    public AuthResponse googleLogin(String idToken, Boolean termsAccepted) {
        GoogleTokenVerifier.VerifiedGoogleUser googleUser = googleTokenVerifier.verify(idToken);
        String email = googleUser.email();
        User user = userRepository.findByEmail(email).orElse(null);
        if (user != null && user.getStatus() != UserStatus.ACTIVE) {
            // Google identity is verified, but the CareerOS account itself is
            // deactivated. Do not issue a session.
            throw BusinessException.forbidden("Account is disabled");
        }
        if (user == null) {
            // Google authentication proves identity, not acceptance of the
            // Terms/Privacy Policy. Only new accounts must opt in explicitly.
            requireTerms(termsAccepted);
            user = User.builder()
                    .email(email)
                    .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString() + "-google-oauth"))
                    .fullName(truncate(googleUser.fullName(), 120))
                    .role(Role.STUDENT)
                    .status(UserStatus.ACTIVE)
                    .build();
            user = userRepository.save(user);
            StudentProfile profile = StudentProfile.builder()
                    .user(user)
                    .studentId(generateStudentId(user))
                    .fullName(user.getFullName())
                    .semester(1)
                    .build();
            studentProfileRepository.save(profile);
            // The Google sign-up button is presented with linked Terms/Privacy
            // notice; clicking it is the user's explicit sign-up consent action.
            consentService.recordCurrentPolicy(user, ConsentMethod.GOOGLE_REGISTRATION,
                    ConsentRecord.EVIDENCE_GOOGLE_SIGNUP_BUTTON);
            log.info("Registered student via Google {}", user.getId());
        } else {
            // Existing accounts keep their previous sign-in behaviour. They
            // are not forced to re-consent here; if they have no evidence for
            // the current policy the response flags consentRequired instead.
            log.info("Logged in user via Google {}", user.getId());
        }
        return issueTokens(user);
    }

    private static void requireTerms(Boolean accepted) {
        if (!Boolean.TRUE.equals(accepted)) {
            throw BusinessException.badRequest(
                    "You must accept the Terms of Service and Privacy Policy to create an account");
        }
    }

    private static String truncate(String value, int max) {
        if (value == null) return "Student";
        String trimmed = value.trim();
        if (trimmed.isEmpty()) return "Student";
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max);
    }

    @Transactional
    public AuthResponse refresh(RefreshRequest request) {
        String tokenHash = TokenHash.sha256(request.refreshToken());
        RefreshToken stored = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> BusinessException.unauthorized("Invalid refresh token"));

        if (stored.isRevoked()) {
            revokeAllForUser(stored.getUser().getId());
            throw BusinessException.unauthorized("Refresh token reuse detected. All sessions revoked.");
        }
        if (stored.isExpired()) {
            throw BusinessException.unauthorized("Refresh token has expired");
        }

        User user = stored.getUser();
        if (user.getStatus() != UserStatus.ACTIVE) {
            // Revoke outstanding sessions of a deactivated account and stop
            // renewal immediately; do not wait for token expiry.
            revokeAllForUser(user.getId());
            throw BusinessException.unauthorized("Account is disabled");
        }
        IssuedRefreshToken replacement = issueNewRefreshToken(user);
        stored.setRevoked(true);
        stored.setReplacedById(replacement.entity().getId());
        refreshTokenRepository.save(stored);

        return new AuthResponse(
                jwtService.generateAccessToken(user.getId(), user.getEmail(), user.getRole().name()),
                replacement.raw(),
                "Bearer",
                jwtService.getAccessExpirationMs() / 1000,
                UserMapper.toResponse(user),
                !consentService.isCurrent(user),
                consentService.currentPolicyVersion());
    }

    @Transactional
    public void logout(String refreshToken) {
        RefreshToken stored = refreshTokenRepository
                .findByTokenHash(TokenHash.sha256(refreshToken))
                .orElseThrow(() -> BusinessException.unauthorized("Invalid refresh token"));
        stored.setRevoked(true);
        refreshTokenRepository.save(stored);
        log.info("Logged out user {}", stored.getUser().getId());
    }

    public UserResponse me() {
        return UserMapper.toResponse(currentUser());
    }

    @Transactional(readOnly = true)
    public ConsentStatusResponse consentStatus() {
        return consentService.status(currentUser());
    }

    @Transactional
    public ConsentStatusResponse acceptConsent(Boolean termsAccepted) {
        return consentService.acceptCurrentPolicy(currentUser(), termsAccepted);
    }

    private User currentUser() {
        return userRepository.findById(SecurityUtils.currentUserId())
                .orElseThrow(() -> BusinessException.notFound("User not found"));
    }

    /**
     * Issues a fresh session for an already-authenticated user. Used by the
     * staff-invitation acceptance flow after the account has been created or
     * verified; it performs no authentication of its own.
     */
    @Transactional
    public AuthResponse issueSession(User user) {
        return issueTokens(user);
    }

    private AuthResponse issueTokens(User user) {
        IssuedRefreshToken refresh = issueNewRefreshToken(user);
        return new AuthResponse(
                jwtService.generateAccessToken(user.getId(), user.getEmail(), user.getRole().name()),
                refresh.raw(),
                "Bearer",
                jwtService.getAccessExpirationMs() / 1000,
                UserMapper.toResponse(user),
                !consentService.isCurrent(user),
                consentService.currentPolicyVersion());
    }

    private IssuedRefreshToken issueNewRefreshToken(User user) {
        String raw = UUID.randomUUID().toString().replace("-", "")
                + "-" + UUID.randomUUID().toString().replace("-", "");
        RefreshToken entity = RefreshToken.builder()
                .user(user)
                .tokenHash(TokenHash.sha256(raw))
                .expiresAt(Instant.now().plus(refreshExpirationMs, ChronoUnit.MILLIS))
                .build();
        entity = refreshTokenRepository.save(entity);
        return new IssuedRefreshToken(raw, entity);
    }

    private void revokeAllForUser(Long userId) {
        refreshTokenRepository.findAllByUserIdOrderByCreatedAtDesc(userId)
                .forEach(token -> {
                    token.setRevoked(true);
                    refreshTokenRepository.save(token);
                });
    }

    private String generateStudentId(User user) {
        return "STU" + String.format("%06d", user.getId());
    }

    private record IssuedRefreshToken(String raw, RefreshToken entity) {
    }
}
