package com.codeit.careeros.college.service;

import com.codeit.careeros.college.dto.AcademicDtos;
import com.codeit.careeros.college.entity.AcademicYear;
import com.codeit.careeros.college.entity.Batch;
import com.codeit.careeros.college.entity.Department;
import com.codeit.careeros.college.entity.Institution;
import com.codeit.careeros.college.entity.Program;
import com.codeit.careeros.college.entity.Section;
import com.codeit.careeros.college.enums.InstitutionStatus;
import com.codeit.careeros.college.enums.ScopeType;
import com.codeit.careeros.college.repository.AcademicYearRepository;
import com.codeit.careeros.college.repository.BatchRepository;
import com.codeit.careeros.college.repository.DepartmentRepository;
import com.codeit.careeros.college.repository.InstitutionRepository;
import com.codeit.careeros.college.repository.ProgramRepository;
import com.codeit.careeros.college.repository.SectionRepository;
import com.codeit.careeros.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AcademicStructureService {

    private static final Pattern CODE = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$");

    private final InstitutionRepository institutionRepository;
    private final DepartmentRepository departmentRepository;
    private final ProgramRepository programRepository;
    private final AcademicYearRepository academicYearRepository;
    private final BatchRepository batchRepository;
    private final SectionRepository sectionRepository;
    private final AcademicScopeService academicScopeService;
    private final AuditService auditService;

    // ---- Platform administration (ADMIN only; no college scope) ----

    @Transactional
    public AcademicDtos.InstitutionResponse createInstitution(AcademicDtos.InstitutionRequest request) {
        String code = requireCode(request.code(), "Institution code");
        if (institutionRepository.existsByCodeIgnoreCase(code)) {
            throw BusinessException.conflict("An institution with this code already exists");
        }
        Institution institution = Institution.builder()
                .code(code.toUpperCase(Locale.ROOT))
                .name(requireText(request.name(), "Institution name", 160))
                .timezone(trimToNull(request.timezone(), 60))
                .contactEmail(normalizeEmail(request.contactEmail()))
                .status(request.status() == null ? InstitutionStatus.ACTIVE : request.status())
                .build();
        institution = institutionRepository.save(institution);
        auditService.success("INSTITUTION_CREATE", "INSTITUTION", String.valueOf(institution.getId()),
                institution.getId(), null, "code=" + institution.getCode());
        return toResponse(institution);
    }

    @Transactional(readOnly = true)
    public List<AcademicDtos.InstitutionResponse> listInstitutions() {
        return institutionRepository.findAllByOrderByNameAsc().stream()
                .map(AcademicStructureService::toResponse)
                .toList();
    }

    @Transactional
    public AcademicDtos.InstitutionResponse updateInstitutionStatus(Long institutionId,
                                                                    InstitutionStatus status) {
        Institution institution = institutionRepository.findById(institutionId)
                .orElseThrow(() -> BusinessException.notFound("Institution not found"));
        if (status == null) {
            throw BusinessException.badRequest("Status is required");
        }
        institution.setStatus(status);
        institution = institutionRepository.save(institution);
        auditService.success("INSTITUTION_STATUS_CHANGE", "INSTITUTION", String.valueOf(institutionId),
                institutionId, null, "status=" + status);
        return toResponse(institution);
    }

    @Transactional
    public AcademicDtos.InstitutionResponse updateInstitutionAsAdmin(
            Long institutionId, AcademicDtos.InstitutionRequest request) {
        Institution institution = institutionRepository.findById(institutionId)
                .orElseThrow(() -> BusinessException.notFound("Institution not found"));
        institution.setName(requireText(request.name(), "Institution name", 160));
        institution.setTimezone(trimToNull(request.timezone(), 60));
        institution.setContactEmail(normalizeEmail(request.contactEmail()));
        institution = institutionRepository.save(institution);
        auditService.success("INSTITUTION_UPDATE", "INSTITUTION", String.valueOf(institution.getId()),
                institution.getId(), null, "name=" + institution.getName());
        return toResponse(institution);
    }

    @Transactional
    public AcademicDtos.InstitutionResponse updateInstitution(CollegeScope scope,
                                                              AcademicDtos.InstitutionRequest request) {
        scope.requireManageStructure();
        Institution institution = institutionRepository.findById(scope.institutionId())
                .orElseThrow(() -> BusinessException.notFound("Institution not found"));
        institution.setName(requireText(request.name(), "Institution name", 160));
        institution.setTimezone(trimToNull(request.timezone(), 60));
        institution.setContactEmail(normalizeEmail(request.contactEmail()));
        institution = institutionRepository.save(institution);
        auditService.success("INSTITUTION_UPDATE", "INSTITUTION", String.valueOf(institution.getId()),
                institution.getId(), scope, "name=" + institution.getName());
        return toResponse(institution);
    }

    // ---- Academic structure ----

    @Transactional(readOnly = true)
    public AcademicDtos.AcademicStructureResponse structure(CollegeScope scope) {
        Institution institution = institutionRepository.findById(scope.institutionId())
                .orElseThrow(() -> BusinessException.notFound("Institution not found"));

        List<Department> departments = departmentRepository
                .findByInstitutionIdOrderByNameAsc(scope.institutionId());
        List<Program> programs = programRepository
                .findByInstitutionIdOrderByNameAsc(scope.institutionId());
        List<AcademicYear> years = academicYearRepository
                .findByInstitutionIdOrderByStartDateDesc(scope.institutionId());
        List<Batch> batches = batchRepository
                .findByProgramInstitutionIdOrderByLabelAsc(scope.institutionId());
        List<Section> sections = sectionRepository
                .findByBatchProgramInstitutionIdOrderByNameAsc(scope.institutionId());

        Set<Long> departmentIds = visibleDepartmentIds(scope, departments);
        Set<Long> programIds = programs.stream()
                .filter(p -> departmentIds.contains(p.getDepartment().getId()))
                .map(Program::getId).collect(Collectors.toSet());
        Set<Long> batchIds = batches.stream()
                .filter(b -> programIds.contains(b.getProgram().getId()))
                .map(Batch::getId).collect(Collectors.toSet());
        Set<Long> sectionIds = sections.stream()
                .filter(s -> batchIds.contains(s.getBatch().getId()))
                .map(Section::getId).collect(Collectors.toSet());

        return new AcademicDtos.AcademicStructureResponse(
                toResponse(institution),
                departments.stream().filter(d -> departmentIds.contains(d.getId()))
                        .map(AcademicStructureService::toResponse).toList(),
                programs.stream().filter(p -> programIds.contains(p.getId()))
                        .map(AcademicStructureService::toResponse).toList(),
                years.stream().map(AcademicStructureService::toResponse).toList(),
                batches.stream().filter(b -> batchIds.contains(b.getId()))
                        .map(AcademicStructureService::toResponse).toList(),
                sections.stream().filter(s -> sectionIds.contains(s.getId()))
                        .map(AcademicStructureService::toResponse).toList());
    }

    private Set<Long> visibleDepartmentIds(CollegeScope scope, List<Department> departments) {
        return switch (scope.scopeType()) {
            case INSTITUTION -> departments.stream().map(Department::getId).collect(Collectors.toSet());
            case DEPARTMENT -> Set.of(scope.scopeId());
            case PROGRAM -> {
                Program p = programRepository.findByIdAndInstitutionId(scope.scopeId(), scope.institutionId())
                        .orElseThrow(() -> BusinessException.notFound("Program not found"));
                yield Set.of(p.getDepartment().getId());
            }
            case BATCH -> {
                Batch b = academicScopeService.requireBatch(scope.institutionId(), scope.scopeId());
                yield Set.of(b.getProgram().getDepartment().getId());
            }
            case SECTION -> {
                Section s = academicScopeService.requireSection(scope.institutionId(), scope.scopeId());
                yield Set.of(s.getBatch().getProgram().getDepartment().getId());
            }
        };
    }

    @Transactional
    public AcademicDtos.DepartmentResponse createDepartment(CollegeScope scope,
                                                            AcademicDtos.DepartmentRequest request) {
        scope.requireManageStructure();
        String code = requireCode(request.code(), "Department code");
        if (departmentRepository.existsByInstitutionIdAndCodeIgnoreCase(scope.institutionId(), code)) {
            throw BusinessException.conflict("A department with this code already exists in the institution");
        }
        Institution institution = institutionRepository.findById(scope.institutionId())
                .orElseThrow(() -> BusinessException.notFound("Institution not found"));
        Department department = Department.builder()
                .institution(institution)
                .code(code.toUpperCase(Locale.ROOT))
                .name(requireText(request.name(), "Department name", 160))
                .status(request.status() == null ? InstitutionStatus.ACTIVE : request.status())
                .build();
        department = departmentRepository.save(department);
        auditService.success("DEPARTMENT_CREATE", "DEPARTMENT", String.valueOf(department.getId()),
                scope.institutionId(), scope, "code=" + department.getCode());
        return toResponse(department);
    }

    @Transactional
    public AcademicDtos.DepartmentResponse updateDepartment(CollegeScope scope, Long id,
                                                            AcademicDtos.DepartmentRequest request) {
        scope.requireManageStructure();
        Department department = academicScopeService.requireDepartment(scope.institutionId(), id);
        String code = requireCode(request.code(), "Department code");
        departmentRepository.findByInstitutionIdAndCodeIgnoreCase(scope.institutionId(), code)
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw BusinessException.conflict("A department with this code already exists in the institution");
                });
        department.setCode(code.toUpperCase(Locale.ROOT));
        department.setName(requireText(request.name(), "Department name", 160));
        if (request.status() != null) {
            department.setStatus(request.status());
        }
        department = departmentRepository.save(department);
        auditService.success("DEPARTMENT_UPDATE", "DEPARTMENT", String.valueOf(id),
                scope.institutionId(), scope, "code=" + department.getCode());
        return toResponse(department);
    }

    @Transactional
    public AcademicDtos.ProgramResponse createProgram(CollegeScope scope,
                                                      AcademicDtos.ProgramRequest request) {
        scope.requireManageStructure();
        if (request.departmentId() == null) {
            throw BusinessException.badRequest("Department is required");
        }
        Department department = academicScopeService.requireDepartment(scope.institutionId(), request.departmentId());
        String code = requireCode(request.code(), "Program code");
        if (programRepository.existsByInstitutionIdAndCodeIgnoreCase(scope.institutionId(), code)) {
            throw BusinessException.conflict("A program with this code already exists in the institution");
        }
        Institution institution = institutionRepository.findById(scope.institutionId())
                .orElseThrow(() -> BusinessException.notFound("Institution not found"));
        Program program = Program.builder()
                .institution(institution)
                .department(department)
                .code(code.toUpperCase(Locale.ROOT))
                .name(requireText(request.name(), "Program name", 160))
                .degreeType(trimToNull(request.degreeType(), 60))
                .durationYears(validDuration(request.durationYears()))
                .status(request.status() == null ? InstitutionStatus.ACTIVE : request.status())
                .build();
        program = programRepository.save(program);
        auditService.success("PROGRAM_CREATE", "PROGRAM", String.valueOf(program.getId()),
                scope.institutionId(), scope, "code=" + program.getCode());
        return toResponse(program);
    }

    @Transactional
    public AcademicDtos.ProgramResponse updateProgram(CollegeScope scope, Long id,
                                                      AcademicDtos.ProgramRequest request) {
        scope.requireManageStructure();
        Program program = academicScopeService.requireProgram(scope.institutionId(), id);
        Department department = academicScopeService.requireDepartment(scope.institutionId(), request.departmentId());
        String code = requireCode(request.code(), "Program code");
        programRepository.findByInstitutionIdAndCodeIgnoreCase(scope.institutionId(), code)
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw BusinessException.conflict("A program with this code already exists in the institution");
                });
        program.setDepartment(department);
        program.setCode(code.toUpperCase(Locale.ROOT));
        program.setName(requireText(request.name(), "Program name", 160));
        program.setDegreeType(trimToNull(request.degreeType(), 60));
        program.setDurationYears(validDuration(request.durationYears()));
        if (request.status() != null) {
            program.setStatus(request.status());
        }
        program = programRepository.save(program);
        auditService.success("PROGRAM_UPDATE", "PROGRAM", String.valueOf(id),
                scope.institutionId(), scope, "code=" + program.getCode());
        return toResponse(program);
    }

    @Transactional
    public AcademicDtos.AcademicYearResponse createAcademicYear(CollegeScope scope,
                                                                AcademicDtos.AcademicYearRequest request) {
        scope.requireManageStructure();
        String label = requireText(request.label(), "Academic year label", 40);
        if (academicYearRepository.existsByInstitutionIdAndLabelIgnoreCase(scope.institutionId(), label)) {
            throw BusinessException.conflict("This academic year already exists in the institution");
        }
        validateDates(request.startDate(), request.endDate());
        Institution institution = institutionRepository.findById(scope.institutionId())
                .orElseThrow(() -> BusinessException.notFound("Institution not found"));
        boolean active = Boolean.TRUE.equals(request.active());
        if (active) {
            deactivateAcademicYears(scope.institutionId());
        }
        AcademicYear year = AcademicYear.builder()
                .institution(institution)
                .label(label)
                .startDate(request.startDate())
                .endDate(request.endDate())
                .active(active)
                .build();
        year = academicYearRepository.save(year);
        auditService.success("ACADEMIC_YEAR_CREATE", "ACADEMIC_YEAR", String.valueOf(year.getId()),
                scope.institutionId(), scope, "label=" + label);
        return toResponse(year);
    }

    @Transactional
    public AcademicDtos.AcademicYearResponse updateAcademicYear(CollegeScope scope, Long id,
                                                                AcademicDtos.AcademicYearRequest request) {
        scope.requireManageStructure();
        AcademicYear year = academicScopeService.requireAcademicYear(scope.institutionId(), id);
        String label = requireText(request.label(), "Academic year label", 40);
        academicYearRepository.findByInstitutionIdAndLabelIgnoreCase(scope.institutionId(), label)
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw BusinessException.conflict("This academic year already exists in the institution");
                });
        validateDates(request.startDate(), request.endDate());
        boolean active = Boolean.TRUE.equals(request.active());
        if (active) {
            deactivateAcademicYears(scope.institutionId());
        }
        year.setLabel(label);
        year.setStartDate(request.startDate());
        year.setEndDate(request.endDate());
        year.setActive(active);
        year = academicYearRepository.save(year);
        auditService.success("ACADEMIC_YEAR_UPDATE", "ACADEMIC_YEAR", String.valueOf(id),
                scope.institutionId(), scope, "label=" + label);
        return toResponse(year);
    }

    private void deactivateAcademicYears(Long institutionId) {
        academicYearRepository.findByInstitutionIdOrderByStartDateDesc(institutionId).forEach(y -> {
            if (y.isActive()) {
                y.setActive(false);
                academicYearRepository.save(y);
            }
        });
    }

    @Transactional
    public AcademicDtos.BatchResponse createBatch(CollegeScope scope, AcademicDtos.BatchRequest request) {
        scope.requireManageStructure();
        if (request.programId() == null || request.academicYearId() == null) {
            throw BusinessException.badRequest("Program and academic year are required");
        }
        Program program = academicScopeService.requireProgram(scope.institutionId(), request.programId());
        AcademicYear year = academicScopeService.requireAcademicYear(scope.institutionId(), request.academicYearId());
        String label = requireText(request.label(), "Batch label", 40);
        if (batchRepository.existsByProgramIdAndLabelIgnoreCase(program.getId(), label)) {
            throw BusinessException.conflict("This batch label already exists for the program");
        }
        Batch batch = Batch.builder()
                .program(program)
                .academicYear(year)
                .label(label)
                .graduationYear(validYear(request.graduationYear()))
                .status(request.status() == null ? InstitutionStatus.ACTIVE : request.status())
                .build();
        batch = batchRepository.save(batch);
        auditService.success("BATCH_CREATE", "BATCH", String.valueOf(batch.getId()),
                scope.institutionId(), scope, "label=" + label);
        return toResponse(batch);
    }

    @Transactional
    public AcademicDtos.BatchResponse updateBatch(CollegeScope scope, Long id,
                                                  AcademicDtos.BatchRequest request) {
        scope.requireManageStructure();
        Batch batch = academicScopeService.requireBatch(scope.institutionId(), id);
        Program program = academicScopeService.requireProgram(scope.institutionId(), request.programId());
        AcademicYear year = academicScopeService.requireAcademicYear(scope.institutionId(), request.academicYearId());
        String label = requireText(request.label(), "Batch label", 40);
        batchRepository.findByProgramIdAndLabelIgnoreCase(program.getId(), label)
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw BusinessException.conflict("This batch label already exists for the program");
                });
        batch.setProgram(program);
        batch.setAcademicYear(year);
        batch.setLabel(label);
        batch.setGraduationYear(validYear(request.graduationYear()));
        if (request.status() != null) {
            batch.setStatus(request.status());
        }
        batch = batchRepository.save(batch);
        auditService.success("BATCH_UPDATE", "BATCH", String.valueOf(id),
                scope.institutionId(), scope, "label=" + label);
        return toResponse(batch);
    }

    @Transactional
    public AcademicDtos.SectionResponse createSection(CollegeScope scope, AcademicDtos.SectionRequest request) {
        scope.requireManageStructure();
        if (request.batchId() == null) {
            throw BusinessException.badRequest("Batch is required");
        }
        Batch batch = academicScopeService.requireBatch(scope.institutionId(), request.batchId());
        String name = requireText(request.name(), "Section name", 40);
        if (sectionRepository.existsByBatchIdAndNameIgnoreCase(batch.getId(), name)) {
            throw BusinessException.conflict("This section already exists for the batch");
        }
        Section section = Section.builder()
                .batch(batch)
                .name(name)
                .status(request.status() == null ? InstitutionStatus.ACTIVE : request.status())
                .build();
        section = sectionRepository.save(section);
        auditService.success("SECTION_CREATE", "SECTION", String.valueOf(section.getId()),
                scope.institutionId(), scope, "name=" + name);
        return toResponse(section);
    }

    @Transactional
    public AcademicDtos.SectionResponse updateSection(CollegeScope scope, Long id,
                                                      AcademicDtos.SectionRequest request) {
        scope.requireManageStructure();
        Section section = academicScopeService.requireSection(scope.institutionId(), id);
        Batch batch = academicScopeService.requireBatch(scope.institutionId(), request.batchId());
        String name = requireText(request.name(), "Section name", 40);
        sectionRepository.findByBatchIdAndNameIgnoreCase(batch.getId(), name)
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw BusinessException.conflict("This section already exists for the batch");
                });
        section.setBatch(batch);
        section.setName(name);
        if (request.status() != null) {
            section.setStatus(request.status());
        }
        section = sectionRepository.save(section);
        auditService.success("SECTION_UPDATE", "SECTION", String.valueOf(id),
                scope.institutionId(), scope, "name=" + name);
        return toResponse(section);
    }

    // ---- validation / mapping ----

    private static String requireCode(String raw, String label) {
        String value = raw == null ? "" : raw.trim();
        if (!CODE.matcher(value).matches()) {
            throw BusinessException.badRequest(label + " must be 2–40 characters using letters, digits, dot, underscore or hyphen");
        }
        return value;
    }

    private static String requireText(String raw, String label, int max) {
        String value = raw == null ? "" : raw.trim();
        if (value.isEmpty()) {
            throw BusinessException.badRequest(label + " is required");
        }
        if (value.length() > max) {
            throw BusinessException.badRequest(label + " must be at most " + max + " characters");
        }
        return value;
    }

    private static String trimToNull(String raw, int max) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String value = raw.trim();
        if (value.length() > max) {
            throw BusinessException.badRequest("Value must be at most " + max + " characters");
        }
        return value;
    }

    private static String normalizeEmail(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String value = raw.trim().toLowerCase(Locale.ROOT);
        if (value.length() > 190 || !value.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw BusinessException.badRequest("Contact email is not valid");
        }
        return value;
    }

    private static Integer validDuration(Integer years) {
        if (years == null) {
            return null;
        }
        if (years < 1 || years > 10) {
            throw BusinessException.badRequest("Duration must be between 1 and 10 years");
        }
        return years;
    }

    private static Integer validYear(Integer year) {
        if (year == null) {
            return null;
        }
        int current = LocalDate.now().getYear();
        if (year < 1900 || year > current + 20) {
            throw BusinessException.badRequest("Graduation year is not plausible");
        }
        return year;
    }

    private static void validateDates(LocalDate start, LocalDate end) {
        if (start != null && end != null && !end.isAfter(start)) {
            throw BusinessException.badRequest("Academic year end date must be after its start date");
        }
    }

    public static AcademicDtos.InstitutionResponse toResponse(Institution institution) {
        return new AcademicDtos.InstitutionResponse(
                institution.getId(), institution.getCode(), institution.getName(),
                institution.getStatus(), institution.getTimezone(), institution.getContactEmail(),
                institution.getCreatedAt(), institution.getUpdatedAt());
    }

    public static AcademicDtos.DepartmentResponse toResponse(Department department) {
        return new AcademicDtos.DepartmentResponse(
                department.getId(), department.getInstitution().getId(), department.getCode(),
                department.getName(), department.getStatus(), department.getCreatedAt());
    }

    public static AcademicDtos.ProgramResponse toResponse(Program program) {
        return new AcademicDtos.ProgramResponse(
                program.getId(), program.getInstitution().getId(), program.getDepartment().getId(),
                program.getDepartment().getName(), program.getCode(), program.getName(),
                program.getDegreeType(), program.getDurationYears(), program.getStatus(),
                program.getCreatedAt());
    }

    public static AcademicDtos.AcademicYearResponse toResponse(AcademicYear year) {
        return new AcademicDtos.AcademicYearResponse(
                year.getId(), year.getInstitution().getId(), year.getLabel(),
                year.getStartDate(), year.getEndDate(), year.isActive(), year.getCreatedAt());
    }

    public static AcademicDtos.BatchResponse toResponse(Batch batch) {
        return new AcademicDtos.BatchResponse(
                batch.getId(), batch.getProgram().getInstitution().getId(),
                batch.getProgram().getId(), batch.getProgram().getName(),
                batch.getProgram().getDepartment().getId(), batch.getProgram().getDepartment().getName(),
                batch.getAcademicYear().getId(), batch.getAcademicYear().getLabel(),
                batch.getLabel(), batch.getGraduationYear(), batch.getStatus(), batch.getCreatedAt());
    }

    public static AcademicDtos.SectionResponse toResponse(Section section) {
        return new AcademicDtos.SectionResponse(
                section.getId(), section.getBatch().getId(), section.getBatch().getLabel(),
                section.getBatch().getProgram().getId(), section.getBatch().getProgram().getName(),
                section.getName(), section.getStatus(), section.getCreatedAt());
    }
}
