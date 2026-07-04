import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { useToast } from '../../components/ui/Toast.jsx';
import GeneralItemFormModal from './GeneralItemFormModal.jsx';
import GeneralItemTxModal from './GeneralItemTxModal.jsx';
import GeneralItemLedgerModal from './GeneralItemLedgerModal.jsx';
import { usePermissions } from '../../lib/hooks.js';
import { useDebounce } from '../../lib/useDebounce.js';
import { num } from '../../lib/format.js';

function stockBadge(item) {
  if (item.currentStock <= 0) return ['Out', 'bg-rose-100 text-rose-700'];
  if (item.currentStock <= item.minStock) return ['Low', 'bg-amber-100 text-amber-700'];
  return ['In stock', 'bg-emerald-100 text-emerald-700'];
}

export default function GeneralItems() {
  const qc = useQueryClient();
  const toast = useToast();
  const { canWrite, canDelete } = usePermissions();

  const [search, setSearch] = useState('');
  const [rack, setRack] = useState('all');
  const [category, setCategory] = useState('all');
  const [stockStatus, setStockStatus] = useState('all');
  const [form, setForm] = useState(undefined);
  const [tx, setTx] = useState(null); // null = closed, {item} = bound, {item:null} = with picker
  const [ledger, setLedger] = useState(null);

  const debSearch = useDebounce(search, 300);
  const params = new URLSearchParams();
  if (debSearch) params.set('search', debSearch);
  if (rack !== 'all') params.set('rack', rack);
  if (category !== 'all') params.set('category', category);
  if (stockStatus !== 'all') params.set('stockStatus', stockStatus);

  const { data: stats } = useQuery({ queryKey: ['gi-stats'], queryFn: () => api.get('/general-items/stats') });
  const { data: racks = [] } = useQuery({ queryKey: ['gi-racks'], queryFn: () => api.get('/general-items/racks'), staleTime: 60_000 });
  const { data: subcats = [] } = useQuery({ queryKey: ['gi-subcats'], queryFn: () => api.get('/general-items/subcategories'), staleTime: 60_000 });
  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['general-items', { s: debSearch, rack, category, stockStatus }],
    queryFn: () => api.get(`/general-items?${params.toString()}`),
  });

  const del = useMutation({
    mutationFn: (id) => api.del(`/general-items/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['general-items'] });
      qc.invalidateQueries({ queryKey: ['gi-stats'] });
      toast.success('Item deleted.');
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">General Items &amp; Racks</h1>
          <p className="text-sm text-slate-500">Rack-based stock with a running balance per item.</p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <button onClick={() => setTx({ item: null })} className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
              Record movement
            </button>
            <button onClick={() => setForm(null)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">+ Register item</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total items" value={stats?.totalSKUs ?? 0} color="text-slate-700" />
        <Stat label="Low stock" value={stats?.lowStock ?? 0} color="text-amber-600" />
        <Stat label="Out of stock" value={stats?.outOfStock ?? 0} color="text-rose-600" />
        <Stat label="Transactions" value={stats?.totalTransactions ?? 0} color="text-brand-600" />
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search item, part no, spec…" className="input max-w-xs flex-1" />
        <select className="input max-w-[10rem]" value={rack} onChange={(e) => setRack(e.target.value)}>
          <option value="all">All racks</option>{racks.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="input max-w-[12rem]" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>{subcats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input max-w-[10rem]" value={stockStatus} onChange={(e) => setStockStatus(e.target.value)}>
          <option value="all">Any stock</option><option value="in">In stock</option><option value="low">Low</option><option value="out">Out</option>
        </select>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error.message}</div>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Rack</th>
              <th className="px-3 py-3">Item</th>
              <th className="px-3 py-3">Part no.</th>
              <th className="px-3 py-3 text-right">Stock</th>
              <th className="px-3 py-3 text-right">Min</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>}
            {!isLoading && items.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No items found.</td></tr>}
            {items.map((it) => {
              const [label, cls] = stockBadge(it);
              return (
                <tr key={it.id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2"><span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{it.rackNumber || '—'}</span></td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{it.itemName}</div>
                    {it.specification && <div className="text-xs text-slate-400">{it.specification}</div>}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{it.partNumber || '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800">{num(it.currentStock)} <span className="text-xs font-normal text-slate-400">{it.unit}</span></td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{num(it.minStock)}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span></td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setLedger(it)} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">Ledger</button>
                      {canWrite && <button onClick={() => setTx({ item: it })} className="rounded border border-emerald-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50">Move stock</button>}
                      {canWrite && <button onClick={() => setForm(it)} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">Edit</button>}
                      {canDelete && <button onClick={() => { if (window.confirm(`Delete "${it.itemName}" and its transactions?`)) del.mutate(it.id); }} className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">Delete</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <GeneralItemFormModal open={form !== undefined} onClose={() => setForm(undefined)} item={form || null} />
      <GeneralItemTxModal open={!!tx} onClose={() => setTx(null)} item={tx?.item || null} />
      <GeneralItemLedgerModal open={!!ledger} onClose={() => setLedger(null)} itemId={ledger?.id} name={ledger?.itemName} />
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
