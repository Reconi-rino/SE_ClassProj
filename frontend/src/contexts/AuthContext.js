import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchMe, login as loginApi, register as registerApi, resetPassword as resetPasswordApi } from "../services/authApi";

const TOKEN_KEY = "ccms_token";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const result = await fetchMe(token);
        setUser(result.data);
      } catch (error) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, [token]);

  const register = useCallback(async (payload) => {
    const result = await registerApi(payload);
    localStorage.setItem(TOKEN_KEY, result.data.token);
    setToken(result.data.token);
    setUser(result.data.user);
    return result;
  }, []);

  const login = useCallback(async (payload) => {
    const result = await loginApi(payload);
    localStorage.setItem(TOKEN_KEY, result.data.token);
    setToken(result.data.token);
    setUser(result.data.user);
    return result;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const resetPassword = useCallback(
    async (payload) => {
      if (!token) {
        throw new Error("Not authenticated");
      }
      const result = await resetPasswordApi(token, payload);
      localStorage.setItem(TOKEN_KEY, result.data.token);
      setToken(result.data.token);
      setUser(result.data.user);
      return result;
    },
    [token]
  );

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(token && user),
      register,
      login,
      logout,
      resetPassword,
    }),
    [user, token, loading, register, login, logout, resetPassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
