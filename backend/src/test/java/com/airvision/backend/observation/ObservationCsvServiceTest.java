package com.airvision.backend.observation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.airvision.backend.site.ObservationSite;
import com.airvision.backend.site.ObservationSiteRepository;
import jakarta.validation.Validation;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

/** CSV 일괄 업로드의 파싱·검증·중복 처리 규칙을 확인한다 (리포지토리는 mock). */
class ObservationCsvServiceTest {

    private ObservationRepository observationRepository;
    private ObservationSiteRepository siteRepository;
    private ObservationCsvService service;

    private ObservationSite site(long id, String name) {
        ObservationSite site = new ObservationSite(name, 37.46, 126.68, null, "SENSOR", null);
        ReflectionTestUtils.setField(site, "id", id);
        return site;
    }

    private MockMultipartFile csv(String content) {
        return new MockMultipartFile("file", "observations.csv", "text/csv",
                content.getBytes(StandardCharsets.UTF_8));
    }

    @BeforeEach
    void setUp() {
        observationRepository = mock(ObservationRepository.class);
        siteRepository = mock(ObservationSiteRepository.class);
        service = new ObservationCsvService(observationRepository, siteRepository,
                Validation.buildDefaultValidatorFactory().getValidator());
        when(observationRepository.findExistingObservedAt(any(), anyCollection()))
                .thenReturn(List.of());
    }

    @Test
    void upload_validRows_insertsAllAndConvertsKst() {
        when(siteRepository.findAllById(any())).thenReturn(List.of(site(1L, "미추홀주안")));
        var result = service.upload(csv("""
                site_id,observed_at,pm10,pm25,temperature,humidity,wind_speed,wind_direction
                1,2026-07-22T01:00:00Z,40.1,25.3,24.0,60.0,2.1,180
                1,2026-07-22 11:00,,18.5,,,,
                """));

        assertThat(result.totalRows()).isEqualTo(2);
        assertThat(result.inserted()).isEqualTo(2);
        assertThat(result.duplicateSkipped()).isZero();
        assertThat(result.failed()).isZero();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Observation>> captor = ArgumentCaptor.forClass(List.class);
        verify(observationRepository).saveAll(captor.capture());
        List<Observation> saved = captor.getValue();
        assertThat(saved).hasSize(2);
        assertThat(saved.get(0).getObservedAt()).isEqualTo(Instant.parse("2026-07-22T01:00:00Z"));
        // KST 11:00 = UTC 02:00
        assertThat(saved.get(1).getObservedAt()).isEqualTo(Instant.parse("2026-07-22T02:00:00Z"));
        assertThat(saved.get(1).getPm10()).isNull();
        assertThat(saved.get(1).getPm25()).isEqualTo(18.5);
    }

    @Test
    void upload_columnsInAnyOrderAndSubset_ok() {
        when(siteRepository.findAllById(any())).thenReturn(List.of(site(3L, "연수송도")));
        var result = service.upload(csv("""
                observed_at,pm25,site_id
                2026-07-22T10:00,12.0,3
                """));
        assertThat(result.inserted()).isEqualTo(1);
    }

    @Test
    void upload_duplicateInFileAndDb_skipsBoth() {
        when(siteRepository.findAllById(any())).thenReturn(List.of(site(1L, "미추홀주안")));
        Instant dbExisting = Instant.parse("2026-07-22T03:00:00Z");
        when(observationRepository.findExistingObservedAt(eq(1L), anyCollection()))
                .thenReturn(List.of(dbExisting));

        var result = service.upload(csv("""
                site_id,observed_at,pm25
                1,2026-07-22T01:00:00Z,10
                1,2026-07-22T01:00:00Z,11
                1,2026-07-22T03:00:00Z,12
                """));

        assertThat(result.totalRows()).isEqualTo(3);
        assertThat(result.inserted()).isEqualTo(1);
        assertThat(result.duplicateSkipped()).isEqualTo(2);
    }

    @Test
    void upload_unknownSite_reportsRowError() {
        when(siteRepository.findAllById(any())).thenReturn(List.of(site(1L, "미추홀주안")));
        var result = service.upload(csv("""
                site_id,observed_at,pm25
                1,2026-07-22T01:00:00Z,10
                999,2026-07-22T01:00:00Z,10
                """));

        assertThat(result.inserted()).isEqualTo(1);
        assertThat(result.failed()).isEqualTo(1);
        assertThat(result.errors()).hasSize(1);
        assertThat(result.errors().get(0).line()).isEqualTo(3);
        assertThat(result.errors().get(0).message()).contains("999");
    }

    @Test
    void upload_invalidValues_reportRowErrors() {
        when(siteRepository.findAllById(any())).thenReturn(List.of(site(1L, "미추홀주안")));
        var result = service.upload(csv("""
                site_id,observed_at,pm25,humidity
                1,2026-07-22T01:00:00Z,-5,50
                1,2026-07-22T02:00:00Z,10,150
                1,not-a-date,10,50
                1,2026-07-22T04:00:00Z,abc,50
                1,2026-07-22T05:00:00Z,10,50
                """));

        assertThat(result.totalRows()).isEqualTo(5);
        assertThat(result.inserted()).isEqualTo(1);
        assertThat(result.failed()).isEqualTo(4);
        assertThat(result.errors()).extracting(r -> r.line()).containsExactly(2, 3, 4, 5);
    }

    @Test
    void upload_missingRequiredHeader_throws() {
        assertThatThrownBy(() -> service.upload(csv("site_id,pm25\n1,10\n")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("observed_at");
    }

    @Test
    void upload_unknownColumn_throws() {
        assertThatThrownBy(() -> service.upload(csv("site_id,observed_at,pm99\n")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("pm99");
    }

    @Test
    void upload_emptyOrHeaderOnly_throws() {
        assertThatThrownBy(() -> service.upload(csv("")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.upload(csv("site_id,observed_at\n")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("데이터 행");
    }

    @Test
    void upload_bomHeader_isAccepted() {
        when(siteRepository.findAllById(any())).thenReturn(List.of(site(1L, "미추홀주안")));
        var result = service.upload(csv("﻿site_id,observed_at,pm25\n1,2026-07-22T01:00:00Z,10\n"));
        assertThat(result.inserted()).isEqualTo(1);
    }
}
