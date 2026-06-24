import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = useCallback(async (username, password) => {
    const data = await api.post('/auth/login', { username, password });
    localStorage.setItem('auth_token', data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* best effort */ }
    localStorage.removeItem('auth_token');
    setUser(null);
  }, []);

  // On first load, validate any stored token and restore the session.
  useEffect(() => {
    let active = true;
    const token = localStorage.getItem('auth_token');
    if (!token) { setLoading(false); return; }
    api
      .get('/auth/me')
      .then((d) => { if (active) setUser(d.user); })
      .catch(() => localStorage.removeItem('auth_token'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // Global logout when a request reports the session is no longer valid.
  useEffect(() => {
    const onUnauth = () => {
      localStorage.removeItem('auth_token');
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', onUnauth);
    return () => window.removeEventListener('auth:unauthorized', onUnauth);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
