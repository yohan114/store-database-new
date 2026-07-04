import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import Pagination from '../../components/ui/Pagination.jsx';
import PriceModal from './PriceModal.jsx';
import { usePermissions } from '../../lib/hooks.js';
import { useDebounce } from '../../lib/useDebounce.js';
import { fmtDate, num } from '../../lib/format.js';

const PAGE_SIZE = 25;

// Pricing & GRN: received lines that still have an unpriced receipt. Storekeepers
// fill in the unit price plus GRN / invoice details.
export default function Pricing() {
  const { canWrite } = usePermissions();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [priceItem, setPriceItem] = useState(null);

  const debSearch = useDebounce(search, 350);
  const params = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
    filter: 'pending-pricing',
    sort: 'recQty',
    order: 'desc',
  });
  if (debSearch) params.set('search', debSearch);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['items', 'pricing', { s: debSearch, page }],
    queryFn: () => api.get(`/items?${params.toString()}`),
    placeholderData: keepPreviousData,
  });
  const items = data?.items || [];
  const unpricedCount = (it) => (it.receipts || []).filter((r) => !r.unitPrice).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pricing &amp; GRN</h1>
          <p className="text-sm text-slate-500">Received lines awaiting a unit price and GRN / invoice details.</p>
        </div>
        <div className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">
          <span className="font-bold">{data?.total ?? '—'}</span> lines awaiting pricing
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search item, MRN, vehicle, supplier, GRN…"
          className="input max-w-md"
        />
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error.message}</div>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">MRN</th>
              <th className="px-3 py-3">Last delivery</th>
              <th className="px-3 py-3">Vehicle</th>
              <th className="px-3 py-3">Item</th>
              <th className="px-3 py-3 text-right">Recd qty</th>
              <th className="px-3 py-3 text-center">Unpriced</th>
              <th className="px-3 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>}
            {!isLoading && items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Nothing awaiting pricing. 🎉</td></tr>
            )}
            {items.map((it) => (
              <tr key={it.id} className="hover:bg-slate-50/60">
                <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700">{it.mrnNum || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">{fmtDate(it.recDateISO)}</td>
                <td className="px-3 py-2 text-slate-600">{it.vehicleMachinery || '—'}</td>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-800">{it.itemName}</div>
                  {it.itemDesc && <div className="text-xs text-slate-400">{it.itemDesc}</div>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">{num(it.recQty)}</td>
                <td className="px-3 py-2 text-center">
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">{unpricedCount(it)}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  {canWrite ? (
                    <button
                      onClick={() => setPriceItem(it)}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                    >
                      Price
                    </button>
                  ) : (
                    <span className="text-xs text-slate-300">read-only</span>
                  )}
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

      <PriceModal open={!!priceItem} onClose={() => setPriceItem(null)} item={priceItem} />
    </div>
  );
}
