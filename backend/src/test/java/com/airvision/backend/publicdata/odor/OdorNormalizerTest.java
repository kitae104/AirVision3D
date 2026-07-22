package com.airvision.backend.publicdata.odor;

import static org.assertj.core.api.Assertions.assertThat;

import com.airvision.backend.publicdata.odor.dto.OdorMeasurement;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 데이터셋별로 다른 컬럼명·값 형식을 키워드 기반으로 해석하는지 확인한다. */
class OdorNormalizerTest {

    @Test
    void normalize_gajwaStyleColumns() {
        List<OdorMeasurement> result = OdorNormalizer.normalize("가좌사업소", List.of(Map.of(
                "관할사업소", "가좌사업소",
                "측정일자", "2026-06-11",
                "측정지점", "정문",
                "주소_위치정보", "인천 서구 가좌동 173-1",
                "좌표_위도_Y축", 37.4862,
                "좌표_경도_X축", 126.6758,
                "측정값(복합악취희석배수)", 10.0)));

        assertThat(result).hasSize(1);
        OdorMeasurement m = result.get(0);
        assertThat(m.office()).isEqualTo("가좌사업소");
        assertThat(m.spotName()).isEqualTo("정문");
        assertThat(m.address()).isEqualTo("인천 서구 가좌동 173-1");
        assertThat(m.latitude()).isEqualTo(37.4862);
        assertThat(m.longitude()).isEqualTo(126.6758);
        assertThat(m.measuredDate()).isEqualTo("2026-06-11");
        assertThat(m.dilution()).isEqualTo(10.0);
    }

    @Test
    void normalize_variantColumnsAndStringNumbers() {
        // 승기/송도 스타일: 측정장소·세부주소·"좌표(Y) 위도"·문자열 숫자
        List<OdorMeasurement> result = OdorNormalizer.normalize("송도사업소", List.of(Map.of(
                "측정일자", "2026-06-19",
                "측정장소", "부지경계 동측",
                "세부주소", "인천 연수구 송도동 214",
                "좌표(Y) 위도", "37.3912",
                "좌표(X) 경도", "126.6421",
                "측정값(복합악취희석배수)", "14.9")));

        OdorMeasurement m = result.get(0);
        assertThat(m.spotName()).isEqualTo("부지경계 동측");
        assertThat(m.address()).isEqualTo("인천 연수구 송도동 214");
        assertThat(m.latitude()).isEqualTo(37.3912);
        assertThat(m.longitude()).isEqualTo(126.6421);
        assertThat(m.dilution()).isEqualTo(14.9);
    }

    @Test
    void normalize_missingOrInvalidCoords_keptWithoutLocation() {
        List<OdorMeasurement> result = OdorNormalizer.normalize("승기사업소", List.of(
                Map.of("측정지점", "지점A", "측정값(복합악취희석배수)", 5.0, "위도", "", "경도", ""),
                Map.of("측정지점", "지점B", "측정값(복합악취희석배수)", 6.0, "위도", 500.0, "경도", 126.6)));

        assertThat(result).hasSize(2);
        assertThat(result.get(0).latitude()).isNull();
        assertThat(result.get(1).latitude()).isNull(); // 한국 좌표 범위 밖 → 무효 처리
        assertThat(result.get(1).longitude()).isEqualTo(126.6);
    }

    @Test
    void normalize_skipsFullyEmptyRows_andHandlesSuffixedNumbers() {
        List<OdorMeasurement> result = OdorNormalizer.normalize("가좌사업소", List.of(
                Map.of("측정지점", "", "주소_위치정보", "", "측정값(복합악취희석배수)", ""),
                Map.of("측정지점", "지점C", "측정값(복합악취희석배수)", "15배")));

        assertThat(result).hasSize(1);
        assertThat(result.get(0).dilution()).isEqualTo(15.0);
    }

    @Test
    void number_parsesCommaAndReturnsNullForText() {
        assertThat(OdorNormalizer.number("1,234.5")).isEqualTo(1234.5);
        assertThat(OdorNormalizer.number("측정불가")).isNull();
        assertThat(OdorNormalizer.number(null)).isNull();
    }
}
