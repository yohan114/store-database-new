import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { useToast } from '../../components/ui/Toast.jsx';
import BatteryFormModal from './BatteryFormModal.jsx';
import BatteryMoveModal from './BatteryMoveModal.jsx';
import BatteryTimelineModal from './BatteryTimelineModal.jsx';
import { usePermissions } from '../../lib/hooks.js';
import { useDebounce } from '../../lib/useDebounce.js';
import { fmtDate } from '../../lib/format.js';

const CONDITION_BADGE = { New: 'bg-emerald-100 text-emerald-700', Old: 'bg-amber-100 text-amber-700', Expired: 'bg-rose-100 text-rose-700' };
const STATE_BADGE = { 'In Store': 'bg-slate-200 text-slate-600', Installed: 'bg-brand-100 text-brand-700', Disposed: 'bg-rose-100 text-rose-700' };

const STAT_CARDS = [
  ['total', 'Active total', 'text-slate-700'],
  ['newInStore', 'New · in store', 'text-emerald-600'],
  ['oldInStore', 'Old · in store', 'text-amber-600'],
  ['installed', 'Installed', 'text-brand-600'],
  ['expired', 'Expired', 'text-rose-600'],
];

export default function Batteries() {
  const qc = useQueryClient();
  const toast = useToast();
  const { canWrite, canDelete } = usePermissions();

  const [search, setSearch] = useState('');
  const [condition, setCondition] = useState('all');
  const [state, setState] = useState('all');
  const [form, setForm] = useState(undefined); // undefined = closed, null = new, obj = edit
  const [moveBatt, setMoveBatt] = useState(null);
  const [timeline, setTimeline] = useState(null);

  const debSearch = useDebounce(search, 300);
  const params = new URLSearchParams();
  if (debSearch) params.set('search', debSearch);
  if (condition !== 'all') params.set('condition', condition);
  if (state !== 'all') params.set('state', state);

  const { data: stats } = useQuery({ queryKey: ['battery-stats'], queryFn: () => api.get('/battery-stats') });
  const { data: batteries = [], isLoading, error } = useQuery({
    queryKey: ['batteries', { s: debSearch, condition, state }],
    queryFn: () => api.get(`/batteries?${params.toString()}`),
  });

  const del = useMutation({
    mutationFn: (id) => api.del(`/batteries/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batteries'] });
      qc.invalidateQueries({ queryKey: ['battery-stats'] });
      toast.success('Battery deleted.');
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Battery Registry</h1>
          <p className="text-sm text-slate-500">Track every battery — condition, location and full movement history.</p>
        </div>
        {canWrite && (
          <button onClick={() => setForm(null)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">+ Register battery</button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {STAT_CARDS.map(([key, label, color]) => (
          <div key={key} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">{label}</div>
            <div className={`mt-1 text-2xl font-bold ${color}`}>{stats?.[key] ?? 0}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search serial, brand, vehicle…" className="input max-w-xs flex-1" />
        <select className="input max-w-[11rem]" value={condition} onChange={(e) => setCondition(e.target.value)}>
          <option value="all">All conditions</option><option>New</option><option>Old</option><option>Expired</option>
        </select>
        <select className="input max-w-[11rem]" value={state} onChange={(e) => setState(e.target.value)}>
          <option value="all">All states</option><option>In Store</option><option>Installed</option><option>Disposed</option>
        </select>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error.message}</div>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Serial</th>
              <th className="px-3 py-3">Brand / spec</th>
              <th className="px-3 py-3">Condition</th>
              <th className="px-3 py-3">State</th>
              <th className="px-3 py-3">Vehicle</th>
              <th className="px-3 py-3">Expiry</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>}
            {!isLoading && batteries.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No batteries found.</td></tr>}
            {batteries.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50/60">
                <td className="px-3 py-2 font-medium text-slate-800">{b.serialNumber}</td>
                <td className="px-3 py-2 text-slate-600">{b.brand || '—'}{b.itemDesc ? <span className="text-xs text-slate-400"> · {b.itemDesc}</span> : null}</td>
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONDITION_BADGE[b.condition] || 'bg-slate-100'}`}>{b.condition}{b.isExpired && b.condition !== 'Expired' ? ' ⚠' : ''}</span></td>
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE_BADGE[b.state] || 'bg-slate-100'}`}>{b.state}</span></td>
                <td className="px-3 py-2 text-slate-600">{b.currentVehicle || '—'}</td>
                <td className="px-3 py-2 text-slate-500">{fmtDate(b.expiryDateISO || b.expiryDate)}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setTimeline(b)} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">History</button>
                    {canWrite && b.state !== 'Disposed' && <button onClick={() => setMoveBatt(b)} className="rounded border border-brand-200 px-2 py-1 text-xs text-brand-700 hover:bg-brand-50">Move</button>}
                    {canWrite && <button onClick={() => setForm(b)} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">Edit</button>}
                    {canDelete && <button onClick={() => { if (window.confirm(`Delete battery ${b.serialNumber}?`)) del.mutate(b.id); }} className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">Delete</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BatteryFormModal open={form !== undefined} onClose={() => setForm(undefined)} battery={form || null} />
      <BatteryMoveModal open={!!moveBatt} onClose={() => setMoveBatt(null)} battery={moveBatt} />
      <BatteryTimelineModal open={!!timeline} onClose={() => setTimeline(null)} batteryId={timeline?.id} serial={timeline?.serialNumber} />
    </div>
  );
}
