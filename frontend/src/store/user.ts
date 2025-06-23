import { create } from 'zustand';

interface UserState {
  isLoggedIn: boolean;
  username?: string;
  login: (username: string) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  isLoggedIn: false,
  username: undefined,
  login: (username) => set({ isLoggedIn: true, username }),
  logout: () => set({ isLoggedIn: false, username: undefined }),
})); 