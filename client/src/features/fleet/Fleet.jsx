import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import FleetDetailModal from './FleetDetailModal.jsx';
import { useDebounce } from '../../lib/useDebounce.js';

function ProgressBar({ pct }) {
  const color = pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-brand-500' : 'bg-amber-500';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

export default function Fleet() {
  const [search, setSearch] = useState('');
  const [vehicle, setVehicle] = useState(null);
  const debSearch = useDebounce(search, 250);

  const { data: fleet = [], isLoading, error } = useQuery({ queryKey: ['fleet'], queryFn: () => api.get('/fleet') });

  const visible = useMemo(() => {
    const q = debSearch.trim().toLowerCase();
    return q ? fleet.filter((v) => v.name.toLowerCase().includes(q)) : fleet;
  }, [fleet, debSearch]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Fleet</h1>
          <p className="text-sm text-slate-500">Every vehicle / machine and its request fulfilment status.</p>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vehicle…" className="input max-w-xs" />
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error.message}</div>}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((v) => (
            <button
              key={v.name}
              onClick={() => setVehicle(v.name)}
              className="rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🚜</span>
                  <span className="font-semibold text-slate-800">{v.name}</span>
                </div>
                {v.hasOverdue ? (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Overdue</span>
                ) : null}
              </div>

              <div className="mt-4 mb-1 flex items-center justify-between text-xs text-slate-500">
                <span>Fulfilment</span>
                <span className="font-semibold text-slate-700">{v.progressPct}%</span>
              </div>
              <ProgressBar pct={v.progressPct} />

              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>{v.totalLines} line{v.totalLines === 1 ? '' : 's'}</span>
                {v.pendingSupplierCount > 0 && <span className="text-amber-600">{v.pendingSupplierCount} awaiting supplier</span>}
                {v.pendingWorkshopCount > 0 && <span className="text-brand-600">{v.pendingWorkshopCount} in workshop</span>}
              </div>
            </button>
          ))}
          {visible.length === 0 && <div className="col-span-full py-10 text-center text-slate-400">No vehicles match.</div>}
        </div>
      )}

      <FleetDetailModal open={!!vehicle} onClose={() => setVehicle(null)} vehicle={vehicle} />
    </div>
  );
}
