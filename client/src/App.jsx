import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Placeholder from './components/Placeholder.jsx';
import Dashboard from './features/dashboard/Dashboard.jsx';
import { ALL_NAV_ITEMS } from './nav.js';

// Dashboard is the first fully-ported screen. Every other nav entry renders a
// Placeholder for now (Phase 2 replaces these one by one).
const PORTED = {
  '/': <Dashboard />,
};

export default function App() {
  return (
    <Layout>
      <Routes>
        {ALL_NAV_ITEMS.map((item) => (
          <Route
            key={item.key}
            path={item.path}
            element={PORTED[item.path] ?? <Placeholder title={item.label} />}
          />
        ))}
        <Route path="*" element={<Placeholder title="Page not found" />} />
      </Routes>
    </Layout>
  );
}
