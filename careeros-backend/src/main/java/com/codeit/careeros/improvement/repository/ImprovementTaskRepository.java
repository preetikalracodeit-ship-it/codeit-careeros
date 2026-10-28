package com.codeit.careeros.improvement.repository;

import com.codeit.careeros.improvement.entity.ImprovementTask;
import com.codeit.careeros.improvement.enums.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ImprovementTaskRepository extends JpaRepository<ImprovementTask, Long> {

    List<ImprovementTask> findByPlanIdOrderByTargetDateAscIdAsc(Long planId);

    Optional<ImprovementTask> findByIdAndPlanId(Long id, Long planId);

    long countByPlanId(Long planId);

    long countByPlanIdAndStatus(Long planId, TaskStatus status);

    List<ImprovementTask> findByPlanIdAndStatusIn(Long planId, List<TaskStatus> statuses);

    long countByPlanIdAndTargetDateBeforeAndStatusIn(Long planId, LocalDate date,
                                                     List<TaskStatus> statuses);
}
