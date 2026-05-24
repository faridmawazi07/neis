import { create } from 'zustand';

export interface User {
  id: string;
  nip: string;
  nama: string;
  role: string | null;
  status_persetujuan: string;
  foto_profile: string | null;
  jenis_kelamin: string | null;
  tanggal_lahir: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  login: (token, user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('neis-token', token);
      localStorage.setItem('neis-user', JSON.stringify(user));
    }
    set({ token, user, isAuthenticated: true });
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('neis-token');
      localStorage.removeItem('neis-user');
    }
    document.cookie = 'neis-token=; path=/; max-age=0';
    set({ token: null, user: null, isAuthenticated: false });
  },
  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    })),
}));

// Initialize from localStorage
if (typeof window !== 'undefined') {
  const savedToken = localStorage.getItem('neis-token');
  const savedUser = localStorage.getItem('neis-user');
  if (savedToken && savedUser) {
    try {
      const user = JSON.parse(savedUser);
      useAuthStore.setState({ token: savedToken, user, isAuthenticated: true });
    } catch {
      localStorage.removeItem('neis-token');
      localStorage.removeItem('neis-user');
    }
  }
}
