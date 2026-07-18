package com.airvision.backend.publicdata.airkorea;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * AirKorea OpenAPI 원본(JSON) 응답 구조.
 * 값은 "-", 빈 문자열, null이 섞여 오므로 전 필드를 String으로 받고
 * 숫자 변환은 {@link AirKoreaNormalizer}에서 수행한다.
 * (공공데이터포털 문서 기준, 2026-07-18 확인)
 */
public final class AirKoreaRaw {

    private AirKoreaRaw() {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Envelope<T>(Response<T> response) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Response<T>(Header header, Body<T> body) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Header(String resultCode, String resultMsg) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Body<T>(Integer totalCount, List<T> items) {
    }

    /** MsrstnInfoInqireSvc/getMsrstnList 응답 항목. dmX=위도, dmY=경도(WGS84). */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record StationItem(
            String stationName,
            String addr,
            String dmX,
            String dmY,
            String mangName,
            String item,
            String year
    ) {
    }

    /** ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty(ver=1.3) 응답 항목. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RealtimeItem(
            String sidoName,
            String stationName,
            String dataTime,
            String pm10Value,
            String pm25Value,
            String o3Value,
            String no2Value,
            String coValue,
            String so2Value,
            String khaiValue,
            String pm10Grade,
            String pm25Grade,
            String o3Grade,
            String no2Grade,
            String coGrade,
            String so2Grade,
            String khaiGrade,
            String pm10Flag,
            String pm25Flag,
            String o3Flag,
            String no2Flag,
            String coFlag,
            String so2Flag
    ) {
    }

    /** getMinuDustFrcstDspth / getMinuDustWeekFrcstDspth 응답 항목. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ForecastItem(
            String dataTime,
            String informCode,
            String informData,
            String informGrade,
            String informOverall,
            String informCause,
            String actionKnack,
            String imageUrl1,
            String imageUrl2,
            String imageUrl3,
            // 주간예보 전용 필드
            String frcstOneDt,
            String frcstOneCn,
            String frcstTwoDt,
            String frcstTwoCn,
            String frcstThreeDt,
            String frcstThreeCn,
            String frcstFourDt,
            String frcstFourCn
    ) {
    }

    /** UlfptcaAlarmInqireSvc/getUlfptcaAlarmInfo 응답 항목. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AlertItem(
            String districtName,
            String moveName,
            String itemCode,
            String issueGbn,
            String issueDate,
            String issueTime,
            String issueVal,
            String clearDate,
            String clearTime,
            String clearVal
    ) {
    }
}
