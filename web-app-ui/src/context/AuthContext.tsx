import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthSession, User } from '../types';
import * as authService from '../services/authService';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = authService.getStoredSession();
  const [session, setSession] = useState<AuthSession | null>(stored);
  const [isBootstrapping] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    const next = await authService.login(email, password);
    setSession(next);
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session),
      isBootstrapping,
      login,
      logout,
    }),
    [session, isBootstrapping, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
