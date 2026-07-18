package com.airvision.backend.publicdata.history.dto;

import com.airvision.backend.publicdata.history.PublicWeatherObservation;
import java.time.Instant;

public record WeatherSeriesPoint(Instant baseTime, Double temperature, Double humidity,
                                 Double windSpeed, Double windDirectionDeg,
                                 String precipitationType) {

    public static WeatherSeriesPoint from(PublicWeatherObservation w) {
        return new WeatherSeriesPoint(w.getBaseTime(), w.getTemperature(), w.getHumidity(),
                w.getWindSpeed(), w.getWindDirectionDeg(), w.getPrecipitationType());
    }
}
