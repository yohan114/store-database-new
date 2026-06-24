import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import Pagination from '../../components/ui/Pagination.jsx';
import StockDetailModal from './StockDetailModal.jsx';
import { useCategories } from '../../lib/hooks.js';
import { useDebounce } from '../../lib/useDebounce.js';
import { num } from '../../lib/format.js';

const PAGE_SIZE = 25;

const STATUS = {
  instock: ['In stock', 'bg-emerald-100 text-emerald-700'],
  lowstock: ['Low stock', 'bg-amber-100 text-amber-700'],
  outstock: ['Out of stock', 'bg-slate-200 text-slate-600'],
  anomaly: ['Discrepancy', 'bg-rose-100 text-rose-700'],
};

const KPIS = [
  ['all', 'Total SKUs', 'totalSKUs', 'text-slate-700'],
  ['instock', 'In stock', 'inStock', 'text-emerald-600'],
  ['lowstock', 'Low stock', 'lowStock', 'text-amber-600'],
  ['outstock', 'Out of stock', 'outOfStock', 'text-slate-500'],
  ['anomaly', 'Discrepancies', 'discrepancies', 'text-rose-600'],
];

export default function Inventory() {
  const { data: cats } = useCategories();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('itemName');
  const [order, setOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);

  const debSearch = useDebounce(search, 350);
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sort, order });
  if (debSearch) params.set('search', debSearch);
  if (category !== 'all') params.set('category', category);
  if (status !== 'all') params.set('status', status);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['inventory', { s: debSearch, category, status, sort, order, page }],
    queryFn: () => api.get(`/inventory?${params.toString()}`),
    placeholderData: keepPreviousData,
  });
  const rows = data?.items || [];
  const kpis = data?.kpis || {};

  const sortBy = (k) => {
    if (sort === k) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSort(k); setOrder('asc'); }
    setPage(1);
  };
  const Arrow = ({ k }) => (sort === k ? <span className="text-brand-500">{order === 'asc' ? '▲' : '▼'}</span> : null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Inventory / Stock</h1>
        <p className="text-sm text-slate-500">Live stock = total received − total issued, by item.</p>
      </div>

      {/* KPI cards double as status filters */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {KPIS.map(([key, label, kpiKey, color]) => (
          <button
            key={key}
            onClick={() => { setStatus(key); setPage(1); }}
            className={`rounded-xl border bg-white p-4 text-left transition hover:shadow-md ${status === key ? 'border-brand-400 ring-2 ring-brand-100' : 'border-slate-200'}`}
          >
            <div className="text-xs font-medium text-slate-500">{label}</div>
            <div className={`mt-1 text-2xl font-bold ${color}`}>{num(kpis[kpiKey] ?? 0)}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search item or category…" className="input max-w-xs flex-1" />
        <select className="input max-w-[14rem]" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
          <option value="all">All categories</option>
          {(cats?.categories || []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {status !== 'all' && (
          <button onClick={() => { setStatus('all'); setPage(1); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50">
            Clear status: {STATUS[status]?.[0]} ✕
          </button>
        )}
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error.message}</div>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <Th onClick={() => sortBy('itemName')}>Item <Arrow k="itemName" /></Th>
              <Th onClick={() => sortBy('category')}>Category <Arrow k="category" /></Th>
              <Th onClick={() => sortBy('totalReceived')} className="text-right">Received <Arrow k="totalReceived" /></Th>
              <Th onClick={() => sortBy('totalIssued')} className="text-right">Issued <Arrow k="totalIssued" /></Th>
              <Th onClick={() => sortBy('currentStock')} className="text-right">Stock <Arrow k="currentStock" /></Th>
              <Th onClick={() => sortBy('status')}>Status <Arrow k="status" /></Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No items found.</td></tr>}
            {rows.map((r) => {
              const [label, cls] = STATUS[r.status] || ['—', 'bg-slate-100 text-slate-500'];
              return (
                <tr key={r.cleanName} onClick={() => setDetail(r)} className="cursor-pointer hover:bg-slate-50/60">
                  <td className="px-3 py-2 font-medium text-slate-800">{r.itemName}</td>
                  <td className="px-3 py-2"><span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{r.category}</span></td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{num(r.totalReceived)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{num(r.totalIssued)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800">{num(r.currentStock)}</td>
                  <td className="px-3 py-2"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{isFetching ? 'Updating…' : 'Click a row for movement history'}</span>
        <Pagination page={data?.page || 1} totalPages={Math.max(1, Math.ceil((data?.total || 0) / PAGE_SIZE))} total={data?.total} onPage={setPage} />
      </div>

      <StockDetailModal open={!!detail} onClose={() => setDetail(null)} row={detail} />
    </div>
  );
}

function Th({ children, onClick, className = '' }) {
  return (
    <th onClick={onClick} className={`cursor-pointer select-none px-3 py-3 hover:text-slate-700 ${className}`}>
      <span className="inline-flex items-center gap-1">{children}</span>
    </th>
  );
}
