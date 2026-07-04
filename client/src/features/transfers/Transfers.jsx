import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { useToast } from '../../components/ui/Toast.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import TransferFormModal from './TransferFormModal.jsx';
import { usePermissions } from '../../lib/hooks.js';
import { useDebounce } from '../../lib/useDebounce.js';
import { fmtDate, num } from '../../lib/format.js';

const PAGE_SIZE = 25;

export default function Transfers() {
  const qc = useQueryClient();
  const toast = useToast();
  const { canWrite, canDelete } = usePermissions();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(undefined);

  const debSearch = useDebounce(search, 350);
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (debSearch) params.set('search', debSearch);

  const { data: stats } = useQuery({ queryKey: ['transfer-stats'], queryFn: () => api.get('/transfer-stats') });
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['transfers', { s: debSearch, page }],
    queryFn: () => api.get(`/transfers?${params.toString()}`),
    placeholderData: keepPreviousData,
  });
  const rows = data?.items || [];

  const del = useMutation({
    mutationFn: (id) => api.del(`/transfers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] });
      qc.invalidateQueries({ queryKey: ['transfer-stats'] });
      toast.success('Transfer deleted.');
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Material Transfers</h1>
          <p className="text-sm text-slate-500">Items moved between stores, racks and locations (MTN).</p>
        </div>
        {canWrite && <button onClick={() => setForm(null)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">+ Record transfer</button>}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total transfers" value={stats?.total ?? 0} />
        <Stat label="Total quantity" value={num(stats?.totalQty ?? 0)} />
        <Stat label="This month" value={stats?.thisMonth ?? 0} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search MTN, item, from/to, person…" className="input max-w-md" />
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error.message}</div>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">MTN</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Item</th>
              <th className="px-3 py-3 text-right">Qty</th>
              <th className="px-3 py-3">From → To</th>
              <th className="px-3 py-3">By</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No transfers found.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className="px-3 py-2 font-medium text-slate-700">{r.mtnNum}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">{fmtDate(r.transferDateISO || r.transferDate)}</td>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-800">{r.itemName}</div>
                  {r.itemDesc && <div className="text-xs text-slate-400">{r.itemDesc}</div>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">{num(r.qty)}</td>
                <td className="px-3 py-2 text-slate-600">
                  <span className="text-slate-500">{r.fromLocation || '—'}</span> → <span className="font-medium">{r.toLocation || '—'}</span>
                </td>
                <td className="px-3 py-2 text-slate-500">{r.transferredBy || '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    {canWrite && <button onClick={() => setForm(r)} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">Edit</button>}
                    {canDelete && <button onClick={() => { if (window.confirm(`Delete transfer ${r.mtnNum}?`)) del.mutate(r.id); }} className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">Delete</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{isFetching ? 'Updating…' : ''}</span>
        <Pagination page={data?.page || 1} totalPages={data?.totalPages || 1} total={data?.total} onPage={setPage} />
      </div>

      <TransferFormModal open={form !== undefined} onClose={() => setForm(undefined)} transfer={form || null} />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-700">{value}</div>
    </div>
  );
}
