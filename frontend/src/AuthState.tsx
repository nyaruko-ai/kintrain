import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AUTH_STORAGE_KEY = 'kintrain-mock-auth-v1';

interface AuthSnapshot {
  isAuthenticated: boolean;
  email: string;
}

interface AuthContextValue extends AuthSnapshot {
  login: (email: string, password: string) => { ok: boolean; message?: string };
  logout: () => void;
}

const initialAuth: AuthSnapshot = {
  isAuthenticated: false,
  email: ''
};

const AuthContext = createContext<AuthContextValue | null>(null);

function loadAuth(): AuthSnapshot {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return initialAuth;
    }
    const parsed = JSON.parse(raw) as Partial<AuthSnapshot>;
    return {
      isAuthenticated: !!parsed.isAuthenticated,
      email: parsed.email ?? ''
    };
  } catch {
    return initialAuth;
  }
}

function saveAuth(value: AuthSnapshot): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthSnapshot>(() => loadAuth());

  useEffect(() => {
    saveAuth(auth);
  }, [auth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...auth,
      login: (email, password) => {
        const normalizedEmail = email.trim().toLowerCase();
        if (!isValidEmail(normalizedEmail)) {
          return { ok: false, message: 'メールアドレス形式が不正です。' };
        }
        if (password.trim().length < 8) {
          return { ok: false, message: 'パスワードは8文字以上で入力してください。' };
        }
        setAuth({
          isAuthenticated: true,
          email: normalizedEmail
        });
        return { ok: true };
      },
      logout: () => {
        setAuth(initialAuth);
      }
    }),
    [auth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
