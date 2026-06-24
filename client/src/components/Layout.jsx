import { NavLink } from 'react-router-dom';
import { NAV_SECTIONS } from '../nav.js';

function SidebarLink({ item }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
          isActive
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-slate-300 hover:bg-brand-800/60 hover:text-white',
        ].join(' ')
      }
    >
      <span className="text-base leading-none">{item.icon}</span>
      <span className="flex-1">{item.label}</span>
      {item.isNew && (
        <span className="rounded bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
          New
        </span>
      )}
    </NavLink>
  );
}

export default function Layout({ children }) {
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 flex-col bg-brand-900 md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-brand-800 px-5">
          <span className="text-2xl">📦</span>
          <div className="leading-tight">
            <div className="text-sm font-bold text-white">Stores Database</div>
            <div className="text-[11px] text-brand-100/70">Inventory Monitor</div>
          </div>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-100/50">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <SidebarLink key={item.key} item={item} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-brand-800 px-4 py-3 text-[11px] text-brand-100/60">
          <a href="/item_tracker.html" className="hover:text-white">
            ↩ Open legacy view
          </a>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="text-sm text-slate-500">
            Workshop MRN · Receiving · Issuing · Stock
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              ● Live
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
