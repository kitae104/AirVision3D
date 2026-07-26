package com.airvision.backend.auth;

import com.airvision.backend.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 사용자 관리 API (관리자 전용) + 마이페이지(본인).
 * 권한 규칙은 SecurityConfig에서 /api/users/me/** = 로그인 사용자,
 * 그 외 /api/users/** = ADMIN으로 제한한다.
 */
@Tag(name = "Users", description = "사용자 관리·마이페이지 API")
@RestController
@RequestMapping("/api/users")
public class UserAdminController {

    private final UserAdminService userAdminService;

    public UserAdminController(UserAdminService userAdminService) {
        this.userAdminService = userAdminService;
    }

    public record CreateUserRequest(
            @NotBlank(message = "아이디는 필수입니다")
            @Pattern(regexp = "[a-zA-Z0-9_-]{3,50}",
                    message = "아이디는 영문·숫자·-·_ 3~50자여야 합니다")
            String username,
            @NotBlank(message = "비밀번호는 필수입니다")
            @Size(min = 8, max = 100, message = "비밀번호는 8자 이상이어야 합니다")
            String password,
            @NotBlank(message = "이름은 필수입니다") @Size(max = 100) String name,
            @NotBlank(message = "역할은 필수입니다") String role) {
    }

    public record UpdateUserRequest(
            @NotBlank(message = "이름은 필수입니다") @Size(max = 100) String name,
            @NotBlank(message = "역할은 필수입니다") String role) {
    }

    public record ResetPasswordRequest(
            @NotBlank(message = "비밀번호는 필수입니다")
            @Size(min = 8, max = 100, message = "비밀번호는 8자 이상이어야 합니다")
            String password) {
    }

    public record ChangeMyPasswordRequest(
            @NotBlank(message = "현재 비밀번호는 필수입니다") String currentPassword,
            @NotBlank(message = "새 비밀번호는 필수입니다")
            @Size(min = 8, max = 100, message = "새 비밀번호는 8자 이상이어야 합니다")
            String newPassword) {
    }

    @Operation(summary = "사용자 목록 조회 (관리자)")
    @GetMapping
    public ApiResponse<List<UserAdminService.UserSummary>> list() {
        return ApiResponse.ok(userAdminService.list());
    }

    @Operation(summary = "사용자 등록 (관리자)")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<UserAdminService.UserSummary> create(
            @Valid @RequestBody CreateUserRequest request) {
        return ApiResponse.ok(userAdminService.create(
                request.username(), request.password(), request.name(), request.role()));
    }

    @Operation(summary = "내 정보 조회 (마이페이지)")
    @GetMapping("/me")
    public ApiResponse<UserAdminService.UserSummary> myInfo(Authentication authentication) {
        return ApiResponse.ok(userAdminService.me(authentication.getName()));
    }

    @Operation(summary = "내 비밀번호 변경 (마이페이지)")
    @PutMapping("/me/password")
    public ApiResponse<Void> changeMyPassword(Authentication authentication,
            @Valid @RequestBody ChangeMyPasswordRequest request) {
        userAdminService.changeOwnPassword(
                authentication.getName(), request.currentPassword(), request.newPassword());
        return ApiResponse.ok(null);
    }

    @Operation(summary = "사용자 상세 조회 (관리자)")
    @GetMapping("/{id}")
    public ApiResponse<UserAdminService.UserSummary> get(@PathVariable Long id) {
        return ApiResponse.ok(userAdminService.get(id));
    }

    @Operation(summary = "사용자 정보 수정 - 이름·역할 (관리자)")
    @PutMapping("/{id}")
    public ApiResponse<UserAdminService.UserSummary> update(@PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest request) {
        return ApiResponse.ok(userAdminService.update(id, request.name(), request.role()));
    }

    @Operation(summary = "사용자 비밀번호 재설정 (관리자)")
    @PutMapping("/{id}/password")
    public ApiResponse<Void> resetPassword(@PathVariable Long id,
            @Valid @RequestBody ResetPasswordRequest request) {
        userAdminService.resetPassword(id, request.password());
        return ApiResponse.ok(null);
    }

    @Operation(summary = "사용자 삭제 (관리자, 본인·마지막 관리자 불가)")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id, Authentication authentication) {
        userAdminService.delete(id, authentication.getName());
        return ApiResponse.ok(null);
    }
}
