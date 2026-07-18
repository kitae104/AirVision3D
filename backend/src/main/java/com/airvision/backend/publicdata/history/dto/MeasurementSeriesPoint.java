package com.airvision.backend.publicdata.history.dto;

import com.airvision.backend.publicdata.history.PublicAirMeasurement;
import java.time.Instant;

public record MeasurementSeriesPoint(Instant measuredAt, Double pm10, Double pm25,
                                     String pm25Grade) {

    public static MeasurementSeriesPoint from(PublicAirMeasurement m) {
        return new MeasurementSeriesPoint(m.getMeasuredAt(), m.getPm10(), m.getPm25(),
                m.getPm25Grade());
    }
}
