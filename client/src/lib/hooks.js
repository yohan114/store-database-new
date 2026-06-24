import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

// Distinct vehicle/machinery names (for filter + form dropdowns).
export function useVehicles() {
  return useQuery({ queryKey: ['vehicles'], queryFn: () => api.get('/vehicles'), staleTime: 5 * 60_000 });
}

// { categories: [...], counts: { name: n } }
export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: () => api.get('/categories'), staleTime: 5 * 60_000 });
}

// Stock that can currently be issued. mode 'line' = received MRN lines with qty
// left; mode 'name' = pooled stock per item name. Drives the Issue Desk picker.
export function useIssuableStock(search, mode = 'line') {
  return useQuery({
    queryKey: ['issuable-stock', mode, search],
    queryFn: () => api.get(`/issuable-stock?mode=${mode}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
    staleTime: 10_000,
  });
}

// Role-derived capabilities. Storekeepers and admins can change data; viewers
// are read-only. The server enforces the same rules — this only shapes the UI.
export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role;
  return {
    role,
    isAdmin: role === 'admin',
    isStorekeeper: role === 'storekeeper',
    isViewer: role === 'viewer',
    canWrite: role === 'admin' || role === 'storekeeper',
    canDelete: role === 'admin' || role === 'storekeeper',
  };
}
