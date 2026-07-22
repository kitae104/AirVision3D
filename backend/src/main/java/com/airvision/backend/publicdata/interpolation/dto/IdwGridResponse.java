package com.airvision.backend.publicdata.interpolation.dto;

import java.util.List;

public record IdwGridResponse(String sido, double power, int resolution, String method,
                              String source, boolean mock, boolean stale, int sourceCount,
                              Bbox bbox, List<IdwGridCell> cells) {

    public record Bbox(double minLatitude, double minLongitude,
                       double maxLatitude, double maxLongitude) {
    }
}
