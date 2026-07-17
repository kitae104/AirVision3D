package com.airvision.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@org.springframework.boot.context.properties.ConfigurationPropertiesScan
@SpringBootApplication
public class AirvisionBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(AirvisionBackendApplication.class, args);
	}

}
