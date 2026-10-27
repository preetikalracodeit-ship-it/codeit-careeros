package com.codeit.careeros.admin;

import com.codeit.careeros.common.PageResponse;
import com.codeit.careeros.dto.student.StudentProfileResponse;
import com.codeit.careeros.entity.StudentProfile;
import com.codeit.careeros.mapper.StudentProfileMapper;
import com.codeit.careeros.repository.StudentProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import jakarta.persistence.criteria.JoinType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminStudentService {

    private final StudentProfileRepository studentProfileRepository;

    @Transactional(readOnly = true)
    public PageResponse<StudentProfileResponse> listStudents(int page, int size, String search) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<StudentProfile> result = studentProfileRepository.findAll(searchSpecification(search), pageable);
        return new PageResponse<>(
                result.getContent().stream().map(StudentProfileMapper::toResponse).toList(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages());
    }

    private static Specification<StudentProfile> searchSpecification(String search) {
        if (search == null || search.isBlank()) return Specification.where(null);
        String escaped = search.trim().toLowerCase(java.util.Locale.ROOT)
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        String pattern = "%" + escaped + "%";
        return (root, query, cb) -> {
            var user = root.join("user", JoinType.INNER);
            var career = root.join("targetCareer", JoinType.LEFT);
            query.distinct(true);
            return cb.or(
                    cb.like(cb.lower(root.get("fullName")), pattern, '\\'),
                    cb.like(cb.lower(root.get("studentId")), pattern, '\\'),
                    cb.like(cb.lower(root.get("college")), pattern, '\\'),
                    cb.like(cb.lower(root.get("branch")), pattern, '\\'),
                    cb.like(cb.lower(user.get("email")), pattern, '\\'),
                    cb.like(cb.lower(root.get("mobile")), pattern, '\\'),
                    cb.like(cb.lower(career.get("name")), pattern, '\\'));
        };
    }

    @Transactional(readOnly = true)
    public long countStudents() {
        return studentProfileRepository.count();
    }
}
