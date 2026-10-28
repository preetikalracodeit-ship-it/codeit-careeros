package com.codeit.careeros.improvement.service;

import com.codeit.careeros.college.entity.StudentEnrollment;
import com.codeit.careeros.college.enums.MembershipStatus;
import com.codeit.careeros.college.repository.InstitutionMembershipRepository;
import com.codeit.careeros.college.repository.StudentEnrollmentRepository;
import com.codeit.careeros.college.service.AuditService;
import com.codeit.careeros.college.service.CollegeScope;
import com.codeit.careeros.college.service.StudentService;
import com.codeit.careeros.dto.insight.ReadinessResponse;
import com.codeit.careeros.dto.insight.SkillGapResponse;
import com.codeit.careeros.entity.StudentProfile;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.exception.BusinessException;
import com.codeit.careeros.improvement.dto.ImprovementDtos;
import com.codeit.careeros.improvement.entity.ImprovementPlan;
import com.codeit.careeros.improvement.entity.ImprovementTask;
import com.codeit.careeros.improvement.enums.PlanStatus;
import com.codeit.careeros.improvement.enums.TaskPriority;
import com.codeit.careeros.improvement.enums.TaskStatus;
import com.codeit.careeros.improvement.repository.ImprovementPlanRepository;
import com.codeit.careeros.improvement.repository.ImprovementTaskRepository;
import com.codeit.careeros.repository.SkillRepository;
import com.codeit.careeros.repository.StudentProfileRepository;
import com.codeit.careeros.repository.UserRepository;
import com.codeit.careeros.security.SecurityUtils;
import com.codeit.careeros.service.CareerInsightService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Evidence-based improvement plans. Generation only uses skills that have a
 * submitted assessment score below the target career requirement; missing
 * assessment data is never turned into a gap or a task.
 */
@Service
@RequiredArgsConstructor
public class ImprovementPlanService {

    private static final int MAX_GENERATED_TASKS = 8;
    private static final int DEFAULT_HORIZON_DAYS = 30;
    private static final int MAX_LIST = 500;

    private final ImprovementPlanRepository planRepository;
    private final ImprovementTaskRepository taskRepository;
    private final StudentEnrollmentRepository enrollmentRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final InstitutionMembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final SkillRepository skillRepository;
    private final StudentService studentService;
    private final CareerInsightService careerInsightService;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public ImprovementDtos.ImprovementPlanListResponse list(CollegeScope scope,
                                                            Long enrollmentId,
                                                            PlanStatus status,
                                                            String search) {
        if (!scope.canViewImprovementPlans()) {
            throw BusinessException.forbidden("Your role cannot view improvement plans");
        }
        List<ImprovementPlan> plans = planRepository.findByInstitutionIdOrderByUpdatedAtDesc(scope.institutionId());
        if (status != null) {
            plans = plans.stream().filter(plan -> plan.getStatus() == status).toList();
        }
        String term = search == null ? null : search.trim().toLowerCase(Locale.ROOT);
        List<ImprovementDtos.ImprovementPlanResponse> items = new ArrayList<>();
        for (ImprovementPlan plan : plans) {
            StudentEnrollment enrollment = enrollmentRepository
                    .findByStudentProfileId(plan.getStudentProfile().getId()).orElse(null);
            if (enrollment == null) {
                continue;
            }
            if (enrollmentId != null && !enrollmentId.equals(enrollment.getId())) {
                continue;
            }
            if (term != null && !term.isBlank()) {
                String haystack = (enrollment.getStudentProfile().getFullName() + " "
                        + enrollment.getRollNumber() + " " + plan.getTitle()).toLowerCase(Locale.ROOT);
                if (!haystack.contains(term)) {
                    continue;
                }
            }
            try {
                studentService.requireEnrollment(scope, enrollment.getId());
            } catch (BusinessException ex) {
                continue;
            }
            items.add(toResponse(plan, enrollment));
            if (items.size() >= MAX_LIST) {
                break;
            }
        }
        return new ImprovementDtos.ImprovementPlanListResponse(items, items.size());
    }

    @Transactional(readOnly = true)
    public ImprovementDtos.ImprovementPlanResponse detail(CollegeScope scope, Long planId) {
        ImprovementPlan plan = requirePlan(scope, planId);
        StudentEnrollment enrollment = requireEnrollmentForPlan(scope, plan);
        return toResponse(plan, enrollment);
    }

    @Transactional
    public ImprovementDtos.ImprovementPlanResponse generate(CollegeScope scope,
                                                             ImprovementDtos.PlanGenerateRequest request) {
        scope.requireManageImprovementPlans();
        if (request == null || request.enrollmentId() == null) {
            throw BusinessException.badRequest("A student enrollment is required");
        }
        StudentEnrollment enrollment = studentService.requireEnrollment(scope, request.enrollmentId());
        StudentProfile profile = enrollment.getStudentProfile();
        ReadinessResponse readiness = careerInsightService.readinessFor(profile.getUser().getId());
        if (!Boolean.TRUE.equals(readiness.hasTarget())) {
            throw BusinessException.badRequest("The student has no target career; a plan cannot be generated from assessment evidence");
        }
        List<SkillGapResponse> evidence = (readiness.gaps() == null ? List.<SkillGapResponse>of() : readiness.gaps())
                .stream()
                .filter(gap -> Boolean.TRUE.equals(gap.assessed()))
                .filter(gap -> gap.scorePercent() != null && gap.targetPercent() != null)
                .filter(gap -> !Boolean.TRUE.equals(gap.metTarget()))
                .sorted(Comparator.comparingInt(gap -> gap.gapPercent() == null ? 0 : gap.gapPercent()))
                .limit(MAX_GENERATED_TASKS)
                .toList();
        if (evidence.isEmpty()) {
            throw BusinessException.badRequest(
                    "No assessed skill gaps are available. Missing assessment data is not treated as a gap.");
        }

        int horizon = request.horizonDays() == null ? DEFAULT_HORIZON_DAYS
                : Math.max(7, Math.min(180, request.horizonDays()));
        LocalDate targetDate = LocalDate.now(scope.institutionZone()).plusDays(horizon);
        User creator = userRepository.findById(scope.userId()).orElse(null);

        ImprovementPlan plan = planRepository.save(ImprovementPlan.builder()
                .institution(enrollment.getInstitution())
                .studentProfile(profile)
                .title("Readiness plan - " + readiness.targetCareerName())
                .summary("Generated from the latest submitted assessment scores against the target career. "
                        + "Only assessed skills below target are included.")
                .status(PlanStatus.ACTIVE)
                .targetCareerName(readiness.targetCareerName())
                .createdBy(creator)
                .build());

        for (int index = 0; index < evidence.size(); index++) {
            SkillGapResponse gap = evidence.get(index);
            int gapPercent = gap.gapPercent() == null ? 0 : gap.gapPercent();
            TaskPriority priority = gapPercent <= -30 ? TaskPriority.HIGH
                    : gapPercent <= -15 ? TaskPriority.MEDIUM : TaskPriority.LOW;
            taskRepository.save(ImprovementTask.builder()
                    .plan(plan)
                    .title("Reach " + gap.targetPercent() + "% in " + gap.skillName())
                    .description("Latest assessed score: " + gap.scorePercent() + "%. Target career requirement: "
                            + gap.targetPercent() + "%. Practise this skill and reassess when ready.")
                    .skill(skillRepository.findById(gap.skillId()).orElse(null))
                    .skillName(gap.skillName())
                    .priority(priority)
                    .status(TaskStatus.NOT_STARTED)
                    .targetDate(targetDate.plusDays(index * 3L))
                    .ownerUser(creator)
                    .ownerName(creator == null ? scope.userFullName() : creator.getFullName())
                    .baselineScore(gap.scorePercent())
                    .targetScore(gap.targetPercent())
                    .evidenceSource("ASSESSMENT")
                    .build());
        }

        auditService.success("IMPROVEMENT_PLAN_GENERATE", "IMPROVEMENT_PLAN",
                String.valueOf(plan.getId()), scope.institutionId(), scope,
                "studentEnrollmentId=" + enrollment.getId() + ",tasks=" + evidence.size());
        return toResponse(plan, enrollment);
    }

    @Transactional
    public ImprovementDtos.ImprovementPlanResponse create(CollegeScope scope,
                                                           ImprovementDtos.PlanCreateRequest request) {
        scope.requireManageImprovementPlans();
        if (request == null || request.enrollmentId() == null) {
            throw BusinessException.badRequest("A student enrollment is required");
        }
        if (request.title() == null || request.title().isBlank()) {
            throw BusinessException.badRequest("A plan title is required");
        }
        StudentEnrollment enrollment = studentService.requireEnrollment(scope, request.enrollmentId());
        User creator = userRepository.findById(scope.userId()).orElse(null);
        ImprovementPlan plan = planRepository.save(ImprovementPlan.builder()
                .institution(enrollment.getInstitution())
                .studentProfile(enrollment.getStudentProfile())
                .title(request.title().trim())
                .summary(trim(request.summary(), 1000))
                .status(request.tasks() == null || request.tasks().isEmpty() ? PlanStatus.DRAFT : PlanStatus.ACTIVE)
                .targetCareerName(enrollment.getStudentProfile().getTargetCareer() == null ? null
                        : enrollment.getStudentProfile().getTargetCareer().getName())
                .createdBy(creator)
                .build());
        if (request.tasks() != null) {
            for (ImprovementDtos.PlanTaskRequest taskRequest : request.tasks()) {
                addTask(scope, plan, taskRequest);
            }
        }
        auditService.success("IMPROVEMENT_PLAN_CREATE", "IMPROVEMENT_PLAN",
                String.valueOf(plan.getId()), scope.institutionId(), scope,
                "studentEnrollmentId=" + enrollment.getId());
        return toResponse(plan, enrollment);
    }

    @Transactional
    public ImprovementDtos.ImprovementPlanResponse update(CollegeScope scope, Long planId,
                                                           ImprovementDtos.PlanUpdateRequest request) {
        scope.requireManageImprovementPlans();
        ImprovementPlan plan = requirePlan(scope, planId);
        StudentEnrollment enrollment = requireEnrollmentForPlan(scope, plan);
        if (request != null) {
            if (request.title() != null) {
                if (request.title().isBlank()) {
                    throw BusinessException.badRequest("A plan title cannot be blank");
                }
                plan.setTitle(request.title().trim());
            }
            if (request.summary() != null) {
                plan.setSummary(trim(request.summary(), 1000));
            }
            if (request.status() != null) {
                plan.setStatus(request.status());
            }
        }
        plan = planRepository.save(plan);
        auditService.success("IMPROVEMENT_PLAN_UPDATE", "IMPROVEMENT_PLAN",
                String.valueOf(plan.getId()), scope.institutionId(), scope,
                "status=" + plan.getStatus());
        return toResponse(plan, enrollment);
    }

    @Transactional
    public ImprovementDtos.ImprovementPlanResponse addTask(CollegeScope scope, Long planId,
                                                            ImprovementDtos.PlanTaskRequest request) {
        scope.requireManageImprovementPlans();
        ImprovementPlan plan = requirePlan(scope, planId);
        StudentEnrollment enrollment = requireEnrollmentForPlan(scope, plan);
        addTask(scope, plan, request);
        return toResponse(plan, enrollment);
    }

    @Transactional
    public ImprovementDtos.ImprovementPlanResponse updateTask(CollegeScope scope, Long planId, Long taskId,
                                                               ImprovementDtos.TaskUpdateRequest request) {
        scope.requireManageImprovementPlans();
        ImprovementPlan plan = requirePlan(scope, planId);
        StudentEnrollment enrollment = requireEnrollmentForPlan(scope, plan);
        ImprovementTask task = taskRepository.findByIdAndPlanId(taskId, planId)
                .orElseThrow(() -> BusinessException.notFound("Improvement task not found"));
        applyTaskUpdate(task, request);
        task = taskRepository.save(task);
        refreshPlanStatus(plan);
        auditService.success("IMPROVEMENT_TASK_UPDATE", "IMPROVEMENT_TASK",
                String.valueOf(task.getId()), scope.institutionId(), scope,
                "planId=" + planId + ",status=" + task.getStatus());
        return toResponse(plan, enrollment);
    }

    @Transactional(readOnly = true)
    public ImprovementDtos.ImprovementPlanListResponse myPlans() {
        StudentProfile profile = studentProfileRepository.findByUserId(SecurityUtils.currentUserId())
                .orElseThrow(() -> BusinessException.notFound("Student profile not found"));
        List<ImprovementDtos.ImprovementPlanResponse> items = planRepository
                .findByStudentProfileIdOrderByUpdatedAtDesc(profile.getId()).stream()
                .map(plan -> toResponse(plan, enrollmentRepository
                        .findByStudentProfileId(profile.getId()).orElse(null)))
                .toList();
        return new ImprovementDtos.ImprovementPlanListResponse(items, items.size());
    }

    @Transactional
    public ImprovementDtos.ImprovementPlanResponse updateMyTask(Long taskId,
                                                                 ImprovementDtos.TaskUpdateRequest request) {
        if (request == null || request.status() == null) {
            throw BusinessException.badRequest("A task status is required");
        }
        if (request.status() == TaskStatus.OVERDUE || request.status() == TaskStatus.REASSESSMENT_REQUIRED) {
            throw BusinessException.badRequest("That task status can only be set by institution staff");
        }
        StudentProfile profile = studentProfileRepository.findByUserId(SecurityUtils.currentUserId())
                .orElseThrow(() -> BusinessException.notFound("Student profile not found"));
        ImprovementTask task = taskRepository.findById(taskId)
                .orElseThrow(() -> BusinessException.notFound("Improvement task not found"));
        if (!task.getPlan().getStudentProfile().getId().equals(profile.getId())) {
            throw BusinessException.notFound("Improvement task not found");
        }
        task.setStatus(request.status());
        task.setCompletedAt(request.status() == TaskStatus.COMPLETED ? Instant.now() : null);
        task = taskRepository.save(task);
        refreshPlanStatus(task.getPlan());
        StudentEnrollment enrollment = enrollmentRepository
                .findByStudentProfileId(profile.getId()).orElse(null);
        auditService.success("IMPROVEMENT_TASK_UPDATE", "IMPROVEMENT_TASK",
                String.valueOf(task.getId()), enrollment == null ? null : enrollment.getInstitution().getId(),
                null, "planId=" + task.getPlan().getId() + ",status=" + task.getStatus() + ",source=STUDENT");
        return toResponse(task.getPlan(), enrollment);
    }

    private void addTask(CollegeScope scope, ImprovementPlan plan,
                         ImprovementDtos.PlanTaskRequest request) {
        if (request == null || request.title() == null || request.title().isBlank()) {
            throw BusinessException.badRequest("Every improvement task needs a title");
        }
        User owner = resolveOwner(scope, request.ownerUserId());
        String ownerName = request.ownerName() == null || request.ownerName().isBlank()
                ? (owner == null ? null : owner.getFullName())
                : request.ownerName().trim();
        var skill = request.skillId() == null ? null
                : skillRepository.findById(request.skillId())
                .orElseThrow(() -> BusinessException.badRequest("Unknown skill id"));
        taskRepository.save(ImprovementTask.builder()
                .plan(plan)
                .title(request.title().trim())
                .description(trim(request.description(), 1000))
                .skill(skill)
                .skillName(skill == null ? null : skill.getName())
                .priority(request.priority() == null ? TaskPriority.MEDIUM : request.priority())
                .status(TaskStatus.NOT_STARTED)
                .targetDate(request.targetDate())
                .ownerUser(owner)
                .ownerName(ownerName)
                .baselineScore(request.baselineScore())
                .targetScore(request.targetScore())
                .evidenceSource("MANUAL")
                .build());
    }

    private User resolveOwner(CollegeScope scope, Long ownerUserId) {
        Long resolved = ownerUserId == null ? scope.userId() : ownerUserId;
        membershipRepository.findByUserIdAndInstitutionId(resolved, scope.institutionId())
                .filter(membership -> membership.getStatus() == MembershipStatus.ACTIVE)
                .orElseThrow(() -> BusinessException.badRequest("The task owner is not active staff in this institution"));
        return userRepository.findById(resolved)
                .orElseThrow(() -> BusinessException.badRequest("The task owner was not found"));
    }

    private void applyTaskUpdate(ImprovementTask task, ImprovementDtos.TaskUpdateRequest request) {
        if (request == null) {
            return;
        }
        if (request.status() != null) {
            task.setStatus(request.status());
            task.setCompletedAt(request.status() == TaskStatus.COMPLETED ? Instant.now() : null);
        }
        if (request.targetDate() != null) {
            task.setTargetDate(request.targetDate());
        }
        if (request.ownerName() != null) {
            task.setOwnerName(trim(request.ownerName(), 120));
        }
        if (request.description() != null) {
            task.setDescription(trim(request.description(), 1000));
        }
    }

    private void refreshPlanStatus(ImprovementPlan plan) {
        long total = taskRepository.countByPlanId(plan.getId());
        long completed = taskRepository.countByPlanIdAndStatus(plan.getId(), TaskStatus.COMPLETED);
        if (total > 0 && completed == total && plan.getStatus() == PlanStatus.ACTIVE) {
            plan.setStatus(PlanStatus.COMPLETED);
            planRepository.save(plan);
        } else if (completed < total && plan.getStatus() == PlanStatus.COMPLETED) {
            plan.setStatus(PlanStatus.ACTIVE);
            planRepository.save(plan);
        }
    }

    private ImprovementPlan requirePlan(CollegeScope scope, Long planId) {
        if (planId == null) {
            throw BusinessException.notFound("Improvement plan not found");
        }
        return planRepository.findByIdAndInstitutionId(planId, scope.institutionId())
                .orElseThrow(() -> BusinessException.notFound("Improvement plan not found"));
    }

    private StudentEnrollment requireEnrollmentForPlan(CollegeScope scope, ImprovementPlan plan) {
        StudentEnrollment enrollment = enrollmentRepository
                .findByStudentProfileId(plan.getStudentProfile().getId())
                .orElseThrow(() -> BusinessException.notFound("Student enrollment not found"));
        return studentService.requireEnrollment(scope, enrollment.getId());
    }

    private ImprovementDtos.ImprovementPlanResponse toResponse(ImprovementPlan plan,
                                                                StudentEnrollment enrollment) {
        List<ImprovementTask> tasks = taskRepository.findByPlanIdOrderByTargetDateAscIdAsc(plan.getId());
        LocalDate today = LocalDate.now();
        List<ImprovementDtos.ImprovementTaskResponse> taskResponses = tasks.stream()
                .map(task -> {
                    boolean overdue = task.getTargetDate() != null
                            && task.getTargetDate().isBefore(today)
                            && task.getStatus() != TaskStatus.COMPLETED
                            && task.getStatus() != TaskStatus.REASSESSMENT_REQUIRED;
                    return new ImprovementDtos.ImprovementTaskResponse(
                            task.getId(),
                            task.getTitle(),
                            task.getDescription(),
                            task.getSkill() == null ? null : task.getSkill().getId(),
                            task.getSkillName(),
                            task.getPriority(),
                            overdue ? TaskStatus.OVERDUE : task.getStatus(),
                            task.getTargetDate(),
                            task.getOwnerUser() == null ? null : task.getOwnerUser().getId(),
                            task.getOwnerName(),
                            task.getBaselineScore(),
                            task.getTargetScore(),
                            task.getEvidenceSource(),
                            overdue,
                            task.getCompletedAt(),
                            task.getCreatedAt(),
                            task.getUpdatedAt());
                })
                .toList();
        int completed = (int) tasks.stream().filter(task -> task.getStatus() == TaskStatus.COMPLETED).count();
        int total = tasks.size();
        int progress = total == 0 ? 0 : Math.round(completed * 100.0f / total);
        Integer readinessPercent = null;
        if (plan.getStudentProfile().getUser() != null) {
            ReadinessResponse readiness = careerInsightService.readinessFor(
                    plan.getStudentProfile().getUser().getId());
            readinessPercent = Boolean.TRUE.equals(readiness.hasTarget()) ? readiness.readinessPercent() : null;
        }
        StudentProfile profile = plan.getStudentProfile();
        return new ImprovementDtos.ImprovementPlanResponse(
                plan.getId(),
                enrollment == null ? null : enrollment.getId(),
                profile.getId(),
                profile.getFullName(),
                profile.getStudentId(),
                enrollment == null ? null : enrollment.getRollNumber(),
                enrollment == null ? null : enrollment.getDepartment().getName(),
                enrollment == null ? null : enrollment.getProgram().getName(),
                enrollment == null ? null : enrollment.getBatch().getLabel(),
                plan.getTitle(),
                plan.getSummary(),
                plan.getStatus(),
                plan.getTargetCareerName(),
                readinessPercent,
                plan.getCreatedBy() == null ? null : plan.getCreatedBy().getFullName(),
                taskResponses,
                completed,
                total,
                progress,
                plan.getCreatedAt(),
                plan.getUpdatedAt());
    }

    private static String trim(String value, int max) {
        if (value == null) {
            return null;
        }
        String cleaned = value.replaceAll("[\\r\\n\\t]+", " ").strip();
        return cleaned.length() <= max ? cleaned : cleaned.substring(0, max);
    }
}
