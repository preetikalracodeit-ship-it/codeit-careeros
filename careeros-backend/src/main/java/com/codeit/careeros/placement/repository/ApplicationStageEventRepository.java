package com.codeit.careeros.placement.repository;

import com.codeit.careeros.placement.entity.ApplicationStageEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApplicationStageEventRepository extends JpaRepository<ApplicationStageEvent, Long> {

    List<ApplicationStageEvent> findByApplicationIdOrderByRecordedAtAscIdAsc(Long applicationId);
}
