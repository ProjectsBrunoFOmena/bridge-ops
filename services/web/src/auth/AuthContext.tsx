import { createContext, useContext, useMemo, useState } from "react";
import type { AuthUser, LoginResponse } from "../types";
import { ApiError, apiFetch } from "../lib/api";

const TOKEN_KEY = "portal.token";
const USER_KEY = "portal.user";

interface LoginInput {
  email: string;
  password: string;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isOperator: boolean;
  isViewer: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readSession<T>(key: string): T | null {
  const value = sessionStorage.getItem(key);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => readSession<AuthUser>(USER_KEY));

  const logout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  const login = async (input: LoginInput) => {
    try {
      const response = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(input)
      });
      sessionStorage.setItem(TOKEN_KEY, response.token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(response.user));
      setToken(response.token);
      setUser(response.user);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        throw new Error("Credenciais invalidas.");
      }
      throw error;
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      isOperator: user?.role === "operator",
      isViewer: user?.role === "viewer",
      login,
      logout
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro do AuthProvider");
  }
  return context;
}
