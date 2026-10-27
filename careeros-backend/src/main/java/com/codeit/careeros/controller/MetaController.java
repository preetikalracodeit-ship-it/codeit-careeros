package com.codeit.careeros.controller;

import com.codeit.careeros.common.ApiResponse;
import com.codeit.careeros.common.enums.CareerCategory;
import com.codeit.careeros.common.enums.DifficultyLevel;
import com.codeit.careeros.common.enums.QuestionType;
import com.codeit.careeros.common.enums.SkillCategory;
import com.codeit.careeros.common.enums.SkillLevel;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.info.BuildProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

/** Catalog metadata (enum options) read by admin forms and student tooling. */
@Tag(name = "Metadata", description = "Enum catalogs for forms")
@RestController
@RequestMapping("/api/v1/meta")
public class MetaController {

    private final ObjectProvider<BuildProperties> buildProperties;

    @Value("${app.build.commit:unknown}")
    private String buildCommit;

    public MetaController(ObjectProvider<BuildProperties> buildProperties) {
        this.buildProperties = buildProperties;
    }

    @Operation(summary = "All catalog enum options used by forms")
    @GetMapping("/catalog")
    public ApiResponse<Map<String, Object>> catalog() {
        Map<String, Object> catalog = new LinkedHashMap<>();
        catalog.put("careerCategories", names(CareerCategory.values()));
        catalog.put("difficultyLevels", names(DifficultyLevel.values()));
        catalog.put("skillCategories", names(SkillCategory.values()));
        catalog.put("skillLevels", names(SkillLevel.values()));
        catalog.put("questionTypes", names(QuestionType.values()));
        return ApiResponse.success(catalog);
    }

    /**
     * Public, non-sensitive build identity for deployment smoke checks. It
     * deliberately exposes no environment values, paths, or configuration.
     */
    @Operation(summary = "Deployed backend build identity")
    @GetMapping("/version")
    public ApiResponse<Map<String, Object>> version() {
        BuildProperties build = buildProperties.getIfAvailable();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("service", "careeros-backend");
        data.put("version", build == null ? "unknown" : build.getVersion());
        data.put("buildTime", build == null || build.getTime() == null
                ? "unknown" : build.getTime().toString());
        data.put("commit", buildCommit == null || buildCommit.isBlank()
                ? "unknown" : buildCommit);
        return ApiResponse.success(data);
    }

    private static <T extends Enum<T>> String[] names(T[] values) {
        return Arrays.stream(values).map(Enum::name).toArray(String[]::new);
    }
}