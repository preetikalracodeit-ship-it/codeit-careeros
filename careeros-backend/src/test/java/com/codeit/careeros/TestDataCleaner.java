package com.codeit.careeros;

import com.codeit.careeros.college.repository.StudentEnrollmentRepository;
import com.codeit.careeros.repository.AssessmentAnswerRepository;
import com.codeit.careeros.repository.AssessmentAttemptQuestionRepository;
import com.codeit.careeros.repository.AssessmentAttemptRepository;
import com.codeit.careeros.repository.AssessmentQuestionRepository;
import com.codeit.careeros.repository.AssessmentTestRepository;
import com.codeit.careeros.repository.CareerRepository;
import com.codeit.careeros.repository.CareerSkillRepository;
import com.codeit.careeros.repository.CvDocumentRepository;
import com.codeit.careeros.repository.LinkedInProfileRepository;
import com.codeit.careeros.repository.ProjectProgressRepository;
import com.codeit.careeros.repository.ProjectRepository;
import com.codeit.careeros.repository.ProjectSkillRepository;
import com.codeit.careeros.repository.QuestionOptionRepository;
import com.codeit.careeros.repository.RoadmapItemProgressRepository;
import com.codeit.careeros.repository.RoadmapItemRepository;
import com.codeit.careeros.repository.RoadmapPhaseRepository;
import com.codeit.careeros.repository.SkillRepository;
import com.codeit.careeros.repository.SkillScoreRepository;
import com.codeit.careeros.repository.StudentProfileRepository;
import org.springframework.stereotype.Component;

/**
 * Clears the shared H2 test database in foreign-key-safe order.
 *
 * <p>The Spring test contexts share one in-memory database, so a class that
 * leaves careers, profiles or roadmaps behind can break the next class. Every
 * test that resets that data calls this before its own setup. Users, consent
 * records, audit events and institution master data are deliberately kept so
 * the bootstrapped admin and College fixtures remain available.
 */
@Component
public class TestDataCleaner {

    private final StudentEnrollmentRepository studentEnrollmentRepository;
    private final AssessmentAttemptQuestionRepository attemptQuestionRepository;
    private final RoadmapItemProgressRepository roadmapProgressRepository;
    private final RoadmapItemRepository roadmapItemRepository;
    private final RoadmapPhaseRepository roadmapPhaseRepository;
    private final ProjectProgressRepository projectProgressRepository;
    private final ProjectSkillRepository projectSkillRepository;
    private final ProjectRepository projectRepository;
    private final SkillScoreRepository skillScoreRepository;
    private final AssessmentAnswerRepository answerRepository;
    private final AssessmentAttemptRepository attemptRepository;
    private final QuestionOptionRepository optionRepository;
    private final AssessmentQuestionRepository questionRepository;
    private final AssessmentTestRepository assessmentTestRepository;
    private final CareerSkillRepository careerSkillRepository;
    private final CvDocumentRepository cvDocumentRepository;
    private final LinkedInProfileRepository linkedInProfileRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final CareerRepository careerRepository;
    private final SkillRepository skillRepository;

    public TestDataCleaner(
            StudentEnrollmentRepository studentEnrollmentRepository,
            AssessmentAttemptQuestionRepository attemptQuestionRepository,
            RoadmapItemProgressRepository roadmapProgressRepository,
            RoadmapItemRepository roadmapItemRepository,
            RoadmapPhaseRepository roadmapPhaseRepository,
            ProjectProgressRepository projectProgressRepository,
            ProjectSkillRepository projectSkillRepository,
            ProjectRepository projectRepository,
            SkillScoreRepository skillScoreRepository,
            AssessmentAnswerRepository answerRepository,
            AssessmentAttemptRepository attemptRepository,
            QuestionOptionRepository optionRepository,
            AssessmentQuestionRepository questionRepository,
            AssessmentTestRepository assessmentTestRepository,
            CareerSkillRepository careerSkillRepository,
            CvDocumentRepository cvDocumentRepository,
            LinkedInProfileRepository linkedInProfileRepository,
            StudentProfileRepository studentProfileRepository,
            CareerRepository careerRepository,
            SkillRepository skillRepository) {
        this.studentEnrollmentRepository = studentEnrollmentRepository;
        this.attemptQuestionRepository = attemptQuestionRepository;
        this.roadmapProgressRepository = roadmapProgressRepository;
        this.roadmapItemRepository = roadmapItemRepository;
        this.roadmapPhaseRepository = roadmapPhaseRepository;
        this.projectProgressRepository = projectProgressRepository;
        this.projectSkillRepository = projectSkillRepository;
        this.projectRepository = projectRepository;
        this.skillScoreRepository = skillScoreRepository;
        this.answerRepository = answerRepository;
        this.attemptRepository = attemptRepository;
        this.optionRepository = optionRepository;
        this.questionRepository = questionRepository;
        this.assessmentTestRepository = assessmentTestRepository;
        this.careerSkillRepository = careerSkillRepository;
        this.cvDocumentRepository = cvDocumentRepository;
        this.linkedInProfileRepository = linkedInProfileRepository;
        this.studentProfileRepository = studentProfileRepository;
        this.careerRepository = careerRepository;
        this.skillRepository = skillRepository;
    }

    public void clean() {
        studentEnrollmentRepository.deleteAll();
        attemptQuestionRepository.deleteAll();
        roadmapProgressRepository.deleteAll();
        roadmapItemRepository.deleteAll();
        roadmapPhaseRepository.deleteAll();
        projectProgressRepository.deleteAll();
        projectSkillRepository.deleteAll();
        projectRepository.deleteAll();
        skillScoreRepository.deleteAll();
        answerRepository.deleteAll();
        attemptRepository.deleteAll();
        optionRepository.deleteAll();
        questionRepository.deleteAll();
        assessmentTestRepository.deleteAll();
        careerSkillRepository.deleteAll();
        cvDocumentRepository.deleteAll();
        linkedInProfileRepository.deleteAll();
        studentProfileRepository.deleteAll();
        careerRepository.deleteAll();
        skillRepository.deleteAll();
    }
}
