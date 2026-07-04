// Single source of truth for the sidebar + router.
// `isNew` marks the brand-new features from the rebuild; `legacy` points at the
// matching screen in the old item_tracker.html so users can always cross-check
// until that screen is fully ported.
export const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', path: '/', icon: '📊' },
      { key: 'fleet', label: 'Fleet', path: '/fleet', icon: '🚜' },
    ],
  },
  {
    title: 'Procurement',
    items: [
      { key: 'tracker', label: 'MRN Tracker', path: '/tracker', icon: '📋' },
      { key: 'receiving', label: 'Receiving Desk', path: '/receiving', icon: '📥' },
      { key: 'pricing', label: 'Pricing & GRN', path: '/pricing', icon: '💵' },
    ],
  },
  {
    title: 'Stock',
    items: [
      { key: 'inventory', label: 'Inventory / Stock', path: '/inventory', icon: '📦' },
      { key: 'general-items', label: 'General Items & Racks', path: '/general-items', icon: '🗄️' },
      { key: 'issued', label: 'Issued Items', path: '/issued', icon: '📤' },
      { key: 'transfers', label: 'Material Transfers', path: '/transfers', icon: '🔁' },
      { key: 'batteries', label: 'Battery Registry', path: '/batteries', icon: '🔋' },
    ],
  },
  {
    title: 'New',
    items: [
      { key: 'alerts', label: 'Low-Stock Alerts', path: '/alerts', icon: '🔔', isNew: true },
      { key: 'reports', label: 'Reports & Printing', path: '/reports', icon: '🖨️', isNew: true },
    ],
  },
  {
    title: 'Admin',
    items: [
      { key: 'admin', label: 'Users & Audit', path: '/admin', icon: '🛡️', isNew: true },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);
