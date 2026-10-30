package com.codeit.careeros.cv;

import com.codeit.careeros.service.CvAnalysisService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for CV skill-name matching. CVs write the same skill many ways
 * ("HTML5, CSS3", "HTML / CSS", "SpringBoot", "Jenkins" for "CI/CD
 * (Jenkins)"), so matching is recall-friendly — but whole-word, so
 * "JavaScript" never implies "Java" and "interaction" never implies "React".
 */
class CvSkillMatchingTest {

    private static boolean mentions(String cvText, String skillName) throws Exception {
        Method m = CvAnalysisService.class.getDeclaredMethod("mentions", String.class, String.class);
        m.setAccessible(true);
        return (boolean) m.invoke(null, norm(cvText), skillName);
    }

    private static String norm(String value) throws Exception {
        Method m = CvAnalysisService.class.getDeclaredMethod("normalize", String.class);
        m.setAccessible(true);
        return (String) m.invoke(null, value);
    }

    @ParameterizedTest
    @CsvSource({
            // The reported bug: versioned / separated frontend skills.
            "'Skills: HTML5, CSS3, JavaScript', 'HTML/CSS'",
            "'Skills: HTML 5 and CSS', 'HTML/CSS'",
            "'Skills: HTML / CSS', 'HTML/CSS'",
            "'Skills: html, css', 'HTML/CSS'",
            // Alternatives: one part suffices.
            "'Skills: Git version control', 'Git & GitHub'",
            "'Skills: GitHub repositories', 'Git & GitHub'",
            "'Skills: Jenkins pipelines', 'CI/CD (Jenkins)'",
            "'Skills: CI/CD pipelines', 'CI/CD (Jenkins)'",
            "'Skills: Prometheus and Grafana', 'Monitoring (Prometheus & Grafana)'",
            "'Skills: SOC analyst', 'Security Operations (SOC)'",
            "'Skills: Agile standups', 'Agile & Scrum'",
            "'Skills: Scrum master', 'Agile & Scrum'",
            "'Skills: ETL jobs', 'ETL & Data Pipelines'",
            "'Skills: Linux servers', 'Linux Administration'",
            "'Skills: UI/UX designer', 'UI/UX Design'",
            // Glued / versioned single skills.
            "'Built SpringBoot microservices', 'Spring Boot'",
            "'ReactNative mobile apps', 'React Native'",
            "'PowerBI dashboards', 'Power BI'",
            "'NodeJS backend services', 'Node.js'",
            "'Node.js runtime', 'Node.js'",
            "'Designed REST API contracts', 'REST APIs'",
            "'Decomposed into microservice modules', 'Microservices'",
            "'Selenium automation suite', 'Selenium WebDriver'",
            "'Postman collections for APIs', 'API Testing'",
            "'Penetration test internship', 'Penetration Testing'",
            "'Tableau dashboards', 'Data Visualization'",
            "'NLP research project', 'Natural Language Processing'",
            "'ML models in production', 'Machine Learning'",
            "'Deployed to K8s clusters', 'Kubernetes'",
            "'Postgres and MySQL databases', 'SQL'",
            "'TS strict mode everywhere', 'TypeScript'",
            "'ES6 features and JS modules', 'JavaScript'",
            "'Python automation scripts', 'Python'",
            "'Core Java multithreading', 'Java'",
            "'Amazon Web Services hosting', 'AWS'",
            "'Technical troubleshooting rota', 'Technical Troubleshooting'",
            "'Team collaboration across pods', 'Team Collaboration'",
            "'Cloud security engineer', 'Cloud Security'",
            "'Database administrator for MySQL', 'Database Administration'",
            "'React Native mobile apps', 'React Native'",
    })
    @DisplayName("Present skills are detected across real-world CV spellings")
    void presentSkills_detected(String cvText, String skillName) throws Exception {
        assertThat(mentions(cvText, skillName))
                .as("CV %s should match skill %s", cvText, skillName)
                .isTrue();
    }

    @ParameterizedTest
    @CsvSource({
            // Whole-word discipline: substrings must not match.
            "'JavaScript developer', 'Java'",
            "'Interactive dashboards with D3', 'React'",
            "'Knowledge of privacy laws', 'AWS'",
            "'Standard library design', 'Dart'",
            "'In-depth understanding of Java', 'Deep Learning'",
            "'Applying for this job application', 'Application Security'",
            "'Data entry operator', 'Data Analysis'",
            "'The rest of the project', 'REST APIs'",
            "'User manuals and guides', 'Manual Testing'",
            // Multi-token names still need their substance.
            "'CV Spring Boot and SQL', 'CV Docker'",
            "'Spring Framework basics', 'Spring Boot'",
            "'Native mobile development', 'React Native'",
            "'React frontend developer', 'React Native'",
            "'Cloud Practitioner course completed', 'Cloud Security'",
            "'Portfolio site with SQL database', 'Database Administration'",
    })
    @DisplayName("Absent skills stay missing: no substring or generic-word false positives")
    void absentSkills_notDetected(String cvText, String skillName) throws Exception {
        assertThat(mentions(cvText, skillName))
                .as("CV %s must NOT match skill %s", cvText, skillName)
                .isFalse();
    }

    @Test
    @DisplayName("Existing integration-test semantics preserved (prefix + full name)")
    void legacySemantics_preserved() throws Exception {
        String cv = "Java, CV Spring Boot, SQL, Git. Built REST APIs with Java.";
        assertThat(mentions(cv, "CV Java")).isTrue();
        assertThat(mentions(cv, "CV Spring Boot")).isTrue();
        assertThat(mentions(cv, "CV Docker")).isFalse();
    }
}
