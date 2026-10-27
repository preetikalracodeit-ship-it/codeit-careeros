package com.codeit.careeros.college.service;

import com.codeit.careeros.college.entity.AcademicYear;
import com.codeit.careeros.college.entity.Batch;
import com.codeit.careeros.college.entity.Department;
import com.codeit.careeros.college.entity.Program;
import com.codeit.careeros.college.entity.Section;
import com.codeit.careeros.college.enums.ScopeType;
import com.codeit.careeros.college.repository.AcademicYearRepository;
import com.codeit.careeros.college.repository.BatchRepository;
import com.codeit.careeros.college.repository.DepartmentRepository;
import com.codeit.careeros.college.repository.ProgramRepository;
import com.codeit.careeros.college.repository.SectionRepository;
import com.codeit.careeros.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Validates that a requested academic scope actually belongs to the actor's
 * institution and resolves a human-readable scope label. Foreign identifiers
 * are reported as 404 so they cannot be used to probe another tenant.
 */
@Service
@RequiredArgsConstructor
public class AcademicScopeService {

    private final DepartmentRepository departmentRepository;
    private final ProgramRepository programRepository;
    private final BatchRepository batchRepository;
    private final SectionRepository sectionRepository;
    private final AcademicYearRepository academicYearRepository;

    @Transactional(readOnly = true)
    public void validateScope(Long institutionId, ScopeType scopeType, Long scopeId) {
        if (scopeType == ScopeType.INSTITUTION) {
            if (scopeId != null) {
                throw BusinessException.badRequest("Institution-wide scope must not include a scope id");
            }
            return;
        }
        if (scopeId == null) {
            throw BusinessException.badRequest("A scope id is required for " + scopeType);
        }
        switch (scopeType) {
            case DEPARTMENT -> departmentRepository.findByIdAndInstitutionId(scopeId, institutionId)
                    .orElseThrow(() -> BusinessException.notFound("Department not found in this institution"));
            case PROGRAM -> programRepository.findByIdAndInstitutionId(scopeId, institutionId)
                    .orElseThrow(() -> BusinessException.notFound("Program not found in this institution"));
            case BATCH -> {
                Batch batch = batchRepository.findById(scopeId)
                        .orElseThrow(() -> BusinessException.notFound("Batch not found in this institution"));
                if (!batch.getProgram().getInstitution().getId().equals(institutionId)) {
                    throw BusinessException.notFound("Batch not found in this institution");
                }
            }
            case SECTION -> {
                Section section = sectionRepository.findById(scopeId)
                        .orElseThrow(() -> BusinessException.notFound("Section not found in this institution"));
                if (!section.getBatch().getProgram().getInstitution().getId().equals(institutionId)) {
                    throw BusinessException.notFound("Section not found in this institution");
                }
            }
            default -> throw BusinessException.badRequest("Unsupported scope type");
        }
    }

    @Transactional(readOnly = true)
    public String label(Long institutionId, ScopeType scopeType, Long scopeId) {
        if (scopeType == null) {
            return "—";
        }
        return switch (scopeType) {
            case INSTITUTION -> "Whole institution";
            case DEPARTMENT -> departmentRepository.findByIdAndInstitutionId(scopeId, institutionId)
                    .map(Department::getName).orElse("Department #" + scopeId);
            case PROGRAM -> programRepository.findByIdAndInstitutionId(scopeId, institutionId)
                    .map(Program::getName).orElse("Program #" + scopeId);
            case BATCH -> batchRepository.findById(scopeId)
                    .filter(b -> b.getProgram().getInstitution().getId().equals(institutionId))
                    .map(Batch::getLabel).orElse("Batch #" + scopeId);
            case SECTION -> sectionRepository.findById(scopeId)
                    .filter(s -> s.getBatch().getProgram().getInstitution().getId().equals(institutionId))
                    .map(Section::getName).orElse("Section #" + scopeId);
        };
    }

    @Transactional(readOnly = true)
    public Department requireDepartment(Long institutionId, Long departmentId) {
        return departmentRepository.findByIdAndInstitutionId(departmentId, institutionId)
                .orElseThrow(() -> BusinessException.notFound("Department not found in this institution"));
    }

    @Transactional(readOnly = true)
    public Program requireProgram(Long institutionId, Long programId) {
        return programRepository.findByIdAndInstitutionId(programId, institutionId)
                .orElseThrow(() -> BusinessException.notFound("Program not found in this institution"));
    }

    @Transactional(readOnly = true)
    public Batch requireBatch(Long institutionId, Long batchId) {
        Batch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> BusinessException.notFound("Batch not found in this institution"));
        if (!batch.getProgram().getInstitution().getId().equals(institutionId)) {
            throw BusinessException.notFound("Batch not found in this institution");
        }
        return batch;
    }

    @Transactional(readOnly = true)
    public Section requireSection(Long institutionId, Long sectionId) {
        Section section = sectionRepository.findById(sectionId)
                .orElseThrow(() -> BusinessException.notFound("Section not found in this institution"));
        if (!section.getBatch().getProgram().getInstitution().getId().equals(institutionId)) {
            throw BusinessException.notFound("Section not found in this institution");
        }
        return section;
    }

    @Transactional(readOnly = true)
    public AcademicYear requireAcademicYear(Long institutionId, Long academicYearId) {
        return academicYearRepository.findByIdAndInstitutionId(academicYearId, institutionId)
                .orElseThrow(() -> BusinessException.notFound("Academic year not found in this institution"));
    }
}
