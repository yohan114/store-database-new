import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Placeholder from './components/Placeholder.jsx';
import Dashboard from './features/dashboard/Dashboard.jsx';
import Admin from './features/admin/Admin.jsx';
import Login from './features/auth/Login.jsx';
import { useAuth } from './auth/AuthContext.jsx';
import { ALL_NAV_ITEMS } from './nav.js';

// Screens that are fully ported to React. Everything else renders a Placeholder
// that links back to the legacy view until it is migrated (Phase 2).
function ported(user) {
  return {
    '/': <Dashboard />,
    '/admin': user?.role === 'admin' ? <Admin /> : <Placeholder title="Admins only" legacyHint="Ask an administrator for access." />,
  };
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }

  if (!user) return <Login />;

  const screens = ported(user);

  return (
    <Layout>
      <Routes>
        {ALL_NAV_ITEMS.map((item) => (
          <Route
            key={item.key}
            path={item.path}
            element={screens[item.path] ?? <Placeholder title={item.label} />}
          />
        ))}
        <Route path="*" element={<Placeholder title="Page not found" />} />
      </Routes>
    </Layout>
  );
}
