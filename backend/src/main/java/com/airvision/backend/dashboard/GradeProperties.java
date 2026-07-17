package com.airvision.backend.dashboard;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** application.yml의 airvision.pm25-grades 바인딩 (등급 기준 설정 관리). */
@ConfigurationProperties(prefix = "airvision")
public record GradeProperties(List<Grade> pm25Grades) {

    public record Grade(String name, Double upper) {
    }

    /** PM2.5 값의 등급명. upper가 null인 마지막 등급은 상한 없음. */
    public String gradeOf(double pm25) {
        for (Grade grade : pm25Grades) {
            if (grade.upper() == null || pm25 <= grade.upper()) {
                return grade.name();
            }
        }
        return pm25Grades.get(pm25Grades.size() - 1).name();
    }
}
