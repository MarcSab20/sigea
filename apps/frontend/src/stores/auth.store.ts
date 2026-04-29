import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { JwtPayload } from '@sigea/shared-types';

interface AuthState {
  accessToken: string | null;
  user: JwtPayload | null;
  setAccessToken: (token: string) => void;
  setUser: (user: JwtPayload) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      accessToken: null,
      user: null,
      setAccessToken: (token) => set({ accessToken: token }),
      setUser: (user) => set({ user }),
      logout: () => set({ accessToken: null, user: null }),
    }),
    {
      name: 'sigea-auth',
      // NE PAS persister le token — uniquement le profil utilisateur
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
