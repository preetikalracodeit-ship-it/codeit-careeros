package com.codeit.careeros.repository;

import com.codeit.careeros.entity.StudentProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface StudentProfileRepository extends JpaRepository<StudentProfile, Long>,
        JpaSpecificationExecutor<StudentProfile> {

    Optional<StudentProfile> findByUserId(Long userId);

    Optional<StudentProfile> findByStudentId(String studentId);

    boolean existsByTargetCareerId(Long targetCareerId);
}
