package com.codeit.careeros.college.service;

import com.codeit.careeros.college.entity.AcademicYear;
import com.codeit.careeros.college.entity.Batch;
import com.codeit.careeros.college.entity.CsvImportRow;
import com.codeit.careeros.college.entity.Department;
import com.codeit.careeros.college.entity.Program;
import com.codeit.careeros.college.entity.Section;
import com.codeit.careeros.college.entity.StudentEnrollment;
import com.codeit.careeros.college.enums.EnrollmentStatus;
import com.codeit.careeros.college.enums.ImportRowStatus;
import com.codeit.careeros.college.repository.AcademicYearRepository;
import com.codeit.careeros.college.repository.BatchRepository;
import com.codeit.careeros.college.repository.CsvImportRowRepository;
import com.codeit.careeros.college.repository.DepartmentRepository;
import com.codeit.careeros.college.repository.ProgramRepository;
import com.codeit.careeros.college.repository.SectionRepository;
import com.codeit.careeros.college.repository.StudentEnrollmentRepository;
import com.codeit.careeros.common.enums.Role;
import com.codeit.careeros.common.enums.UserStatus;
import com.codeit.careeros.entity.StudentProfile;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.exception.BusinessException;
import com.codeit.careeros.repository.StudentProfileRepository;
import com.codeit.careeros.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Processes one CSV staging row in its own transaction so a single bad row
 * cannot roll back the rest of the import. This is a separate bean because
 * Spring's transaction proxy does not apply to self-invocation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CsvImportRowProcessor {

    private final CsvImportRowRepository rowRepository;
    private final DepartmentRepository departmentRepository;
    private final ProgramRepository programRepository;
    private final BatchRepository batchRepository;
    private final SectionRepository sectionRepository;
    private final AcademicYearRepository academicYearRepository;
    private final StudentEnrollmentRepository enrollmentRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public CsvImportRow process(Long rowId, Long jobId, Long institutionId) {
        CsvImportRow row = rowRepository.findByIdAndJobId(rowId, jobId)
                .orElseThrow(() -> BusinessException.notFound("Import row not found"));
        if (row.getStatus() != ImportRowStatus.READY) {
            return row;
        }
        try {
            Resolved resolved = resolve(institutionId, row);
            User user = userRepository.findByEmail(resolved.email()).orElse(null);
            if (user != null) {
                if (user.getRole() != Role.STUDENT) {
                    return saveReject(row, "This email belongs to a staff or administrator account");
                }
                if (user.getStatus() != UserStatus.ACTIVE) {
                    return saveReject(row, "This student account is not active");
                }
                StudentProfile profile = studentProfileRepository.findByUserId(user.getId())
                        .orElseGet(() -> createProfile(user, resolved));
                if (enrollmentRepository.existsByStudentProfileIdAndInstitutionId(
                        profile.getId(), institutionId)) {
                    return saveSkip(row, "This student is already enrolled in the institution");
                }
                if (enrollmentRepository.existsByStudentProfileId(profile.getId())) {
                    return saveReject(row, "This student already belongs to another institution");
                }
                createEnrollment(profile, institutionId, resolved);
                row.setStatus(ImportRowStatus.LINKED);
                row.setMessage("Linked existing student account");
            } else {
                User created = User.builder()
                        .email(resolved.email())
                        // Imported accounts have no credential-delivery channel
                        // yet. A random unusable password is stored; the student
                        // must go through an approved recovery/activation flow.
                        .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString()))
                        .fullName(resolved.fullName())
                        .role(Role.STUDENT)
                        .status(UserStatus.ACTIVE)
                        .build();
                created = userRepository.save(created);
                StudentProfile profile = createProfile(created, resolved);
                createEnrollment(profile, institutionId, resolved);
                row.setStatus(ImportRowStatus.CREATED);
                row.setMessage("Created student account and enrollment");
            }
            return rowRepository.save(row);
        } catch (BusinessException e) {
            return saveReject(row, e.getMessage());
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(Long rowId, Long jobId, String message) {
        rowRepository.findByIdAndJobId(rowId, jobId).ifPresent(row -> {
            if (row.getStatus() == ImportRowStatus.READY) {
                row.setStatus(ImportRowStatus.REJECTED);
                row.setMessage(message);
                rowRepository.save(row);
            }
        });
    }

    private Resolved resolve(Long institutionId, CsvImportRow row) {
        String email = normalizeEmail(row.getEmail());
        String fullName = require(row.getFullName(), "Full name", 120);
        String roll = require(row.getRollNumber(), "Roll number", 40);
        String departmentCode = require(row.getDepartmentCode(), "Department code", 40);
        String programCode = require(row.getProgramCode(), "Program code", 40);
        String batchLabel = require(row.getBatchLabel(), "Batch label", 40);

        Department department = departmentRepository
                .findByInstitutionIdAndCodeIgnoreCase(institutionId, departmentCode)
                .orElseThrow(() -> BusinessException.badRequest("Unknown department code: " + departmentCode));
        Program program = programRepository
                .findByInstitutionIdAndCodeIgnoreCase(institutionId, programCode)
                .orElseThrow(() -> BusinessException.badRequest("Unknown program code: " + programCode));
        if (!program.getDepartment().getId().equals(department.getId())) {
            throw BusinessException.badRequest(
                    "Program " + programCode + " does not belong to department " + departmentCode);
        }
        Batch batch = batchRepository.findByProgramIdAndLabelIgnoreCase(program.getId(), batchLabel)
                .orElseThrow(() -> BusinessException.badRequest(
                        "Unknown batch " + batchLabel + " for program " + programCode));

        AcademicYear year = null;
        if (row.getAcademicYearLabel() != null && !row.getAcademicYearLabel().isBlank()) {
            year = academicYearRepository
                    .findByInstitutionIdAndLabelIgnoreCase(institutionId, row.getAcademicYearLabel().trim())
                    .orElseThrow(() -> BusinessException.badRequest(
                            "Unknown academic year: " + row.getAcademicYearLabel()));
            if (!year.getId().equals(batch.getAcademicYear().getId())) {
                throw BusinessException.badRequest(
                        "Batch " + batchLabel + " does not belong to academic year " + year.getLabel());
            }
        }

        Section section = null;
        if (row.getSectionName() != null && !row.getSectionName().isBlank()) {
            section = sectionRepository.findByBatchIdAndNameIgnoreCase(batch.getId(), row.getSectionName().trim())
                    .orElseThrow(() -> BusinessException.badRequest(
                            "Unknown section " + row.getSectionName() + " for batch " + batchLabel));
        }

        String mobile = row.getMobile() == null ? null : row.getMobile().trim();
        if (mobile != null && !mobile.isEmpty() && !mobile.matches("^[0-9+\\- ]{6,20}$")) {
            throw BusinessException.badRequest("Mobile number is not valid");
        }
        return new Resolved(fullName, email, mobile, roll, department, program, batch, section);
    }

    private StudentProfile createProfile(User user, Resolved resolved) {
        StudentProfile profile = StudentProfile.builder()
                .user(user)
                .studentId("STU" + String.format("%06d", user.getId()))
                .fullName(resolved.fullName())
                .mobile(resolved.mobile())
                .semester(1)
                .build();
        return studentProfileRepository.save(profile);
    }

    private void createEnrollment(StudentProfile profile, Long institutionId, Resolved resolved) {
        StudentEnrollment enrollment = StudentEnrollment.builder()
                .studentProfile(profile)
                .institution(resolved.department().getInstitution())
                .department(resolved.department())
                .program(resolved.program())
                .batch(resolved.batch())
                .section(resolved.section())
                .rollNumber(resolved.roll())
                .status(EnrollmentStatus.ACTIVE)
                .build();
        enrollmentRepository.save(enrollment);
    }

    private static CsvImportRow reject(CsvImportRow row, String message) {
        row.setStatus(ImportRowStatus.REJECTED);
        row.setMessage(truncate(message, 500));
        return row;
    }

    private static CsvImportRow skip(CsvImportRow row, String message) {
        row.setStatus(ImportRowStatus.SKIPPED);
        row.setMessage(truncate(message, 500));
        return row;
    }

    private CsvImportRow saveReject(CsvImportRow row, String message) {
        return rowRepository.save(reject(row, message));
    }

    private CsvImportRow saveSkip(CsvImportRow row, String message) {
        return rowRepository.save(skip(row, message));
    }

    private static String require(String value, String label, int max) {
        String cleaned = value == null ? "" : value.trim();
        if (cleaned.isEmpty()) {
            throw BusinessException.badRequest(label + " is required");
        }
        if (cleaned.length() > max) {
            throw BusinessException.badRequest(label + " must be at most " + max + " characters");
        }
        return cleaned;
    }

    private static String normalizeEmail(String value) {
        String email = value == null ? "" : value.trim().toLowerCase(java.util.Locale.ROOT);
        if (email.length() > 190 || !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw BusinessException.badRequest("Email is not valid");
        }
        return email;
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        String cleaned = value.replaceAll("[\\r\\n\\t]+", " ").strip();
        return cleaned.length() <= max ? cleaned : cleaned.substring(0, max);
    }

    private record Resolved(
            String fullName,
            String email,
            String mobile,
            String roll,
            Department department,
            Program program,
            Batch batch,
            Section section) {
    }
}
