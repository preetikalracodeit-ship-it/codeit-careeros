package com.codeit.careeros.college.service;

import com.codeit.careeros.college.dto.ImportDtos;
import com.codeit.careeros.college.dto.StudentDtos;
import com.codeit.careeros.college.entity.AcademicYear;
import com.codeit.careeros.college.entity.Batch;
import com.codeit.careeros.college.entity.CsvImportJob;
import com.codeit.careeros.college.entity.CsvImportRow;
import com.codeit.careeros.college.entity.Department;
import com.codeit.careeros.college.entity.Institution;
import com.codeit.careeros.college.entity.Program;
import com.codeit.careeros.college.entity.Section;
import com.codeit.careeros.college.enums.ImportJobStatus;
import com.codeit.careeros.college.enums.ImportRowStatus;
import com.codeit.careeros.college.repository.AcademicYearRepository;
import com.codeit.careeros.college.repository.BatchRepository;
import com.codeit.careeros.college.repository.CsvImportJobRepository;
import com.codeit.careeros.college.repository.CsvImportRowRepository;
import com.codeit.careeros.college.repository.DepartmentRepository;
import com.codeit.careeros.college.repository.InstitutionRepository;
import com.codeit.careeros.college.repository.ProgramRepository;
import com.codeit.careeros.college.repository.SectionRepository;
import com.codeit.careeros.college.repository.StudentEnrollmentRepository;
import com.codeit.careeros.common.enums.Role;
import com.codeit.careeros.entity.User;
import com.codeit.careeros.exception.BusinessException;
import com.codeit.careeros.repository.StudentProfileRepository;
import com.codeit.careeros.repository.UserRepository;
import com.codeit.careeros.security.TokenHash;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Student CSV preview/commit and export.
 *
 * <p>Import is two-step: preview writes short-lived staging rows only; commit
 * processes each READY row in its own transaction so partial success is
 * possible. Staging rows (which contain PII) are deleted immediately after the
 * commit response is produced. Exports are capped, formula-neutralised and
 * never include CV contents.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StudentCsvService {

    private static final long MAX_FILE_BYTES = 2L * 1024 * 1024;
    private static final int MAX_ROWS = 1000;
    private static final int MAX_EXPORT_ROWS = 10_000;
    private static final int PREVIEW_TTL_MINUTES = 30;
    private static final int DUPLICATE_WINDOW_HOURS = 24;

    /**
     * Preview rows contain PII. A preview that is never committed must not
     * leave those rows in the database indefinitely. The grace period covers
     * an in-flight commit; expired previews are rejected before processing.
     */
    @Scheduled(
            fixedDelayString = "${app.college.csv-preview-cleanup-ms:900000}",
            initialDelayString = "${app.college.csv-preview-cleanup-initial-ms:60000}")
    @Transactional
    public void purgeExpiredPreviews() {
        Instant cutoff = Instant.now().minus(PREVIEW_TTL_MINUTES, ChronoUnit.MINUTES);
        for (CsvImportJob job : jobRepository.findByStatusAndCreatedAtBefore(ImportJobStatus.PREVIEW, cutoff)) {
            rowRepository.deleteByJobId(job.getId());
            jobRepository.delete(job);
        }
    }

    private static final List<String> EXPORT_HEADERS_STAFF = List.of(
            "Student ID", "Roll Number", "Full Name",
            "Department", "Program", "Batch", "Section", "Academic Year",
            "Status", "Target Career", "Readiness %", "Assessment Completed");

    private final CsvImportJobRepository jobRepository;
    private final CsvImportRowRepository rowRepository;
    private final CsvImportRowProcessor rowProcessor;
    private final InstitutionRepository institutionRepository;
    private final DepartmentRepository departmentRepository;
    private final ProgramRepository programRepository;
    private final BatchRepository batchRepository;
    private final SectionRepository sectionRepository;
    private final AcademicYearRepository academicYearRepository;
    private final UserRepository userRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final StudentEnrollmentRepository enrollmentRepository;
    private final StudentService studentService;
    private final AuditService auditService;

    // ---- export ----

    @Transactional(readOnly = true)
    public CsvExport export(CollegeScope scope, StudentDtos.StudentFilter filter) {
        scope.requireExport();
        List<com.codeit.careeros.college.entity.StudentEnrollment> enrollments =
                studentService.allInScope(scope, filter);
        if (enrollments.size() > MAX_EXPORT_ROWS) {
            throw BusinessException.badRequest(
                    "This export would contain " + enrollments.size()
                            + " rows; narrow the filters to 10,000 rows or fewer");
        }

        // Contact fields require an approved institutional policy and are not
        // included in the shared role-based export.
        List<String> headers = EXPORT_HEADERS_STAFF;
        StringBuilder csv = new StringBuilder();
        appendRow(csv, headers);

        for (var enrollment : enrollments) {
            StudentDtos.CollegeStudentListItem item = studentService.toListItem(enrollment, scope, filter);
            List<String> values = new ArrayList<>();
            values.add(item.studentId());
            values.add(item.rollNumber());
            values.add(item.fullName());
            values.add(item.departmentName());
            values.add(item.programName());
            values.add(item.batchLabel());
            values.add(item.sectionName());
            values.add(item.academicYearLabel());
            values.add(item.status() == null ? null : item.status().name());
            values.add(item.targetCareerName());
            values.add(item.readinessPercent() == null ? null : item.readinessPercent() + "%");
            values.add(item.assessmentCompleted() ? "Yes" : "No");
            appendRow(csv, values);
        }

        byte[] bytes = withBom(csv.toString());
        auditService.success("STUDENT_EXPORT_CSV", "STUDENT_EXPORT", null,
                scope.institutionId(), scope, "rows=" + enrollments.size());
        return new CsvExport(bytes, "careeros-students-" + Instant.now().toEpochMilli() + ".csv",
                enrollments.size());
    }

    // ---- import preview ----

    @Transactional
    public ImportDtos.ImportPreviewResponse preview(CollegeScope scope, MultipartFile file) {
        scope.requireImport();
        if (file == null || file.isEmpty()) {
            throw BusinessException.badRequest("A CSV file is required");
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw BusinessException.badRequest("CSV files are limited to 2 MB");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw BusinessException.badRequest("Could not read the CSV file");
        }
        String hash = TokenHash.sha256(new String(bytes, StandardCharsets.ISO_8859_1));
        jobRepository.findFirstByInstitutionIdAndFileHashAndStatusAndCreatedAtAfterOrderByCreatedAtDesc(
                        scope.institutionId(), hash, ImportJobStatus.COMMITTED,
                        Instant.now().minus(DUPLICATE_WINDOW_HOURS, ChronoUnit.HOURS))
                .ifPresent(existing -> {
                    throw BusinessException.conflict(
                            "This exact file was already imported in the last 24 hours");
                });

        String content = new String(bytes, StandardCharsets.UTF_8);
        List<List<String>> parsed = parseCsv(content);
        if (parsed.isEmpty()) {
            throw BusinessException.badRequest("The CSV file is empty");
        }
        Map<String, Integer> header = headerIndex(parsed.get(0));
        List<List<String>> dataRows = parsed.subList(1, parsed.size());
        if (dataRows.size() > MAX_ROWS) {
            throw BusinessException.badRequest("A single import is limited to " + MAX_ROWS + " rows");
        }

        Institution institution = institutionRepository.findById(scope.institutionId())
                .orElseThrow(() -> BusinessException.notFound("Institution not found"));
        CsvImportJob job = CsvImportJob.builder()
                .institution(institution)
                .createdBy(userRepository.getReferenceById(scope.userId()))
                .status(ImportJobStatus.PREVIEW)
                .originalFilename(truncate(file.getOriginalFilename(), 255))
                .fileHash(hash)
                .totalRows(dataRows.size())
                .build();
        job = jobRepository.save(job);

        Set<String> seenEmails = new HashSet<>();
        Set<String> seenRolls = new HashSet<>();
        List<CsvImportRow> rows = new ArrayList<>();
        int ready = 0;
        int skipped = 0;
        int rejected = 0;

        for (int i = 0; i < dataRows.size(); i++) {
            int rowNumber = i + 2; // 1-based including the header
            List<String> values = dataRows.get(i);
            CsvImportRow row = CsvImportRow.builder()
                    .job(job)
                    .rowNumber(rowNumber)
                    .fullName(value(header, values, "full_name"))
                    .email(value(header, values, "email"))
                    .mobile(value(header, values, "mobile"))
                    .rollNumber(value(header, values, "roll_number"))
                    .departmentCode(value(header, values, "department_code"))
                    .programCode(value(header, values, "program_code"))
                    .batchLabel(value(header, values, "batch_label"))
                    .sectionName(value(header, values, "section_name"))
                    .academicYearLabel(value(header, values, "academic_year_label"))
                    .status(ImportRowStatus.READY)
                    .build();
            try {
                validatePreviewRow(scope.institutionId(), row, seenEmails, seenRolls);
            } catch (BusinessException e) {
                reject(row, e.getMessage());
            }
            switch (row.getStatus()) {
                case READY -> ready++;
                case SKIPPED -> skipped++;
                case REJECTED -> rejected++;
                default -> {
                }
            }
            rows.add(row);
        }
        rowRepository.saveAll(rows);
        job.setSkippedRows(skipped);
        job.setRejectedRows(rejected);
        job = jobRepository.save(job);

        auditService.success("STUDENT_IMPORT_PREVIEW", "CSV_IMPORT_JOB",
                String.valueOf(job.getId()), scope.institutionId(), scope,
                "rows=" + dataRows.size() + ",ready=" + ready + ",skipped=" + skipped + ",rejected=" + rejected);

        return new ImportDtos.ImportPreviewResponse(
                job.getId(),
                job.getStatus(),
                dataRows.size(),
                ready,
                skipped,
                rejected,
                rows.stream().map(StudentCsvService::toOutcome).toList(),
                errorCsv(rows),
                job.getCreatedAt().plus(PREVIEW_TTL_MINUTES, ChronoUnit.MINUTES));
    }

    private void validatePreviewRow(Long institutionId, CsvImportRow row,
                                    Set<String> seenEmails, Set<String> seenRolls) {
        String email = normalizeEmail(row.getEmail());
        String roll = require(row.getRollNumber(), "Roll number", 40);
        String fullName = require(row.getFullName(), "Full name", 120);
        row.setEmail(email);
        row.setRollNumber(roll);
        row.setFullName(fullName);

        if (!seenEmails.add(email)) {
            reject(row, "Duplicate email within the file");
            return;
        }
        if (!seenRolls.add(roll.toUpperCase(Locale.ROOT))) {
            reject(row, "Duplicate roll number within the file");
            return;
        }

        Department department = departmentRepository
                .findByInstitutionIdAndCodeIgnoreCase(institutionId,
                        require(row.getDepartmentCode(), "Department code", 40))
                .orElse(null);
        if (department == null) {
            reject(row, "Unknown department code");
            return;
        }
        Program program = programRepository
                .findByInstitutionIdAndCodeIgnoreCase(institutionId,
                        require(row.getProgramCode(), "Program code", 40))
                .orElse(null);
        if (program == null) {
            reject(row, "Unknown program code");
            return;
        }
        if (!program.getDepartment().getId().equals(department.getId())) {
            reject(row, "Program does not belong to the selected department");
            return;
        }
        Batch batch = batchRepository
                .findByProgramIdAndLabelIgnoreCase(program.getId(),
                        require(row.getBatchLabel(), "Batch label", 40))
                .orElse(null);
        if (batch == null) {
            reject(row, "Unknown batch for the selected program");
            return;
        }
        if (row.getAcademicYearLabel() != null && !row.getAcademicYearLabel().isBlank()) {
            AcademicYear year = academicYearRepository
                    .findByInstitutionIdAndLabelIgnoreCase(institutionId, row.getAcademicYearLabel().trim())
                    .orElse(null);
            if (year == null) {
                reject(row, "Unknown academic year");
                return;
            }
            if (!year.getId().equals(batch.getAcademicYear().getId())) {
                reject(row, "Batch does not belong to the selected academic year");
                return;
            }
        }
        if (row.getSectionName() != null && !row.getSectionName().isBlank()) {
            Section section = sectionRepository
                    .findByBatchIdAndNameIgnoreCase(batch.getId(), row.getSectionName().trim())
                    .orElse(null);
            if (section == null) {
                reject(row, "Unknown section for the selected batch");
                return;
            }
        }
        if (row.getMobile() != null && !row.getMobile().isBlank()
                && !row.getMobile().trim().matches("^[0-9+\\- ]{6,20}$")) {
            reject(row, "Mobile number is not valid");
            return;
        }

        User existing = userRepository.findByEmail(email).orElse(null);
        var enrollmentWithRoll = enrollmentRepository
                .findByInstitutionIdAndRollNumberIgnoreCase(institutionId, roll).orElse(null);
        if (enrollmentWithRoll != null) {
            if (existing != null && enrollmentWithRoll.getStudentProfile().getUser().getId()
                    .equals(existing.getId())) {
                row.setStatus(ImportRowStatus.SKIPPED);
                row.setMessage("Student is already enrolled in the institution");
            } else {
                reject(row, "Roll number is already assigned in this institution");
            }
            return;
        }
        if (existing != null) {
            if (existing.getRole() != Role.STUDENT) {
                reject(row, "Email belongs to a staff or administrator account");
                return;
            }
            var profile = studentProfileRepository.findByUserId(existing.getId()).orElse(null);
            if (profile != null) {
                if (enrollmentRepository.existsByStudentProfileIdAndInstitutionId(
                        profile.getId(), institutionId)) {
                    row.setStatus(ImportRowStatus.SKIPPED);
                    row.setMessage("Student is already enrolled in the institution");
                } else if (enrollmentRepository.existsByStudentProfileId(profile.getId())) {
                    reject(row, "Student already belongs to another institution");
                }
            }
        }
    }

    // ---- import commit ----

    @Transactional
    public ImportDtos.ImportCommitResponse commit(CollegeScope scope, Long jobId) {
        scope.requireImport();
        CsvImportJob job = jobRepository.findByIdAndInstitutionId(jobId, scope.institutionId())
                .orElseThrow(() -> BusinessException.notFound("Import job not found"));
        if (!job.getCreatedBy().getId().equals(scope.userId())) {
            throw BusinessException.forbidden("Only the administrator who previewed this file can commit it");
        }
        if (job.getStatus() != ImportJobStatus.PREVIEW) {
            throw BusinessException.conflict("This import job is not awaiting commit");
        }
        if (job.getCreatedAt().plus(PREVIEW_TTL_MINUTES, ChronoUnit.MINUTES).isBefore(Instant.now())) {
            throw BusinessException.badRequest("This import preview has expired; upload the file again");
        }

        List<CsvImportRow> staged = rowRepository.findByJobIdOrderByRowNumberAsc(jobId);
        List<CsvImportRow> outcomes = new ArrayList<>();
        int created = 0;
        int linked = 0;
        int skipped = 0;
        int rejected = 0;

        for (CsvImportRow row : staged) {
            if (row.getStatus() != ImportRowStatus.READY) {
                outcomes.add(row);
                if (row.getStatus() == ImportRowStatus.SKIPPED) {
                    skipped++;
                } else if (row.getStatus() == ImportRowStatus.REJECTED) {
                    rejected++;
                }
                continue;
            }
            CsvImportRow processed;
            try {
                processed = rowProcessor.process(row.getId(), jobId, scope.institutionId());
            } catch (RuntimeException e) {
                log.error("CSV row {} failed during import job {}", row.getRowNumber(), jobId, e);
                rowProcessor.markFailed(row.getId(), jobId, "Could not import this row");
                processed = CsvImportRow.builder()
                        .id(row.getId())
                        .job(job)
                        .rowNumber(row.getRowNumber())
                        .rollNumber(row.getRollNumber())
                        .email(row.getEmail())
                        .status(ImportRowStatus.REJECTED)
                        .message("Could not import this row")
                        .build();
            }
            outcomes.add(processed);
            switch (processed.getStatus()) {
                case CREATED -> created++;
                case LINKED -> linked++;
                case SKIPPED -> skipped++;
                case REJECTED -> rejected++;
                default -> {
                }
            }
        }

        job.setCreatedRows(created);
        job.setLinkedRows(linked);
        job.setSkippedRows(skipped);
        job.setRejectedRows(rejected);
        job.setStatus(ImportJobStatus.COMMITTED);
        job.setCompletedAt(Instant.now());
        job = jobRepository.save(job);

        ImportDtos.ImportCommitResponse response = new ImportDtos.ImportCommitResponse(
                job.getId(),
                job.getStatus(),
                job.getTotalRows(),
                created,
                linked,
                skipped,
                rejected,
                outcomes.stream().map(StudentCsvService::toOutcome).toList(),
                errorCsv(outcomes),
                job.getCompletedAt());

        // Minimise PII retention: the staging rows are no longer needed once
        // the outcome has been produced. The job keeps counts and a hash only.
        rowRepository.deleteByJobId(jobId);

        auditService.success("STUDENT_IMPORT_COMMIT", "CSV_IMPORT_JOB",
                String.valueOf(jobId), scope.institutionId(), scope,
                "created=" + created + ",linked=" + linked + ",skipped=" + skipped
                        + ",rejected=" + rejected);
        return response;
    }

    // ---- CSV parsing / formatting ----

    static List<List<String>> parseCsv(String content) {
        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false;
        String text = content == null ? "" : content;
        if (text.startsWith("\uFEFF")) {
            text = text.substring(1);
        }
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (quoted) {
                if (c == '"') {
                    if (i + 1 < text.length() && text.charAt(i + 1) == '"') {
                        cell.append('"');
                        i++;
                    } else {
                        quoted = false;
                    }
                } else {
                    cell.append(c);
                }
            } else if (c == '"') {
                quoted = true;
            } else if (c == ',') {
                row.add(cell.toString());
                cell.setLength(0);
            } else if (c == '\n' || c == '\r') {
                if (c == '\r' && i + 1 < text.length() && text.charAt(i + 1) == '\n') {
                    i++;
                }
                row.add(cell.toString());
                cell.setLength(0);
                if (!(row.size() == 1 && row.get(0).isEmpty())) {
                    rows.add(row);
                }
                row = new ArrayList<>();
            } else {
                cell.append(c);
            }
        }
        row.add(cell.toString());
        if (!(row.size() == 1 && row.get(0).isEmpty())) {
            rows.add(row);
        }
        return rows;
    }

    private static Map<String, Integer> headerIndex(List<String> headerRow) {
        Map<String, Integer> index = new HashMap<>();
        for (int i = 0; i < headerRow.size(); i++) {
            String key = headerRow.get(i) == null ? "" : headerRow.get(i).trim()
                    .toLowerCase(Locale.ROOT).replace(' ', '_');
            index.put(key, i);
        }
        requireHeader(index, "full_name");
        requireHeader(index, "email");
        requireHeader(index, "roll_number");
        requireHeader(index, "department_code");
        requireHeader(index, "program_code");
        requireHeader(index, "batch_label");
        return index;
    }

    private static void requireHeader(Map<String, Integer> index, String name) {
        if (!index.containsKey(name)) {
            throw BusinessException.badRequest("Missing required CSV column: " + name);
        }
    }

    private static String value(Map<String, Integer> header, List<String> values, String name) {
        Integer position = header.get(name);
        if (position == null || position >= values.size()) {
            return null;
        }
        String value = values.get(position);
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static void appendRow(StringBuilder csv, List<String> values) {
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                csv.append(',');
            }
            csv.append(escape(values.get(i)));
        }
        csv.append("\r\n");
    }

    public static String escape(String raw) {
        String value = raw == null ? "" : raw;
        // Spreadsheet formula injection neutralisation. A leading apostrophe
        // makes Excel/Sheets treat the cell as text, not a formula.
        if (!value.isEmpty() && "=+-@\t\r\n".indexOf(value.charAt(0)) >= 0) {
            value = "'" + value;
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n") || value.contains("\r")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private static byte[] withBom(String csv) {
        byte[] body = csv.getBytes(StandardCharsets.UTF_8);
        byte[] withBom = new byte[body.length + 3];
        withBom[0] = (byte) 0xEF;
        withBom[1] = (byte) 0xBB;
        withBom[2] = (byte) 0xBF;
        System.arraycopy(body, 0, withBom, 3, body.length);
        return withBom;
    }

    private static String errorCsv(List<CsvImportRow> rows) {
        StringBuilder csv = new StringBuilder();
        appendRow(csv, List.of("row_number", "status", "message", "roll_number", "email"));
        rows.stream()
                .filter(row -> row.getStatus() == ImportRowStatus.REJECTED)
                .forEach(row -> appendRow(csv, List.of(
                        String.valueOf(row.getRowNumber()),
                        row.getStatus().name(),
                        row.getMessage(),
                        row.getRollNumber(),
                        row.getEmail())));
        return csv.toString();
    }

    private static ImportDtos.ImportRowOutcome toOutcome(CsvImportRow row) {
        return new ImportDtos.ImportRowOutcome(
                row.getRowNumber(), row.getStatus(), row.getMessage(),
                row.getRollNumber(), row.getEmail());
    }

    private static void reject(CsvImportRow row, String message) {
        row.setStatus(ImportRowStatus.REJECTED);
        row.setMessage(truncate(message, 500));
    }

    private static String require(String value, String label, int max) {
        String cleaned = value == null ? "" : value.trim();
        if (cleaned.isEmpty()) {
            throw BusinessException.badRequest(label + " is required");
        }
        if (cleaned.length() > max) {
            throw BusinessException.badRequest(label + " must be at most " + max + " characters");
        }
        return cleaned;
    }

    private static String normalizeEmail(String value) {
        String email = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        if (email.length() > 190 || !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw BusinessException.badRequest("Email is not valid");
        }
        return email;
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }

    public record CsvExport(byte[] bytes, String filename, int rows) {
    }
}
