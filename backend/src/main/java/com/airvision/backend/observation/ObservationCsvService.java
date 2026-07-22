package com.airvision.backend.observation;

import com.airvision.backend.common.KstTimes;
import com.airvision.backend.observation.dto.CsvUploadResult;
import com.airvision.backend.observation.dto.ObservationRequest;
import com.airvision.backend.site.ObservationSite;
import com.airvision.backend.site.ObservationSiteRepository;
import jakarta.validation.Validator;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * 관측값 CSV 일괄 업로드.
 * 헤더(필수): site_id, observed_at — 나머지 컬럼(pm10, pm25, temperature, humidity,
 * wind_speed, wind_direction)은 선택이며 순서는 자유다.
 * observed_at은 ISO-8601(오프셋 포함) 또는 타임존 없는 시각(KST 해석)을 허용한다.
 * 유효한 행은 저장하고, (관측소, 시각) 중복은 건너뛰며, 오류 행은 사유와 함께 보고한다.
 */
@Service
public class ObservationCsvService {

    static final int MAX_ROWS = 10_000;
    static final int MAX_ERRORS = 20;

    private static final Set<String> ALLOWED_COLUMNS = Set.of(
            "site_id", "observed_at", "pm10", "pm25",
            "temperature", "humidity", "wind_speed", "wind_direction");

    private final ObservationRepository observationRepository;
    private final ObservationSiteRepository siteRepository;
    private final Validator validator;

    public ObservationCsvService(ObservationRepository observationRepository,
                                 ObservationSiteRepository siteRepository,
                                 Validator validator) {
        this.observationRepository = observationRepository;
        this.siteRepository = siteRepository;
        this.validator = validator;
    }

    @Transactional
    public CsvUploadResult upload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("CSV 파일이 비어 있습니다");
        }
        List<String> lines = readLines(file);
        if (lines.isEmpty()) {
            throw new IllegalArgumentException("CSV 파일이 비어 있습니다");
        }
        Map<String, Integer> header = parseHeader(lines.get(0));

        List<CsvUploadResult.RowError> errors = new ArrayList<>();
        int failed = 0;
        int totalRows = 0;
        // 파싱·검증을 통과한 행 (파일 행 번호 순서 유지)
        record ParsedRow(int line, ObservationRequest request) {
        }
        List<ParsedRow> parsed = new ArrayList<>();

        for (int i = 1; i < lines.size(); i++) {
            String line = lines.get(i);
            if (line.isBlank()) {
                continue;
            }
            totalRows++;
            if (totalRows > MAX_ROWS) {
                throw new IllegalArgumentException(
                        "데이터 행이 최대 %d건을 초과합니다. 파일을 나눠 업로드하세요".formatted(MAX_ROWS));
            }
            int lineNo = i + 1;
            try {
                parsed.add(new ParsedRow(lineNo, parseRow(line, header)));
            } catch (IllegalArgumentException e) {
                failed++;
                if (errors.size() < MAX_ERRORS) {
                    errors.add(new CsvUploadResult.RowError(lineNo, e.getMessage()));
                }
            }
        }
        if (totalRows == 0) {
            throw new IllegalArgumentException("CSV에 데이터 행이 없습니다 (헤더만 존재)");
        }

        // 관측소 일괄 조회 (행마다 조회하지 않음)
        Set<Long> siteIds = parsed.stream()
                .map(r -> r.request().siteId())
                .collect(Collectors.toSet());
        Map<Long, ObservationSite> sites = siteRepository.findAllById(siteIds).stream()
                .collect(Collectors.toMap(ObservationSite::getId, Function.identity()));

        // (관측소, 시각) 기존 중복을 관측소 단위 쿼리로 일괄 확인
        Map<Long, List<Instant>> timesBySite = parsed.stream()
                .filter(r -> sites.containsKey(r.request().siteId()))
                .collect(Collectors.groupingBy(r -> r.request().siteId(),
                        LinkedHashMap::new,
                        Collectors.mapping(r -> r.request().observedAt(), Collectors.toList())));
        Map<Long, Set<Instant>> existing = new HashMap<>();
        timesBySite.forEach((siteId, times) -> existing.put(siteId,
                new HashSet<>(observationRepository.findExistingObservedAt(siteId, times))));

        int duplicateSkipped = 0;
        Set<String> seenInFile = new HashSet<>();
        List<Observation> toSave = new ArrayList<>();
        for (ParsedRow row : parsed) {
            ObservationRequest req = row.request();
            ObservationSite site = sites.get(req.siteId());
            if (site == null) {
                failed++;
                if (errors.size() < MAX_ERRORS) {
                    errors.add(new CsvUploadResult.RowError(row.line(),
                            "존재하지 않는 관측소 ID: " + req.siteId()));
                }
                continue;
            }
            String key = req.siteId() + "@" + req.observedAt();
            if (!seenInFile.add(key) || existing.get(req.siteId()).contains(req.observedAt())) {
                duplicateSkipped++;
                continue;
            }
            toSave.add(new Observation(site, req.observedAt(), req.pm10(), req.pm25(),
                    req.temperature(), req.humidity(), req.windSpeed(), req.windDirection()));
        }
        observationRepository.saveAll(toSave);

        return new CsvUploadResult(totalRows, toSave.size(), duplicateSkipped, failed, errors);
    }

    private List<String> readLines(MultipartFile file) {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            List<String> lines = new ArrayList<>(reader.lines().toList());
            if (!lines.isEmpty() && lines.get(0).startsWith("﻿")) {
                lines.set(0, lines.get(0).substring(1));
            }
            return lines;
        } catch (IOException e) {
            throw new IllegalArgumentException("CSV 파일을 읽지 못했습니다: " + e.getMessage());
        }
    }

    /** 헤더 행 → 컬럼명별 인덱스. 허용 목록 밖의 컬럼이나 필수 컬럼 누락은 400. */
    private Map<String, Integer> parseHeader(String headerLine) {
        String[] cells = splitCells(headerLine);
        Map<String, Integer> header = new LinkedHashMap<>();
        for (int i = 0; i < cells.length; i++) {
            String name = cells[i].toLowerCase();
            if (name.isEmpty() || !ALLOWED_COLUMNS.contains(name)) {
                throw new IllegalArgumentException(
                        "알 수 없는 CSV 컬럼: '%s'. 허용 컬럼: site_id, observed_at, pm10, pm25, temperature, humidity, wind_speed, wind_direction"
                                .formatted(cells[i]));
            }
            if (header.put(name, i) != null) {
                throw new IllegalArgumentException("CSV 컬럼이 중복되었습니다: " + name);
            }
        }
        if (!header.containsKey("site_id") || !header.containsKey("observed_at")) {
            throw new IllegalArgumentException("CSV 헤더에 site_id, observed_at 컬럼이 필요합니다");
        }
        return header;
    }

    private ObservationRequest parseRow(String line, Map<String, Integer> header) {
        String[] cells = splitCells(line);
        if (cells.length != header.size()) {
            throw new IllegalArgumentException(
                    "컬럼 수가 헤더와 다릅니다 (헤더 %d개, 행 %d개)".formatted(header.size(), cells.length));
        }
        Long siteId = parseLong(cell(cells, header, "site_id"), "site_id");
        Instant observedAt = parseObservedAt(cell(cells, header, "observed_at"));
        ObservationRequest request = new ObservationRequest(siteId, observedAt,
                parseDouble(cell(cells, header, "pm10"), "pm10"),
                parseDouble(cell(cells, header, "pm25"), "pm25"),
                parseDouble(cell(cells, header, "temperature"), "temperature"),
                parseDouble(cell(cells, header, "humidity"), "humidity"),
                parseDouble(cell(cells, header, "wind_speed"), "wind_speed"),
                parseDouble(cell(cells, header, "wind_direction"), "wind_direction"));
        var violations = validator.validate(request);
        if (!violations.isEmpty()) {
            throw new IllegalArgumentException(violations.stream()
                    .map(v -> v.getMessage())
                    .sorted()
                    .collect(Collectors.joining(", ")));
        }
        return request;
    }

    /** 단순 콤마 분리 (값에 콤마 없음 전제 — 숫자·시각 컬럼만 존재). 둘러싼 따옴표는 제거. */
    private String[] splitCells(String line) {
        String[] cells = line.split(",", -1);
        for (int i = 0; i < cells.length; i++) {
            String cell = cells[i].trim();
            if (cell.length() >= 2 && cell.startsWith("\"") && cell.endsWith("\"")) {
                cell = cell.substring(1, cell.length() - 1).trim();
            }
            cells[i] = cell;
        }
        return cells;
    }

    private String cell(String[] cells, Map<String, Integer> header, String column) {
        Integer idx = header.get(column);
        return idx == null ? "" : cells[idx];
    }

    private Long parseLong(String text, String column) {
        if (text.isEmpty()) {
            return null;
        }
        try {
            return Long.parseLong(text);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("%s 값이 정수가 아닙니다: '%s'".formatted(column, text));
        }
    }

    private Double parseDouble(String text, String column) {
        if (text.isEmpty()) {
            return null;
        }
        try {
            return Double.parseDouble(text);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("%s 값이 숫자가 아닙니다: '%s'".formatted(column, text));
        }
    }

    /**
     * 관측 시각 파싱. ① ISO-8601 오프셋 포함(2026-07-22T10:00:00Z, +09:00) →
     * ② 타임존 없는 ISO(2026-07-22T10:00) → KST 해석 → ③ "yyyy-MM-dd HH:mm"(KST, 24:00 허용).
     */
    private Instant parseObservedAt(String text) {
        if (text.isEmpty()) {
            throw new IllegalArgumentException("observed_at 값이 비어 있습니다");
        }
        try {
            return OffsetDateTime.parse(text).toInstant();
        } catch (DateTimeParseException ignored) {
            // 다음 형식 시도
        }
        try {
            return LocalDateTime.parse(text).atZone(KstTimes.KST).toInstant();
        } catch (DateTimeParseException ignored) {
            // 다음 형식 시도
        }
        Instant parsed = KstTimes.parseDataTime(text);
        if (parsed == null) {
            throw new IllegalArgumentException(
                    "observed_at 형식이 올바르지 않습니다: '%s' (예: 2026-07-22T10:00:00Z 또는 2026-07-22 10:00)"
                            .formatted(text));
        }
        return parsed;
    }
}
