package com.codeit.careeros.service;

import com.codeit.careeros.assessment.AssessmentAttempt;
import com.codeit.careeros.assessment.SkillScore;
import com.codeit.careeros.career.CareerSkill;
import com.codeit.careeros.common.enums.AttemptStatus;
import com.codeit.careeros.common.enums.ProgressStatus;
import com.codeit.careeros.dto.project.ProjectListResponse;
import com.codeit.careeros.dto.project.ProjectResponse;
import com.codeit.careeros.dto.project.ProjectSkillResponse;
import com.codeit.careeros.entity.StudentProfile;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.exception.BusinessException;
import com.codeit.careeros.project.Project;
import com.codeit.careeros.project.ProjectProgress;
import com.codeit.careeros.project.ProjectSkill;
import com.codeit.careeros.repository.AssessmentAttemptRepository;
import com.codeit.careeros.repository.CareerSkillRepository;
import com.codeit.careeros.repository.ProjectProgressRepository;
import com.codeit.careeros.repository.ProjectRepository;
import com.codeit.careeros.repository.ProjectSkillRepository;
import com.codeit.careeros.repository.SkillScoreRepository;
import com.codeit.careeros.repository.StudentProfileRepository;
import com.codeit.careeros.repository.UserRepository;
import com.codeit.careeros.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Sprint 4 project recommendations (docs section 19): published projects of
 * the student's target career from {@code projects}/{@code project_skills},
 * each with its required skills enriched by the student's live gaps, plus
 * per-student project progress. Fully database-driven.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProjectService {

    private final StudentProfileRepository studentProfileRepository;
    private final ProjectRepository projectRepository;
    private final ProjectSkillRepository projectSkillRepository;
    private final ProjectProgressRepository progressRepository;
    private final CareerSkillRepository careerSkillRepository;
    private final AssessmentAttemptRepository attemptRepository;
    private final SkillScoreRepository skillScoreRepository;
    private final UserRepository userRepository;

    /** Recommended (published) projects of the current student's target career. */
    @Transactional(readOnly = true)
    public ProjectListResponse recommended() {
        return recommendedFor(SecurityUtils.currentUserId());
    }

    /** Recommended projects of a specific student. Caller must authorize the student. */
    @Transactional(readOnly = true)
    public ProjectListResponse recommendedFor(Long userId) {
        StudentProfile profile = studentProfileRepository.findByUserId(userId).orElse(null);
        if (profile == null || profile.getTargetCareer() == null) {
            return new ProjectListResponse(null, null, false, 0, 0, 0, List.of());
        }
        Long careerId = profile.getTargetCareer().getId();
        String careerName = profile.getTargetCareer().getName();

        Map<Long, CareerSkill> framework = careerSkillRepository
                .findByCareerIdOrderByWeightPercentDesc(careerId).stream()
                .collect(Collectors.toMap(cs -> cs.getSkill().getId(), Function.identity()));
        Map<Long, SkillScore> latestBySkill = latestScoresBySkill(userId, careerId);
        Map<Long, ProgressStatus> statusByProject = progressRepository
                .findByUserIdAndProjectCareerId(userId, careerId).stream()
                .collect(Collectors.toMap(
                        p -> p.getProject().getId(), ProjectProgress::getStatus,
                        (first, second) -> first));

        List<ProjectResponse> projects = new ArrayList<>();
        int completed = 0;
        int inProgress = 0;
        for (Project project : projectRepository.findByCareerIdAndPublishedTrueOrderByDisplayOrderAsc(careerId)) {
            ProgressStatus status = statusByProject.getOrDefault(project.getId(), ProgressStatus.NOT_STARTED);
            if (status == ProgressStatus.COMPLETED) {
                completed++;
            } else if (status == ProgressStatus.IN_PROGRESS) {
                inProgress++;
            }
            projects.add(toProjectResponse(project, framework, latestBySkill, status));
        }

        log.info("Project recommendations for student {} on career {}: {} projects ({} completed)",
                profile.getStudentId(), careerId, projects.size(), completed);
        return new ProjectListResponse(
                careerId, careerName, true, projects.size(), completed, inProgress, projects);
    }

    /** Marks a project NOT_STARTED / IN_PROGRESS / COMPLETED for the current student. */
    @Transactional
    public ProjectResponse updateStatus(Long projectId, String statusRaw) {
        Long userId = SecurityUtils.currentUserId();
        ProgressStatus status = RoadmapService.parseStatus(statusRaw);
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> BusinessException.notFound("Project not found: " + projectId));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> BusinessException.notFound("User not found: " + userId));

        ProjectProgress progress = progressRepository
                .findByUserIdAndProjectId(userId, projectId)
                .orElseGet(() -> ProjectProgress.builder().user(user).project(project).build());
        progress.setStatus(status);
        progressRepository.save(progress);

        log.info("Student {} set project {} to {}", userId, projectId, status);
        Long careerId = project.getCareer().getId();
        Map<Long, CareerSkill> framework = careerSkillRepository
                .findByCareerIdOrderByWeightPercentDesc(careerId).stream()
                .collect(Collectors.toMap(cs -> cs.getSkill().getId(), Function.identity()));
        return toProjectResponse(project, framework, latestScoresBySkill(userId, careerId), status);
    }

    private ProjectResponse toProjectResponse(
            Project project,
            Map<Long, CareerSkill> framework,
            Map<Long, SkillScore> latestBySkill,
            ProgressStatus status) {
        List<ProjectSkillResponse> skills = projectSkillRepository.findByProjectId(project.getId()).stream()
                .map(ProjectSkill::getSkill)
                .map(skill -> {
                    CareerSkill mapping = framework.get(skill.getId());
                    Integer target = mapping != null ? mapping.getTargetPercent() : null;
                    SkillScore score = latestBySkill.get(skill.getId());
                    boolean assessed = score != null;
                    Integer scorePercent = assessed ? score.getScorePercent() : null;
                    Integer gap = assessed && target != null ? scorePercent - target : null;
                    return new ProjectSkillResponse(
                            skill.getId(), skill.getName(), skill.getCategory().name(),
                            target, scorePercent, gap, assessed);
                })
                .toList();
        return new ProjectResponse(
                project.getId(), project.getTitle(), project.getDescription(),
                project.getDifficulty().name(), project.getEstimatedWeeks(),
                project.getDisplayOrder(), status.name(), skills);
    }

    private Map<Long, SkillScore> latestScoresBySkill(Long userId, Long careerId) {
        List<AssessmentAttempt> submitted = attemptRepository
                .findByUserIdAndStatusOrderByStartedAtDesc(userId, AttemptStatus.SUBMITTED).stream()
                .filter(attempt -> attempt.getAssessment() != null
                        && attempt.getAssessment().getCareer() != null
                        && careerId.equals(attempt.getAssessment().getCareer().getId()))
                .toList();
        Map<Long, SkillScore> latestBySkill = new LinkedHashMap<>();
        for (AssessmentAttempt attempt : submitted) {
            for (SkillScore score : skillScoreRepository.findByAttemptIdOrderByWeightPercentDesc(attempt.getId())) {
                latestBySkill.putIfAbsent(score.getSkill().getId(), score);
            }
        }
        return latestBySkill;
    }
}
