package com.codeit.careeros.college.repository;

import com.codeit.careeros.college.entity.StudentEnrollment;
import com.codeit.careeros.college.enums.EnrollmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface StudentEnrollmentRepository
        extends JpaRepository<StudentEnrollment, Long>, JpaSpecificationExecutor<StudentEnrollment> {

    Optional<StudentEnrollment> findByStudentProfileId(Long studentProfileId);

    Optional<StudentEnrollment> findByStudentProfileIdAndStatus(Long studentProfileId, EnrollmentStatus status);

    Optional<StudentEnrollment> findByIdAndInstitutionId(Long id, Long institutionId);

    Optional<StudentEnrollment> findByInstitutionIdAndRollNumberIgnoreCase(Long institutionId, String rollNumber);

    boolean existsByStudentProfileIdAndInstitutionId(Long studentProfileId, Long institutionId);

    boolean existsByStudentProfileId(Long studentProfileId);

    long countByInstitutionIdAndStatus(Long institutionId, EnrollmentStatus status);

    @Query("""
            select e from StudentEnrollment e
            join fetch e.studentProfile p
            join fetch p.user u
            where e.institution.id = :institutionId
            """)
    List<StudentEnrollment> findAllForInstitutionWithProfiles(@Param("institutionId") Long institutionId);
}
