import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  username: string | null
  name: string | null
  role: 'USER' | 'ADMIN' | null
  login: (data: { token: string; username: string; name: string; role: string }) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      username: null,
      name: null,
      role: null,
      login: (data) =>
        set({
          token: data.token,
          username: data.username,
          name: data.name,
          role: data.role as 'USER' | 'ADMIN',
        }),
      logout: () => set({ token: null, username: null, name: null, role: null }),
    }),
    { name: 'airvision-auth' },
  ),
)
