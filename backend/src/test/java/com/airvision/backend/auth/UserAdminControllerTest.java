package com.airvision.backend.auth;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** 사용자 관리 API의 요청 검증·오류 매핑을 검증한다 (DB 불필요). */
@AutoConfigureMockMvc(addFilters = false)
@WebMvcTest(UserAdminController.class)
class UserAdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserAdminService userAdminService;

    private static final UserAdminService.UserSummary ADMIN_SUMMARY =
            new UserAdminService.UserSummary(1L, "admin", "관리자", "ADMIN",
                    Instant.parse("2026-07-17T00:00:00Z"));

    @Test
    void 목록_조회는_200과_사용자_배열을_반환한다() throws Exception {
        when(userAdminService.list()).thenReturn(List.of(ADMIN_SUMMARY));

        mockMvc.perform(get("/api/users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].username").value("admin"))
                .andExpect(jsonPath("$.data[0].role").value("ADMIN"));
    }

    @Test
    void 등록은_201을_반환한다() throws Exception {
        when(userAdminService.create("new1", "password1!", "신규", "USER"))
                .thenReturn(new UserAdminService.UserSummary(2L, "new1", "신규", "USER",
                        Instant.parse("2026-07-27T00:00:00Z")));

        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"new1","password":"password1!",
                                 "name":"신규","role":"USER"}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.username").value("new1"));
    }

    @Test
    void 등록_시_짧은_비밀번호는_400이다() throws Exception {
        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"new1","password":"short",
                                 "name":"신규","role":"USER"}"""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 내_정보_조회는_인증_주체_기준으로_반환한다() throws Exception {
        when(userAdminService.me("admin")).thenReturn(ADMIN_SUMMARY);

        mockMvc.perform(get("/api/users/me")
                        .principal(new UsernamePasswordAuthenticationToken("admin", "n/a")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.username").value("admin"));
    }

    @Test
    void 내_비밀번호_변경_시_현재_비밀번호_불일치는_400이다() throws Exception {
        doThrow(new IllegalArgumentException("현재 비밀번호가 일치하지 않습니다"))
                .when(userAdminService)
                .changeOwnPassword("admin", "wrong", "newpass123!");

        mockMvc.perform(put("/api/users/me/password")
                        .principal(new UsernamePasswordAuthenticationToken("admin", "n/a"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword":"wrong","newPassword":"newpass123!"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("현재 비밀번호가 일치하지 않습니다"));
    }

    @Test
    void 자기_자신_삭제는_400이다() throws Exception {
        doThrow(new IllegalStateException("자기 자신의 계정은 삭제할 수 없습니다"))
                .when(userAdminService).delete(eq(1L), eq("admin"));

        mockMvc.perform(delete("/api/users/1")
                        .principal(new UsernamePasswordAuthenticationToken("admin", "n/a")))
                .andExpect(status().isBadRequest());
    }
}
