package com.airvision.backend.observation.dto;

import java.util.List;

/** CSV 일괄 업로드 결과 요약. errors는 최대 20건까지만 담는다(failed는 전체 실패 수). */
public record CsvUploadResult(
        int totalRows,
        int inserted,
        int duplicateSkipped,
        int failed,
        List<RowError> errors
) {
    /** 실패한 행의 위치(1-기준 파일 행 번호)와 사유. */
    public record RowError(int line, String message) {
    }
}
