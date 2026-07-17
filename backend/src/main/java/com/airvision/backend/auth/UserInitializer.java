package com.airvision.backend.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * 최초 기동 시 기본 계정을 생성한다 (users 테이블이 비어 있을 때만).
 * 기본 비밀번호는 환경변수로 교체 가능하며 README에 문서화한다.
 */
@Component
public class UserInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(UserInitializer.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final String adminPassword;
    private final String userPassword;

    public UserInitializer(UserRepository userRepository, PasswordEncoder passwordEncoder,
                           @Value("${airvision.init.admin-password:admin1234!}") String adminPassword,
                           @Value("${airvision.init.user-password:user1234!}") String userPassword) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.adminPassword = adminPassword;
        this.userPassword = userPassword;
    }

    @Override
    public void run(String... args) {
        if (userRepository.count() > 0) {
            return;
        }
        userRepository.save(new User("admin",
                passwordEncoder.encode(adminPassword), "관리자", "ADMIN"));
        userRepository.save(new User("user",
                passwordEncoder.encode(userPassword), "일반 사용자", "USER"));
        log.info("기본 계정 생성 완료: admin(ADMIN), user(USER) - 비밀번호는 환경변수 또는 기본값");
    }
}
