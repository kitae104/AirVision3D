package com.airvision.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

/** 사용자 관리 서비스의 등록·수정·삭제 안전장치를 검증한다 (DB 불필요). */
@ExtendWith(MockitoExtension.class)
class UserAdminServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserAdminService service;

    private User admin() {
        return new User("admin", "hash-admin", "관리자", "ADMIN");
    }

    private User user() {
        return new User("user1", "hash-user", "사용자1", "USER");
    }

    @Test
    void 등록_성공_시_비밀번호는_해시로_저장된다() {
        when(userRepository.existsByUsername("new1")).thenReturn(false);
        when(passwordEncoder.encode("password1!")).thenReturn("encoded");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        UserAdminService.UserSummary created = service.create("new1", "password1!", "신규", "USER");

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getPasswordHash()).isEqualTo("encoded");
        assertThat(created.username()).isEqualTo("new1");
        assertThat(created.role()).isEqualTo("USER");
    }

    @Test
    void 등록_시_중복_아이디는_거부된다() {
        when(userRepository.existsByUsername("admin")).thenReturn(true);

        assertThatThrownBy(() -> service.create("admin", "password1!", "중복", "USER"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("이미 사용 중인 아이디");
        verify(userRepository, never()).save(any());
    }

    @Test
    void 등록_시_잘못된_역할은_거부된다() {
        assertThatThrownBy(() -> service.create("new1", "password1!", "신규", "SUPER"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("역할은 USER 또는 ADMIN");
    }

    @Test
    void 마지막_관리자는_일반_사용자로_강등할_수_없다() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin()));
        when(userRepository.countByRole("ADMIN")).thenReturn(1L);

        assertThatThrownBy(() -> service.update(1L, "관리자", "USER"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("마지막 관리자");
    }

    @Test
    void 관리자가_둘_이상이면_강등할_수_있다() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin()));
        when(userRepository.countByRole("ADMIN")).thenReturn(2L);

        UserAdminService.UserSummary updated = service.update(1L, "관리자", "USER");

        assertThat(updated.role()).isEqualTo("USER");
    }

    @Test
    void 자기_자신은_삭제할_수_없다() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin()));

        assertThatThrownBy(() -> service.delete(1L, "admin"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("자기 자신");
        verify(userRepository, never()).delete(any(User.class));
    }

    @Test
    void 마지막_관리자는_삭제할_수_없다() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin()));
        when(userRepository.countByRole("ADMIN")).thenReturn(1L);

        assertThatThrownBy(() -> service.delete(1L, "other-admin"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("마지막 관리자");
        verify(userRepository, never()).delete(any(User.class));
    }

    @Test
    void 일반_사용자는_삭제할_수_있다() {
        when(userRepository.findById(2L)).thenReturn(Optional.of(user()));

        service.delete(2L, "admin");

        verify(userRepository).delete(any(User.class));
    }

    @Test
    void 비밀번호_변경_시_현재_비밀번호가_틀리면_거부된다() {
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(user()));
        when(passwordEncoder.matches("wrong", "hash-user")).thenReturn(false);

        assertThatThrownBy(() -> service.changeOwnPassword("user1", "wrong", "newpass123!"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("현재 비밀번호");
        verify(passwordEncoder, never()).encode(any());
    }

    @Test
    void 비밀번호_변경_성공_시_새_해시로_교체된다() {
        User target = user();
        when(userRepository.findByUsername("user1")).thenReturn(Optional.of(target));
        when(passwordEncoder.matches("current1!", "hash-user")).thenReturn(true);
        when(passwordEncoder.encode("newpass123!")).thenReturn("new-hash");

        service.changeOwnPassword("user1", "current1!", "newpass123!");

        assertThat(target.getPasswordHash()).isEqualTo("new-hash");
    }
}
