package com.airvision.backend.auth;

import com.airvision.backend.common.NotFoundException;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 사용자 관리 서비스 (최종보고서 표 3-20: 목록/등록/상세/수정/비밀번호 변경/삭제).
 * 그룹 권한 기능은 CLAUDE.md 금지사항이라 역할(USER/ADMIN) 단일 축만 사용한다.
 * 안전장치: 자기 자신 삭제 금지, 마지막 ADMIN 삭제·강등 금지.
 */
@Service
@Transactional(readOnly = true)
public class UserAdminService {

    private static final Set<String> VALID_ROLES = Set.of("USER", "ADMIN");
    private static final String ROLE_ADMIN = "ADMIN";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserAdminService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public record UserSummary(Long id, String username, String name, String role,
                              Instant createdAt) {
        static UserSummary from(User user) {
            return new UserSummary(user.getId(), user.getUsername(), user.getName(),
                    user.getRole(), user.getCreatedAt());
        }
    }

    public List<UserSummary> list() {
        return userRepository.findAll(Sort.by("id")).stream()
                .map(UserSummary::from)
                .toList();
    }

    public UserSummary get(Long id) {
        return UserSummary.from(find(id));
    }

    public UserSummary me(String username) {
        return UserSummary.from(findByUsername(username));
    }

    @Transactional
    public UserSummary create(String username, String rawPassword, String name, String role) {
        validateRole(role);
        if (userRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("이미 사용 중인 아이디입니다: " + username);
        }
        User user = new User(username, passwordEncoder.encode(rawPassword), name, role);
        return UserSummary.from(userRepository.save(user));
    }

    @Transactional
    public UserSummary update(Long id, String name, String role) {
        validateRole(role);
        User user = find(id);
        if (ROLE_ADMIN.equals(user.getRole()) && !ROLE_ADMIN.equals(role) && isLastAdmin()) {
            throw new IllegalStateException("마지막 관리자 계정은 일반 사용자로 변경할 수 없습니다");
        }
        user.setName(name);
        user.setRole(role);
        return UserSummary.from(user);
    }

    @Transactional
    public void resetPassword(Long id, String rawPassword) {
        find(id).setPasswordHash(passwordEncoder.encode(rawPassword));
    }

    @Transactional
    public void delete(Long id, String requesterUsername) {
        User user = find(id);
        if (user.getUsername().equals(requesterUsername)) {
            throw new IllegalStateException("자기 자신의 계정은 삭제할 수 없습니다");
        }
        if (ROLE_ADMIN.equals(user.getRole()) && isLastAdmin()) {
            throw new IllegalStateException("마지막 관리자 계정은 삭제할 수 없습니다");
        }
        userRepository.delete(user);
    }

    /** 마이페이지 비밀번호 변경: 현재 비밀번호 확인 후 교체. */
    @Transactional
    public void changeOwnPassword(String username, String currentPassword, String newPassword) {
        User user = findByUsername(username);
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("현재 비밀번호가 일치하지 않습니다");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
    }

    private User find(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("사용자", id));
    }

    private User findByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("사용자", username));
    }

    private boolean isLastAdmin() {
        return userRepository.countByRole(ROLE_ADMIN) <= 1;
    }

    private void validateRole(String role) {
        if (!VALID_ROLES.contains(role)) {
            throw new IllegalArgumentException("역할은 USER 또는 ADMIN이어야 합니다: " + role);
        }
    }
}
