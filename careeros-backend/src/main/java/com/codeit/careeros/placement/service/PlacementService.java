package com.codeit.careeros.placement.service;

import com.codeit.careeros.college.entity.StudentEnrollment;
import com.codeit.careeros.college.enums.InstitutionStatus;
import com.codeit.careeros.college.repository.InstitutionRepository;
import com.codeit.careeros.college.repository.StudentEnrollmentRepository;
import com.codeit.careeros.college.service.AcademicScopeService;
import com.codeit.careeros.college.service.AuditService;
import com.codeit.careeros.college.service.CollegeScope;
import com.codeit.careeros.college.service.StudentService;
import com.codeit.careeros.common.enums.Role;
import com.codeit.careeros.dto.insight.ReadinessResponse;
import com.codeit.careeros.entity.StudentProfile;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.exception.BusinessException;
import com.codeit.careeros.placement.dto.PlacementDtos;
import com.codeit.careeros.placement.entity.ApplicationStageEvent;
import com.codeit.careeros.placement.entity.Company;
import com.codeit.careeros.placement.entity.JobOpening;
import com.codeit.careeros.placement.entity.PlacementApplication;
import com.codeit.careeros.placement.entity.PlacementDrive;
import com.codeit.careeros.placement.entity.PlacementOffer;
import com.codeit.careeros.placement.enums.ApplicationStage;
import com.codeit.careeros.placement.enums.CompanyStatus;
import com.codeit.careeros.placement.enums.DriveStatus;
import com.codeit.careeros.placement.enums.JobStatus;
import com.codeit.careeros.placement.enums.OfferStatus;
import com.codeit.careeros.placement.repository.ApplicationStageEventRepository;
import com.codeit.careeros.placement.repository.CompanyRepository;
import com.codeit.careeros.placement.repository.JobOpeningRepository;
import com.codeit.careeros.placement.repository.PlacementApplicationRepository;
import com.codeit.careeros.placement.repository.PlacementDriveRepository;
import com.codeit.careeros.placement.repository.PlacementOfferRepository;
import com.codeit.careeros.repository.StudentProfileRepository;
import com.codeit.careeros.repository.UserRepository;
import com.codeit.careeros.security.SecurityUtils;
import com.codeit.careeros.service.CareerInsightService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Institution-scoped company, job, placement-drive and application service.
 * Every lookup starts with the institution derived from the caller's active
 * membership; ids from another college resolve to 404. Student self-service
 * paths resolve the student from the authenticated principal, never from a
 * client-supplied profile id.
 */
@Service
@RequiredArgsConstructor
public class PlacementService {

    private final CompanyRepository companyRepository;
    private final JobOpeningRepository jobRepository;
    private final PlacementDriveRepository driveRepository;
    private final PlacementApplicationRepository applicationRepository;
    private final ApplicationStageEventRepository stageEventRepository;
    private final PlacementOfferRepository offerRepository;
    private final InstitutionRepository institutionRepository;
    private final StudentEnrollmentRepository enrollmentRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final StudentService studentService;
    private final AcademicScopeService academicScopeService;
    private final CareerInsightService careerInsightService;
    private final UserRepository userRepository;
    private final AuditService auditService;

    // ---- companies ----

    @Transactional(readOnly = true)
    public List<PlacementDtos.CompanyResponse> listCompanies(CollegeScope scope) {
        scope.requirePlacementAccess();
        return companyRepository.findByInstitutionIdOrderByNameAsc(scope.institutionId()).stream()
                .map(company -> toCompany(company, scope))
                .toList();
    }

    @Transactional
    public PlacementDtos.CompanyResponse createCompany(CollegeScope scope,
                                                       PlacementDtos.CompanyRequest request) {
        scope.requireManageCompaniesAndJobs();
        if (request == null || request.name() == null || request.name().isBlank()) {
            throw BusinessException.badRequest("A company name is required");
        }
        if (companyRepository.existsByInstitutionIdAndNameIgnoreCase(scope.institutionId(), request.name().trim())) {
            throw BusinessException.conflict("A company with this name already exists");
        }
        Company company = companyRepository.save(Company.builder()
                .institution(companyInstitution(scope))
                .name(request.name().trim())
                .industry(trim(request.industry(), 120))
                .sector(trim(request.sector(), 120))
                .website(trim(request.website(), 250))
                .contactName(trim(request.contactName(), 120))
                .contactEmail(trim(request.contactEmail(), 190))
                .contactPhone(trim(request.contactPhone(), 30))
                .recruitmentStatus(request.recruitmentStatus() == null ? CompanyStatus.PROSPECT : request.recruitmentStatus())
                .source(trim(request.source(), 120))
                .notes(trim(request.notes(), 1000))
                .createdBy(currentUser(scope))
                .build());
        auditService.success("PLACEMENT_COMPANY_CREATE", "PLACEMENT_COMPANY",
                String.valueOf(company.getId()), scope.institutionId(), scope, "name=" + company.getName());
        return toCompany(company, scope);
    }

    @Transactional
    public PlacementDtos.CompanyResponse updateCompany(CollegeScope scope, Long companyId,
                                                       PlacementDtos.CompanyRequest request) {
        scope.requireManageCompaniesAndJobs();
        Company company = requireCompany(scope, companyId);
        if (request == null || request.name() == null || request.name().isBlank()) {
            throw BusinessException.badRequest("A company name is required");
        }
        if (!request.name().trim().equalsIgnoreCase(company.getName())
                && companyRepository.existsByInstitutionIdAndNameIgnoreCase(scope.institutionId(), request.name().trim())) {
            throw BusinessException.conflict("A company with this name already exists");
        }
        // PUT replaces the editable company record. Null optional fields clear
        // the previous value, while a missing status keeps the current state.
        company.setName(request.name().trim());
        company.setIndustry(trim(request.industry(), 120));
        company.setSector(trim(request.sector(), 120));
        company.setWebsite(trim(request.website(), 250));
        company.setContactName(trim(request.contactName(), 120));
        company.setContactEmail(trim(request.contactEmail(), 190));
        company.setContactPhone(trim(request.contactPhone(), 30));
        if (request.recruitmentStatus() != null) company.setRecruitmentStatus(request.recruitmentStatus());
        company.setSource(trim(request.source(), 120));
        company.setNotes(trim(request.notes(), 1000));
        company = companyRepository.save(company);
        auditService.success("PLACEMENT_COMPANY_UPDATE", "PLACEMENT_COMPANY",
                String.valueOf(company.getId()), scope.institutionId(), scope, "status=" + company.getRecruitmentStatus());
        return toCompany(company, scope);
    }

    // ---- jobs ----

    @Transactional(readOnly = true)
    public List<PlacementDtos.JobResponse> listJobs(CollegeScope scope, Long companyId, JobStatus status) {
        scope.requirePlacementAccess();
        List<JobOpening> jobs = status == null
                ? jobRepository.findByInstitutionIdOrderByCreatedAtDesc(scope.institutionId())
                : jobRepository.findByInstitutionIdAndStatusOrderByCreatedAtDesc(scope.institutionId(), status);
        if (companyId != null) {
            Company company = requireCompany(scope, companyId);
            jobs = jobs.stream().filter(job -> job.getCompany().getId().equals(company.getId())).toList();
        }
        return jobs.stream().map(this::toJob).toList();
    }

    @Transactional
    public PlacementDtos.JobResponse createJob(CollegeScope scope, PlacementDtos.JobRequest request) {
        scope.requireManageCompaniesAndJobs();
        if (request == null || request.companyId() == null) {
            throw BusinessException.badRequest("A company is required");
        }
        if (request.title() == null || request.title().isBlank()) {
            throw BusinessException.badRequest("A job title is required");
        }
        validateSalary(request.salaryMin(), request.salaryMax());
        Company company = requireCompany(scope, request.companyId());
        JobOpening job = jobRepository.save(JobOpening.builder()
                .institution(companyInstitution(scope))
                .company(company)
                .title(request.title().trim())
                .description(trim(request.description(), 4000))
                .requiredSkills(trim(request.requiredSkills(), 1000))
                .location(trim(request.location(), 160))
                .employmentType(request.employmentType())
                .eligibilityCriteria(trim(request.eligibilityCriteria(), 2000))
                .salaryMin(request.salaryMin())
                .salaryMax(request.salaryMax())
                .currency(trim(request.currency(), 10))
                .applicationDeadline(request.applicationDeadline())
                .status(request.status() == null ? JobStatus.DRAFT : request.status())
                .createdBy(currentUser(scope))
                .build());
        auditService.success("PLACEMENT_JOB_CREATE", "PLACEMENT_JOB",
                String.valueOf(job.getId()), scope.institutionId(), scope, "companyId=" + company.getId());
        return toJob(job);
    }

    @Transactional
    public PlacementDtos.JobResponse updateJob(CollegeScope scope, Long jobId,
                                               PlacementDtos.JobRequest request) {
        scope.requireManageCompaniesAndJobs();
        JobOpening job = requireJob(scope, jobId);
        if (request == null || request.companyId() == null) {
            throw BusinessException.badRequest("A company is required");
        }
        if (request.title() == null || request.title().isBlank()) {
            throw BusinessException.badRequest("A job title cannot be blank");
        }
        validateSalary(request.salaryMin(), request.salaryMax());
        // PUT replaces the editable job record. Null optional fields clear the
        // previous value, while a missing status keeps the current state.
        job.setCompany(requireCompany(scope, request.companyId()));
        job.setTitle(request.title().trim());
        job.setDescription(trim(request.description(), 4000));
        job.setRequiredSkills(trim(request.requiredSkills(), 1000));
        job.setLocation(trim(request.location(), 160));
        job.setEmploymentType(request.employmentType());
        job.setEligibilityCriteria(trim(request.eligibilityCriteria(), 2000));
        job.setSalaryMin(request.salaryMin());
        job.setSalaryMax(request.salaryMax());
        job.setCurrency(trim(request.currency(), 10));
        job.setApplicationDeadline(request.applicationDeadline());
        if (request.status() != null) job.setStatus(request.status());
        job = jobRepository.save(job);
        auditService.success("PLACEMENT_JOB_UPDATE", "PLACEMENT_JOB",
                String.valueOf(job.getId()), scope.institutionId(), scope, "status=" + job.getStatus());
        return toJob(job);
    }

    // ---- drives ----

    @Transactional(readOnly = true)
    public List<PlacementDtos.DriveResponse> listDrives(CollegeScope scope, DriveStatus status) {
        scope.requirePlacementAccess();
        List<PlacementDrive> drives = status == null
                ? driveRepository.findByInstitutionIdOrderByCreatedAtDesc(scope.institutionId())
                : driveRepository.findByInstitutionIdAndStatusOrderByCreatedAtDesc(scope.institutionId(), status);
        return drives.stream()
                .filter(drive -> driveVisibleInScope(scope, drive))
                .map(this::toDrive)
                .toList();
    }

    @Transactional(readOnly = true)
    public PlacementDtos.DriveDetailResponse driveDetail(CollegeScope scope, Long driveId) {
        scope.requirePlacementAccess();
        PlacementDrive drive = requireDrive(scope, driveId);
        if (!driveVisibleInScope(scope, drive)) {
            throw BusinessException.notFound("Placement drive not found");
        }
        return new PlacementDtos.DriveDetailResponse(
                toDrive(drive),
                eligibleStudents(scope, drive),
                applicationsForDrive(scope, drive));
    }

    @Transactional
    public PlacementDtos.DriveResponse createDrive(CollegeScope scope, PlacementDtos.DriveRequest request) {
        scope.requireManageDrives();
        if (request == null || request.companyId() == null || request.jobId() == null) {
            throw BusinessException.badRequest("A company and job are required");
        }
        if (request.name() == null || request.name().isBlank()) {
            throw BusinessException.badRequest("A drive name is required");
        }
        Company company = requireCompany(scope, request.companyId());
        JobOpening job = requireJob(scope, request.jobId());
        if (!job.getCompany().getId().equals(company.getId())) {
            throw BusinessException.badRequest("The selected job does not belong to the selected company");
        }
        validateDriveDates(request);
        var eligibleDepartment = resolveDepartment(scope, request.eligibleDepartmentId());
        var eligibleProgram = resolveProgram(scope, request.eligibleProgramId());
        var eligibleBatch = resolveBatch(scope, request.eligibleBatchId());
        validateEligibilityTargets(eligibleDepartment, eligibleProgram, eligibleBatch);
        PlacementDrive drive = driveRepository.save(PlacementDrive.builder()
                .institution(companyInstitution(scope))
                .company(company)
                .job(job)
                .name(request.name().trim())
                .registrationStart(request.registrationStart())
                .registrationEnd(request.registrationEnd())
                .driveDate(request.driveDate())
                .eligibilityCriteria(trim(request.eligibilityCriteria(), 2000))
                .eligibleDepartment(eligibleDepartment)
                .eligibleProgram(eligibleProgram)
                .eligibleBatch(eligibleBatch)
                .eligibleGraduationYear(validateGraduationYear(request.eligibleGraduationYear()))
                .minimumReadinessPercent(validateReadiness(request.minimumReadinessPercent()))
                .status(request.status() == null ? DriveStatus.DRAFT : request.status())
                .createdBy(currentUser(scope))
                .build());
        auditService.success("PLACEMENT_DRIVE_CREATE", "PLACEMENT_DRIVE",
                String.valueOf(drive.getId()), scope.institutionId(), scope, "companyId=" + company.getId());
        return toDrive(drive);
    }

    @Transactional
    public PlacementDtos.DriveResponse updateDrive(CollegeScope scope, Long driveId,
                                                   PlacementDtos.DriveRequest request) {
        scope.requireManageDrives();
        PlacementDrive drive = requireDrive(scope, driveId);
        if (request == null || request.companyId() == null || request.jobId() == null) {
            throw BusinessException.badRequest("A company and job are required");
        }
        if (request.name() == null || request.name().isBlank()) {
            throw BusinessException.badRequest("A drive name cannot be blank");
        }
        Company company = requireCompany(scope, request.companyId());
        JobOpening job = requireJob(scope, request.jobId());
        if (!job.getCompany().getId().equals(company.getId())) {
            throw BusinessException.badRequest("The selected job does not belong to the selected company");
        }
        validateDriveDates(request);
        var eligibleDepartment = resolveDepartment(scope, request.eligibleDepartmentId());
        var eligibleProgram = resolveProgram(scope, request.eligibleProgramId());
        var eligibleBatch = resolveBatch(scope, request.eligibleBatchId());
        validateEligibilityTargets(eligibleDepartment, eligibleProgram, eligibleBatch);

        // PUT replaces the editable drive definition. Null optional fields
        // clear the previous value (for example "any batch") instead of being
        // silently retained from an earlier version.
        drive.setCompany(company);
        drive.setJob(job);
        drive.setName(request.name().trim());
        drive.setRegistrationStart(request.registrationStart());
        drive.setRegistrationEnd(request.registrationEnd());
        drive.setDriveDate(request.driveDate());
        drive.setEligibilityCriteria(trim(request.eligibilityCriteria(), 2000));
        drive.setEligibleDepartment(eligibleDepartment);
        drive.setEligibleProgram(eligibleProgram);
        drive.setEligibleBatch(eligibleBatch);
        drive.setEligibleGraduationYear(validateGraduationYear(request.eligibleGraduationYear()));
        drive.setMinimumReadinessPercent(validateReadiness(request.minimumReadinessPercent()));
        if (request.status() != null) {
            drive.setStatus(request.status());
        }
        drive = driveRepository.save(drive);
        auditService.success("PLACEMENT_DRIVE_UPDATE", "PLACEMENT_DRIVE",
                String.valueOf(drive.getId()), scope.institutionId(), scope, "status=" + drive.getStatus());
        return toDrive(drive);
    }

    @Transactional(readOnly = true)
    public List<PlacementDtos.EligibleStudentResponse> eligibleStudents(CollegeScope scope, Long driveId) {
        scope.requirePlacementAccess();
        PlacementDrive drive = requireDrive(scope, driveId);
        if (!driveVisibleInScope(scope, drive)) {
            throw BusinessException.notFound("Placement drive not found");
        }
        return eligibleStudents(scope, drive);
    }

    // ---- applications and offers ----

    @Transactional
    public PlacementDtos.ApplicationResponse createApplication(CollegeScope scope, Long driveId,
                                                               PlacementDtos.ApplicationCreateRequest request) {
        scope.requireManageApplications();
        PlacementDrive drive = requireDrive(scope, driveId);
        if (!driveVisibleInScope(scope, drive)) {
            throw BusinessException.notFound("Placement drive not found");
        }
        if (request == null || request.enrollmentId() == null) {
            throw BusinessException.badRequest("A student enrollment is required");
        }
        StudentEnrollment enrollment = studentService.requireEnrollment(scope, request.enrollmentId());
        if (applicationRepository.findByDriveIdAndStudentProfileId(drive.getId(),
                enrollment.getStudentProfile().getId()).isPresent()) {
            throw BusinessException.conflict("The student is already registered for this drive");
        }
        Eligibility eligibility = eligibility(scope, drive, enrollment);
        boolean override = Boolean.TRUE.equals(request.override());
        if (!eligibility.eligible() && !override) {
            throw BusinessException.badRequest("The student is not eligible for this drive: " + eligibility.reason());
        }
        String reason = trim(request.overrideReason(), 500);
        if (!eligibility.eligible() && (reason == null || reason.isBlank())) {
            throw BusinessException.badRequest("An eligibility override reason is required");
        }
        PlacementApplication application = applicationRepository.save(PlacementApplication.builder()
                .institution(companyInstitution(scope))
                .drive(drive)
                .studentProfile(enrollment.getStudentProfile())
                .stage(ApplicationStage.REGISTERED)
                .eligibilityOverride(!eligibility.eligible())
                .overrideReason(!eligibility.eligible() ? reason : null)
                .overrideBy(!eligibility.eligible() ? currentUser(scope) : null)
                .appliedAt(Instant.now())
                .build());
        recordStage(application, ApplicationStage.REGISTERED,
                !eligibility.eligible() ? "Registered with eligibility override: " + reason : "Registered", scope);
        auditService.success("PLACEMENT_APPLICATION_CREATE", "PLACEMENT_APPLICATION",
                String.valueOf(application.getId()), scope.institutionId(), scope,
                "driveId=" + drive.getId() + ",override=" + !eligibility.eligible());
        return toApplication(application);
    }

    @Transactional
    public PlacementDtos.ApplicationResponse updateApplication(CollegeScope scope, Long applicationId,
                                                               PlacementDtos.ApplicationStageUpdateRequest request) {
        scope.requireManageApplications();
        PlacementApplication application = requireApplication(scope, applicationId);
        if (request == null || request.stage() == null) {
            throw BusinessException.badRequest("An application stage is required");
        }
        application.setStage(request.stage());
        application = applicationRepository.save(application);
        recordStage(application, request.stage(), trim(request.note(), 500), scope);
        auditService.success("PLACEMENT_APPLICATION_STAGE_UPDATE", "PLACEMENT_APPLICATION",
                String.valueOf(application.getId()), scope.institutionId(), scope,
                "stage=" + request.stage());
        return toApplication(application);
    }

    @Transactional
    public PlacementDtos.OfferResponse createOffer(CollegeScope scope, Long applicationId,
                                                    PlacementDtos.OfferRequest request) {
        scope.requireManageApplications();
        PlacementApplication application = requireApplication(scope, applicationId);
        if (offerRepository.findByApplicationId(applicationId).isPresent()) {
            throw BusinessException.conflict("This application already has an offer");
        }
        if (request == null) {
            throw BusinessException.badRequest("Offer details are required");
        }
        if (request.packageAmount() != null && request.packageAmount().signum() < 0) {
            throw BusinessException.badRequest("Package amount cannot be negative");
        }
        OfferStatus status = request.status() == null ? OfferStatus.PENDING : request.status();
        LocalDate joinedAt = request.joinedAt();
        if (status == OfferStatus.JOINED && joinedAt == null) {
            joinedAt = LocalDate.now(scope.institutionZone());
        }
        PlacementOffer offer = offerRepository.save(PlacementOffer.builder()
                .institution(companyInstitution(scope))
                .application(application)
                .packageAmount(request.packageAmount())
                .currency(trim(request.currency(), 10))
                .offerDate(request.offerDate() == null ? LocalDate.now(scope.institutionZone()) : request.offerDate())
                .status(status)
                .joinedAt(status == OfferStatus.JOINED ? joinedAt : null)
                .notes(trim(request.notes(), 500))
                .createdBy(currentUser(scope))
                .build());
        if (status == OfferStatus.JOINED) {
            application.setStage(ApplicationStage.JOINED);
            applicationRepository.save(application);
            recordStage(application, ApplicationStage.JOINED, "Offer recorded with joining", scope);
        } else if (application.getStage() != ApplicationStage.OFFERED
                && application.getStage() != ApplicationStage.JOINED) {
            application.setStage(ApplicationStage.OFFERED);
            applicationRepository.save(application);
            recordStage(application, ApplicationStage.OFFERED, "Offer recorded", scope);
        }
        auditService.success("PLACEMENT_OFFER_CREATE", "PLACEMENT_OFFER",
                String.valueOf(offer.getId()), scope.institutionId(), scope,
                "applicationId=" + application.getId());
        return toOffer(offer);
    }

    @Transactional
    public PlacementDtos.OfferResponse updateOffer(CollegeScope scope, Long offerId,
                                                   PlacementDtos.OfferUpdateRequest request) {
        scope.requireManageApplications();
        PlacementOffer offer = requireOffer(scope, offerId);
        if (request == null || request.status() == null) {
            throw BusinessException.badRequest("An offer status is required");
        }
        if (request.packageAmount() != null && request.packageAmount().signum() < 0) {
            throw BusinessException.badRequest("Package amount cannot be negative");
        }
        OfferStatus status = request.status();
        offer.setStatus(status);
        if (request.packageAmount() != null) offer.setPackageAmount(request.packageAmount());
        if (request.currency() != null) offer.setCurrency(trim(request.currency(), 10));
        if (request.offerDate() != null) offer.setOfferDate(request.offerDate());
        if (status == OfferStatus.JOINED) {
            offer.setJoinedAt(request.joinedAt() == null
                    ? (offer.getJoinedAt() == null ? LocalDate.now(scope.institutionZone()) : offer.getJoinedAt())
                    : request.joinedAt());
        } else {
            // A non-joined status must not retain a stale joining date, or the
            // analytics joining metric would keep counting the student.
            offer.setJoinedAt(null);
        }
        if (request.notes() != null) offer.setNotes(trim(request.notes(), 500));
        offer = offerRepository.save(offer);

        PlacementApplication application = offer.getApplication();
        if (status == OfferStatus.JOINED) {
            if (application.getStage() != ApplicationStage.JOINED) {
                application.setStage(ApplicationStage.JOINED);
                applicationRepository.save(application);
                recordStage(application, ApplicationStage.JOINED, "Joining recorded", scope);
            }
        } else if (application.getStage() == ApplicationStage.JOINED) {
            ApplicationStage next = status == OfferStatus.WITHDRAWN
                    ? ApplicationStage.WITHDRAWN : ApplicationStage.OFFERED;
            application.setStage(next);
            applicationRepository.save(application);
            recordStage(application, next, "Joining removed after offer status change", scope);
        }
        auditService.success("PLACEMENT_OFFER_UPDATE", "PLACEMENT_OFFER",
                String.valueOf(offer.getId()), scope.institutionId(), scope,
                "status=" + status);
        return toOffer(offer);
    }

    // ---- student self-service ----

    @Transactional(readOnly = true)
    public PlacementDtos.StudentDriveListResponse myDrives() {
        StudentEnrollment enrollment = currentEnrollment();
        if (enrollment == null) {
            return new PlacementDtos.StudentDriveListResponse(List.of(), 0);
        }
        List<PlacementDtos.StudentDriveResponse> items = driveRepository
                .findByInstitutionIdAndStatusInOrderByCreatedAtDesc(enrollment.getInstitution().getId(),
                        List.of(DriveStatus.REGISTRATION_OPEN, DriveStatus.REGISTRATION_CLOSED,
                                DriveStatus.ONGOING))
                .stream()
                .filter(drive -> driveVisibleToStudent(drive))
                .map(drive -> {
                    Eligibility eligibility = eligibility(null, drive, enrollment);
                    var existing = applicationRepository.findByDriveIdAndStudentProfileId(
                            drive.getId(), enrollment.getStudentProfile().getId());
                    return new PlacementDtos.StudentDriveResponse(
                            toDrive(drive),
                            eligibility.eligible(),
                            eligibility.reason(),
                            existing.isPresent(),
                            existing.map(PlacementApplication::getId).orElse(null));
                })
                .toList();
        return new PlacementDtos.StudentDriveListResponse(items, items.size());
    }

    @Transactional(readOnly = true)
    public PlacementDtos.StudentApplicationListResponse myApplications() {
        StudentEnrollment enrollment = currentEnrollment();
        if (enrollment == null) {
            return new PlacementDtos.StudentApplicationListResponse(List.of(), 0);
        }
        List<PlacementDtos.ApplicationResponse> items = applicationRepository
                .findByStudentProfileIdOrderByAppliedAtDesc(enrollment.getStudentProfile().getId()).stream()
                .map(this::toApplication)
                .toList();
        return new PlacementDtos.StudentApplicationListResponse(items, items.size());
    }

    @Transactional
    public PlacementDtos.ApplicationResponse registerForDrive(Long driveId) {
        StudentEnrollment enrollment = requireCurrentEnrollment();
        PlacementDrive drive = driveRepository.findByIdAndInstitutionId(driveId, enrollment.getInstitution().getId())
                .orElseThrow(() -> BusinessException.notFound("Placement drive not found"));
        if (drive.getStatus() != DriveStatus.REGISTRATION_OPEN) {
            throw BusinessException.badRequest("Registration is not open for this drive");
        }
        if (drive.getRegistrationEnd() != null && drive.getRegistrationEnd().isBefore(LocalDate.now())) {
            throw BusinessException.badRequest("The registration deadline has passed");
        }
        if (applicationRepository.findByDriveIdAndStudentProfileId(drive.getId(),
                enrollment.getStudentProfile().getId()).isPresent()) {
            throw BusinessException.conflict("You are already registered for this drive");
        }
        Eligibility eligibility = eligibility(null, drive, enrollment);
        if (!eligibility.eligible()) {
            throw BusinessException.badRequest("You are not eligible for this drive: " + eligibility.reason());
        }
        PlacementApplication application = applicationRepository.save(PlacementApplication.builder()
                .institution(enrollment.getInstitution())
                .drive(drive)
                .studentProfile(enrollment.getStudentProfile())
                .stage(ApplicationStage.REGISTERED)
                .appliedAt(Instant.now())
                .build());
        recordStage(application, ApplicationStage.REGISTERED, "Student registered", null);
        auditService.success("STUDENT_PLACEMENT_REGISTER", "PLACEMENT_APPLICATION",
                String.valueOf(application.getId()), enrollment.getInstitution().getId(), null,
                "driveId=" + drive.getId());
        return toApplication(application);
    }

    @Transactional
    public PlacementDtos.ApplicationResponse withdrawMyApplication(Long applicationId) {
        StudentEnrollment enrollment = requireCurrentEnrollment();
        PlacementApplication application = applicationRepository.findByIdAndInstitutionId(
                        applicationId, enrollment.getInstitution().getId())
                .orElseThrow(() -> BusinessException.notFound("Application not found"));
        if (!application.getStudentProfile().getId().equals(enrollment.getStudentProfile().getId())) {
            throw BusinessException.notFound("Application not found");
        }
        if (application.getStage() == ApplicationStage.JOINED) {
            throw BusinessException.badRequest("A joined application cannot be withdrawn");
        }
        PlacementOffer offer = offerRepository.findByApplicationId(applicationId).orElse(null);
        if (offer != null && offer.getStatus() == OfferStatus.JOINED) {
            throw BusinessException.badRequest("A joined offer cannot be withdrawn");
        }
        application.setStage(ApplicationStage.WITHDRAWN);
        application = applicationRepository.save(application);
        if (offer != null && offer.getStatus() != OfferStatus.WITHDRAWN) {
            offer.setStatus(OfferStatus.WITHDRAWN);
            offer.setJoinedAt(null);
            offerRepository.save(offer);
        }
        recordStage(application, ApplicationStage.WITHDRAWN, "Withdrawn by student", null);
        auditService.success("STUDENT_PLACEMENT_WITHDRAW", "PLACEMENT_APPLICATION",
                String.valueOf(application.getId()), enrollment.getInstitution().getId(), null,
                offer == null ? null : "offerWithdrawn=true");
        return toApplication(application);
    }

    @Transactional
    public PlacementDtos.OfferResponse respondToOffer(Long offerId, OfferStatus status) {
        if (status != OfferStatus.ACCEPTED && status != OfferStatus.DECLINED) {
            throw BusinessException.badRequest("Students may only accept or decline an offer");
        }
        StudentEnrollment enrollment = requireCurrentEnrollment();
        PlacementOffer offer = offerRepository.findByIdAndInstitutionId(offerId, enrollment.getInstitution().getId())
                .orElseThrow(() -> BusinessException.notFound("Offer not found"));
        if (!offer.getApplication().getStudentProfile().getId().equals(enrollment.getStudentProfile().getId())) {
            throw BusinessException.notFound("Offer not found");
        }
        if (offer.getStatus() == OfferStatus.JOINED || offer.getStatus() == OfferStatus.WITHDRAWN) {
            throw BusinessException.badRequest("This offer can no longer be changed by the student");
        }
        offer.setStatus(status);
        offer = offerRepository.save(offer);
        auditService.success("STUDENT_OFFER_RESPONSE", "PLACEMENT_OFFER",
                String.valueOf(offer.getId()), enrollment.getInstitution().getId(), null,
                "status=" + status);
        return toOffer(offer);
    }

    // ---- helpers ----

    private List<PlacementDtos.EligibleStudentResponse> eligibleStudents(CollegeScope scope, PlacementDrive drive) {
        return studentService.allInScope(scope, null).stream()
                .filter(enrollment -> enrollment.getStatus() == com.codeit.careeros.college.enums.EnrollmentStatus.ACTIVE)
                .sorted(Comparator.comparing(enrollment -> enrollment.getStudentProfile().getFullName(),
                        String.CASE_INSENSITIVE_ORDER))
                .map(enrollment -> {
                    Eligibility eligibility = eligibility(scope, drive, enrollment);
                    var existing = applicationRepository.findByDriveIdAndStudentProfileId(
                            drive.getId(), enrollment.getStudentProfile().getId());
                    Integer readiness = readinessPercent(enrollment);
                    return new PlacementDtos.EligibleStudentResponse(
                            enrollment.getId(),
                            enrollment.getStudentProfile().getId(),
                            enrollment.getStudentProfile().getStudentId(),
                            enrollment.getRollNumber(),
                            enrollment.getStudentProfile().getFullName(),
                            enrollment.getDepartment().getName(),
                            enrollment.getProgram().getName(),
                            enrollment.getBatch().getLabel(),
                            enrollment.getBatch().getGraduationYear(),
                            readiness,
                            eligibility.eligible(),
                            eligibility.reason(),
                            existing.isPresent(),
                            existing.map(PlacementApplication::getId).orElse(null));
                })
                .toList();
    }

    private List<PlacementDtos.ApplicationResponse> applicationsForDrive(CollegeScope scope, PlacementDrive drive) {
        return applicationRepository.findByDriveIdOrderByAppliedAtAsc(drive.getId()).stream()
                .filter(application -> {
                    StudentEnrollment enrollment = enrollmentFor(application);
                    if (enrollment == null) return false;
                    try {
                        studentService.requireEnrollment(scope, enrollment.getId());
                        return true;
                    } catch (BusinessException ex) {
                        return false;
                    }
                })
                .map(this::toApplication)
                .toList();
    }

    private Eligibility eligibility(CollegeScope scope, PlacementDrive drive, StudentEnrollment enrollment) {
        if (enrollment.getStatus() != com.codeit.careeros.college.enums.EnrollmentStatus.ACTIVE) {
            return new Eligibility(false, "Enrollment is not active");
        }
        if (drive.getEligibleDepartment() != null
                && !drive.getEligibleDepartment().getId().equals(enrollment.getDepartment().getId())) {
            return new Eligibility(false, "Department is not in the eligible cohort");
        }
        if (drive.getEligibleProgram() != null
                && !drive.getEligibleProgram().getId().equals(enrollment.getProgram().getId())) {
            return new Eligibility(false, "Program is not in the eligible cohort");
        }
        if (drive.getEligibleBatch() != null
                && !drive.getEligibleBatch().getId().equals(enrollment.getBatch().getId())) {
            return new Eligibility(false, "Batch is not in the eligible cohort");
        }
        if (drive.getEligibleGraduationYear() != null
                && !drive.getEligibleGraduationYear().equals(enrollment.getBatch().getGraduationYear())) {
            return new Eligibility(false, "Graduation year does not match");
        }
        if (drive.getMinimumReadinessPercent() != null) {
            Integer readiness = readinessPercent(enrollment);
            if (readiness == null) {
                return new Eligibility(false, "Readiness is unavailable; the drive requires a minimum readiness score");
            }
            if (readiness < drive.getMinimumReadinessPercent()) {
                return new Eligibility(false, "Readiness is below the drive minimum");
            }
        }
        return new Eligibility(true, null);
    }

    private Integer readinessPercent(StudentEnrollment enrollment) {
        ReadinessResponse readiness = careerInsightService.readinessFor(
                enrollment.getStudentProfile().getUser().getId());
        return Boolean.TRUE.equals(readiness.hasTarget()) ? readiness.readinessPercent() : null;
    }

    private boolean driveVisibleToStudent(PlacementDrive drive) {
        return drive.getStatus() == DriveStatus.REGISTRATION_OPEN
                || drive.getStatus() == DriveStatus.REGISTRATION_CLOSED
                || drive.getStatus() == DriveStatus.ONGOING;
    }

    private boolean driveVisibleInScope(CollegeScope scope, PlacementDrive drive) {
        if (scope.isInstitutionWide()) {
            return true;
        }
        DriveTarget target = driveTarget(drive);
        return switch (scope.scopeType()) {
            case DEPARTMENT -> target.departmentId() == null
                    || target.departmentId().equals(scope.scopeId());
            case PROGRAM -> {
                var program = academicScopeService.requireProgram(scope.institutionId(), scope.scopeId());
                yield (target.departmentId() == null
                        || target.departmentId().equals(program.getDepartment().getId()))
                        && (target.programId() == null || target.programId().equals(program.getId()));
            }
            case BATCH -> {
                var batch = academicScopeService.requireBatch(scope.institutionId(), scope.scopeId());
                yield (target.departmentId() == null
                        || target.departmentId().equals(batch.getProgram().getDepartment().getId()))
                        && (target.programId() == null
                        || target.programId().equals(batch.getProgram().getId()))
                        && (target.batchId() == null || target.batchId().equals(batch.getId()));
            }
            case SECTION -> {
                var section = academicScopeService.requireSection(scope.institutionId(), scope.scopeId());
                var batch = section.getBatch();
                yield (target.departmentId() == null
                        || target.departmentId().equals(batch.getProgram().getDepartment().getId()))
                        && (target.programId() == null
                        || target.programId().equals(batch.getProgram().getId()))
                        && (target.batchId() == null || target.batchId().equals(batch.getId()));
            }
            default -> false;
        };
    }

    private static DriveTarget driveTarget(PlacementDrive drive) {
        Long departmentId = null;
        Long programId = null;
        Long batchId = null;
        if (drive.getEligibleDepartment() != null) {
            departmentId = drive.getEligibleDepartment().getId();
        }
        if (drive.getEligibleProgram() != null) {
            programId = drive.getEligibleProgram().getId();
            departmentId = drive.getEligibleProgram().getDepartment().getId();
        }
        if (drive.getEligibleBatch() != null) {
            batchId = drive.getEligibleBatch().getId();
            programId = drive.getEligibleBatch().getProgram().getId();
            departmentId = drive.getEligibleBatch().getProgram().getDepartment().getId();
        }
        return new DriveTarget(departmentId, programId, batchId);
    }

    private record DriveTarget(Long departmentId, Long programId, Long batchId) {
    }

    private Company requireCompany(CollegeScope scope, Long companyId) {
        if (companyId == null) throw BusinessException.notFound("Company not found");
        return companyRepository.findByIdAndInstitutionId(companyId, scope.institutionId())
                .orElseThrow(() -> BusinessException.notFound("Company not found"));
    }

    private JobOpening requireJob(CollegeScope scope, Long jobId) {
        if (jobId == null) throw BusinessException.notFound("Job opening not found");
        return jobRepository.findByIdAndInstitutionId(jobId, scope.institutionId())
                .orElseThrow(() -> BusinessException.notFound("Job opening not found"));
    }

    private PlacementDrive requireDrive(CollegeScope scope, Long driveId) {
        if (driveId == null) throw BusinessException.notFound("Placement drive not found");
        return driveRepository.findByIdAndInstitutionId(driveId, scope.institutionId())
                .orElseThrow(() -> BusinessException.notFound("Placement drive not found"));
    }

    private PlacementApplication requireApplication(CollegeScope scope, Long applicationId) {
        if (applicationId == null) throw BusinessException.notFound("Application not found");
        PlacementApplication application = applicationRepository
                .findByIdAndInstitutionId(applicationId, scope.institutionId())
                .orElseThrow(() -> BusinessException.notFound("Application not found"));
        StudentEnrollment enrollment = enrollmentFor(application);
        if (enrollment == null) throw BusinessException.notFound("Application not found");
        studentService.requireEnrollment(scope, enrollment.getId());
        return application;
    }

    private PlacementOffer requireOffer(CollegeScope scope, Long offerId) {
        if (offerId == null) throw BusinessException.notFound("Offer not found");
        PlacementOffer offer = offerRepository.findByIdAndInstitutionId(offerId, scope.institutionId())
                .orElseThrow(() -> BusinessException.notFound("Offer not found"));
        requireApplication(scope, offer.getApplication().getId());
        return offer;
    }

    private StudentEnrollment enrollmentFor(PlacementApplication application) {
        return enrollmentRepository.findByStudentProfileId(application.getStudentProfile().getId()).orElse(null);
    }

    private StudentEnrollment currentEnrollment() {
        var profile = studentProfileRepository.findByUserId(SecurityUtils.currentUserId()).orElse(null);
        StudentEnrollment enrollment = profile == null ? null
                : enrollmentRepository.findByStudentProfileId(profile.getId()).orElse(null);
        if (enrollment != null && enrollment.getInstitution().getStatus() != InstitutionStatus.ACTIVE) {
            return null;
        }
        return enrollment;
    }

    private StudentEnrollment requireCurrentEnrollment() {
        StudentEnrollment enrollment = currentEnrollment();
        if (enrollment == null) {
            throw BusinessException.badRequest("Your account is not linked to a college enrollment");
        }
        return enrollment;
    }

    private void recordStage(PlacementApplication application, ApplicationStage stage, String note,
                             CollegeScope scope) {
        stageEventRepository.save(ApplicationStageEvent.builder()
                .application(application)
                .stage(stage)
                .note(trim(note, 500))
                .recordedBy(scope == null ? currentUser(null) : currentUser(scope))
                .recordedAt(Instant.now())
                .build());
    }

    private User currentUser(CollegeScope scope) {
        Long userId = scope == null ? SecurityUtils.currentUserId() : scope.userId();
        return userRepository.findById(userId).orElse(null);
    }

    private com.codeit.careeros.college.entity.Institution companyInstitution(CollegeScope scope) {
        return institutionRepository.findById(scope.institutionId())
                .orElseThrow(() -> BusinessException.notFound("Institution not found"));
    }

    private com.codeit.careeros.college.entity.Department resolveDepartment(CollegeScope scope, Long id) {
        return id == null ? null : academicScopeService.requireDepartment(scope.institutionId(), id);
    }

    private com.codeit.careeros.college.entity.Program resolveProgram(CollegeScope scope, Long id) {
        return id == null ? null : academicScopeService.requireProgram(scope.institutionId(), id);
    }

    private com.codeit.careeros.college.entity.Batch resolveBatch(CollegeScope scope, Long id) {
        return id == null ? null : academicScopeService.requireBatch(scope.institutionId(), id);
    }

    private static void validateSalary(BigDecimal min, BigDecimal max) {
        if (min != null && min.signum() < 0) throw BusinessException.badRequest("Salary cannot be negative");
        if (max != null && max.signum() < 0) throw BusinessException.badRequest("Salary cannot be negative");
        if (min != null && max != null && min.compareTo(max) > 0) {
            throw BusinessException.badRequest("Salary minimum cannot exceed salary maximum");
        }
    }

    private static void validateDriveDates(PlacementDtos.DriveRequest request) {
        if (request.registrationStart() != null && request.registrationEnd() != null
                && request.registrationStart().isAfter(request.registrationEnd())) {
            throw BusinessException.badRequest("Registration start must be on or before the deadline");
        }
    }

    private static void validateEligibilityTargets(
            com.codeit.careeros.college.entity.Department department,
            com.codeit.careeros.college.entity.Program program,
            com.codeit.careeros.college.entity.Batch batch) {
        if (department != null && program != null
                && !program.getDepartment().getId().equals(department.getId())) {
            throw BusinessException.badRequest("The eligible program does not belong to the eligible department");
        }
        if (program != null && batch != null
                && !batch.getProgram().getId().equals(program.getId())) {
            throw BusinessException.badRequest("The eligible batch does not belong to the eligible program");
        }
        if (department != null && batch != null
                && !batch.getProgram().getDepartment().getId().equals(department.getId())) {
            throw BusinessException.badRequest("The eligible batch does not belong to the eligible department");
        }
    }

    private static Integer validateReadiness(Integer value) {
        if (value != null && (value < 0 || value > 100)) {
            throw BusinessException.badRequest("Minimum readiness must be between 0 and 100");
        }
        return value;
    }

    private static Integer validateGraduationYear(Integer value) {
        if (value != null && (value < 2000 || value > 2100)) {
            throw BusinessException.badRequest("Eligible graduation year must be between 2000 and 2100");
        }
        return value;
    }

    private PlacementDtos.CompanyResponse toCompany(Company company, CollegeScope scope) {
        boolean contacts = scope.canViewCompanyContacts();
        return new PlacementDtos.CompanyResponse(
                company.getId(), company.getName(), company.getIndustry(), company.getSector(),
                company.getWebsite(),
                contacts ? company.getContactName() : null,
                contacts ? company.getContactEmail() : null,
                contacts ? company.getContactPhone() : null,
                company.getRecruitmentStatus(), company.getSource(),
                contacts ? company.getNotes() : null,
                company.getCreatedAt(), company.getUpdatedAt());
    }

    private PlacementDtos.JobResponse toJob(JobOpening job) {
        return new PlacementDtos.JobResponse(
                job.getId(), job.getCompany().getId(), job.getCompany().getName(), job.getTitle(),
                job.getDescription(), job.getRequiredSkills(), job.getLocation(), job.getEmploymentType(),
                job.getEligibilityCriteria(), job.getSalaryMin(), job.getSalaryMax(), job.getCurrency(),
                job.getApplicationDeadline(), job.getStatus(), job.getCreatedAt(), job.getUpdatedAt());
    }

    private PlacementDtos.DriveResponse toDrive(PlacementDrive drive) {
        return new PlacementDtos.DriveResponse(
                drive.getId(), drive.getCompany().getId(), drive.getCompany().getName(),
                drive.getJob().getId(), drive.getJob().getTitle(), drive.getName(),
                drive.getRegistrationStart(), drive.getRegistrationEnd(), drive.getDriveDate(),
                drive.getEligibilityCriteria(),
                drive.getEligibleDepartment() == null ? null : drive.getEligibleDepartment().getId(),
                drive.getEligibleDepartment() == null ? null : drive.getEligibleDepartment().getName(),
                drive.getEligibleProgram() == null ? null : drive.getEligibleProgram().getId(),
                drive.getEligibleProgram() == null ? null : drive.getEligibleProgram().getName(),
                drive.getEligibleBatch() == null ? null : drive.getEligibleBatch().getId(),
                drive.getEligibleBatch() == null ? null : drive.getEligibleBatch().getLabel(),
                drive.getEligibleGraduationYear(), drive.getMinimumReadinessPercent(), drive.getStatus(),
                applicationRepository.countByDriveId(drive.getId()), drive.getCreatedAt(), drive.getUpdatedAt());
    }

    private PlacementDtos.ApplicationResponse toApplication(PlacementApplication application) {
        StudentEnrollment enrollment = enrollmentFor(application);
        PlacementOffer offer = offerRepository.findByApplicationId(application.getId()).orElse(null);
        List<PlacementDtos.StageEventResponse> history = stageEventRepository
                .findByApplicationIdOrderByRecordedAtAscIdAsc(application.getId()).stream()
                .map(event -> new PlacementDtos.StageEventResponse(
                        event.getId(), event.getStage(), event.getNote(),
                        event.getRecordedBy() == null ? null : event.getRecordedBy().getFullName(),
                        event.getRecordedAt()))
                .toList();
        return new PlacementDtos.ApplicationResponse(
                application.getId(),
                application.getDrive().getId(),
                application.getDrive().getName(),
                application.getDrive().getCompany().getId(),
                application.getDrive().getCompany().getName(),
                application.getDrive().getJob().getId(),
                application.getDrive().getJob().getTitle(),
                enrollment == null ? null : enrollment.getId(),
                application.getStudentProfile().getId(),
                application.getStudentProfile().getFullName(),
                application.getStudentProfile().getStudentId(),
                enrollment == null ? null : enrollment.getRollNumber(),
                enrollment == null ? null : enrollment.getDepartment().getName(),
                enrollment == null ? null : enrollment.getProgram().getName(),
                enrollment == null ? null : enrollment.getBatch().getLabel(),
                application.getStage(),
                application.isEligibilityOverride(),
                application.getOverrideReason(),
                application.getAppliedAt(),
                application.getUpdatedAt(),
                history,
                offer == null ? null : toOffer(offer));
    }

    private PlacementDtos.OfferResponse toOffer(PlacementOffer offer) {
        return new PlacementDtos.OfferResponse(
                offer.getId(), offer.getApplication().getId(), offer.getPackageAmount(),
                offer.getCurrency(), offer.getOfferDate(), offer.getStatus(), offer.getJoinedAt(),
                offer.getNotes(), offer.getCreatedAt(), offer.getUpdatedAt());
    }

    private record Eligibility(boolean eligible, String reason) {
    }

    private static String trim(String value, int max) {
        if (value == null) return null;
        String cleaned = value.replaceAll("[\\r\\n\\t]+", " ").strip();
        return cleaned.length() <= max ? cleaned : cleaned.substring(0, max);
    }
}
