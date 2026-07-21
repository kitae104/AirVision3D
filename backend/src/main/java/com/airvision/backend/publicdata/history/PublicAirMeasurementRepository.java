package com.airvision.backend.publicdata.history;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface PublicAirMeasurementRepository extends JpaRepository<PublicAirMeasurement, Long> {

    /** 시간별 평균 (차트용). sido가 null이면 전체. */
    interface HourlyAvg {
        Instant getHour();

        Double getAvgPm10();

        Double getAvgPm25();

        Long getCnt();
    }

    @Modifying
    @Transactional
    @Query(value = """
            INSERT INTO public_air_measurement
              (station_name, sido, latitude, longitude, measured_at,
               pm10, pm25, o3, no2, co, so2, khai, pm10_grade, pm25_grade,
               collected_mock, collected_at)
            VALUES (:stationName, :sido, :latitude, :longitude, :measuredAt,
               :pm10, :pm25, :o3, :no2, :co, :so2, :khai, :pm10Grade, :pm25Grade,
               :mock, :collectedAt)
            ON CONFLICT (station_name, measured_at) DO UPDATE SET
               pm10 = EXCLUDED.pm10, pm25 = EXCLUDED.pm25, o3 = EXCLUDED.o3,
               no2 = EXCLUDED.no2, co = EXCLUDED.co, so2 = EXCLUDED.so2,
               khai = EXCLUDED.khai, pm10_grade = EXCLUDED.pm10_grade,
               pm25_grade = EXCLUDED.pm25_grade, collected_mock = EXCLUDED.collected_mock
            """, nativeQuery = true)
    int upsert(@Param("stationName") String stationName, @Param("sido") String sido,
               @Param("latitude") Double latitude, @Param("longitude") Double longitude,
               @Param("measuredAt") Instant measuredAt,
               @Param("pm10") Double pm10, @Param("pm25") Double pm25, @Param("o3") Double o3,
               @Param("no2") Double no2, @Param("co") Double co, @Param("so2") Double so2,
               @Param("khai") Double khai, @Param("pm10Grade") String pm10Grade,
               @Param("pm25Grade") String pm25Grade, @Param("mock") boolean mock,
               @Param("collectedAt") Instant collectedAt);

    @Query(value = """
            SELECT date_trunc('hour', measured_at) AS hour,
                   AVG(pm10) AS avgPm10, AVG(pm25) AS avgPm25, COUNT(*) AS cnt
            FROM public_air_measurement
            WHERE measured_at BETWEEN :from AND :to
              AND (:sido IS NULL OR sido = :sido)
            GROUP BY 1 ORDER BY 1
            """, nativeQuery = true)
    List<HourlyAvg> findHourlyAvg(@Param("sido") String sido,
                                  @Param("from") Instant from, @Param("to") Instant to);

    List<PublicAirMeasurement> findByStationNameAndMeasuredAtBetweenOrderByMeasuredAt(
            String stationName, Instant from, Instant to);

    /**
     * 시도 내 좌표·pm25가 있는 측정을 (측정소명, 시각) 순으로 반환.
     * 서비스에서 측정소별로 묶어 시계열 재생용 응답을 만든다.
     */
    @Query(value = """
            SELECT * FROM public_air_measurement
            WHERE sido = :sido
              AND measured_at BETWEEN :from AND :to
              AND latitude IS NOT NULL AND longitude IS NOT NULL AND pm25 IS NOT NULL
            ORDER BY station_name ASC, measured_at ASC
            """, nativeQuery = true)
    List<PublicAirMeasurement> findRegionSeries(@Param("sido") String sido,
                                                @Param("from") Instant from,
                                                @Param("to") Instant to);

    @Modifying
    @Transactional
    void deleteByMeasuredAtBefore(Instant cutoff);

    Optional<PublicAirMeasurement> findFirstByOrderByCollectedAtAsc();
}
