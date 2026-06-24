import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { useToast } from '../../components/ui/Toast.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import IssueFormModal from './IssueFormModal.jsx';
import { useVehicles, useCategories, usePermissions } from '../../lib/hooks.js';
import { useDebounce } from '../../lib/useDebounce.js';
import { fmtDate, num } from '../../lib/format.js';

const PAGE_SIZE = 25;

// Issued Items: the register of items issued out, plus the "Issue item" action.
export default function Issued() {
  const qc = useQueryClient();
  const toast = useToast();
  const { canWrite, canDelete } = usePermissions();
  const { data: vehicles = [] } = useVehicles();
  const { data: cats } = useCategories();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [vehicle, setVehicle] = useState('all');
  const [page, setPage] = useState(1);
  const [formIssue, setFormIssue] = useState(undefined); // undefined = closed

  const debSearch = useDebounce(search, 350);
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (debSearch) params.set('search', debSearch);
  if (category !== 'all') params.set('category', category);
  if (vehicle !== 'all') params.set('vehicle', vehicle);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['issues', { s: debSearch, category, vehicle, page }],
    queryFn: () => api.get(`/issues?${params.toString()}`),
    placeholderData: keepPreviousData,
  });
  const rows = data?.items || [];

  const del = useMutation({
    mutationFn: (id) => api.del(`/issues/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issues'] });
      qc.invalidateQueries({ queryKey: ['sidebar-stats'] });
      toast.success('Issue deleted.');
    },
    onError: (e) => toast.error(e.message),
  });

  const onFilter = (setter) => (v) => { setter(v); setPage(1); };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Issued Items</h1>
          <p className="text-sm text-slate-500">Items issued out to vehicles, machinery and sections.</p>
        </div>
        {canWrite && (
          <button onClick={() => setFormIssue(null)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            + Issue item
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <input value={search} onChange={(e) => onFilter(setSearch)(e.target.value)} placeholder="Search item, vehicle, issued to / by, MRN…" className="input max-w-xs flex-1" />
        <select className="input max-w-[12rem]" value={category} onChange={(e) => onFilter(setCategory)(e.target.value)}>
          <option value="all">All categories</option>
          {(cats?.categories || []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input max-w-[12rem]" value={vehicle} onChange={(e) => onFilter(setVehicle)(e.target.value)}>
          <option value="all">All vehicles</option>
          {vehicles.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error.message}</div>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Vehicle</th>
              <th className="px-3 py-3">Item</th>
              <th className="px-3 py-3">Category</th>
              <th className="px-3 py-3 text-right">Qty</th>
              <th className="px-3 py-3">Issued to</th>
              <th className="px-3 py-3">Issued by</th>
              <th className="px-3 py-3">MRN</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">No issued items found.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">{fmtDate(r.issueDateISO || r.issueDate)}</td>
                <td className="px-3 py-2 text-slate-600">{r.vehicleMachinery || '—'}</td>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-800">{r.itemName}</div>
                  {r.itemDesc && <div className="text-xs text-slate-400">{r.itemDesc}</div>}
                </td>
                <td className="px-3 py-2"><span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{r.category || '—'}</span></td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">{num(r.qty)}</td>
                <td className="px-3 py-2 text-slate-600">{r.issuedTo || '—'}</td>
                <td className="px-3 py-2 text-slate-600">{r.issuedBy || '—'}</td>
                <td className="px-3 py-2 text-slate-600">{r.mrnNum || '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    {canWrite && <button onClick={() => setFormIssue(r)} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">Edit</button>}
                    {canDelete && <button onClick={() => { if (window.confirm(`Delete this issue of "${r.itemName}"?`)) del.mutate(r.id); }} className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">Delete</button>}
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

      <IssueFormModal open={formIssue !== undefined} onClose={() => setFormIssue(undefined)} issue={formIssue || null} />
    </div>
  );
}
