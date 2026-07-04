import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import Pagination from '../../components/ui/Pagination.jsx';
import ReceiveModal from './ReceiveModal.jsx';
import { useVehicles, usePermissions } from '../../lib/hooks.js';
import { useDebounce } from '../../lib/useDebounce.js';
import { fmtDate, num } from '../../lib/format.js';

const PAGE_SIZE = 25;

// Receiving Desk: the MRN lines still awaiting delivery, with a one-click
// "Receive" action that records a delivery against the line.
export default function Receiving() {
  const { canWrite } = usePermissions();
  const { data: vehicles = [] } = useVehicles();

  const [search, setSearch] = useState('');
  const [vehicle, setVehicle] = useState('all');
  const [page, setPage] = useState(1);
  const [receiveItem, setReceiveItem] = useState(null);

  const debSearch = useDebounce(search, 350);
  const params = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
    filter: 'pending-delivery',
    sort: 'reqDate',
    order: 'asc',
  });
  if (debSearch) params.set('search', debSearch);
  if (vehicle !== 'all') params.set('vehicle', vehicle);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['items', 'receiving', { s: debSearch, vehicle, page }],
    queryFn: () => api.get(`/items?${params.toString()}`),
    placeholderData: keepPreviousData,
  });
  const items = data?.items || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Receiving Desk</h1>
          <p className="text-sm text-slate-500">MRN lines awaiting delivery — record goods as they arrive.</p>
        </div>
        <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
          <span className="font-bold">{data?.total ?? '—'}</span> lines pending delivery
        </div>
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search item, MRN, vehicle…"
          className="input max-w-xs flex-1"
        />
        <select className="input max-w-[14rem]" value={vehicle} onChange={(e) => { setVehicle(e.target.value); setPage(1); }}>
          <option value="all">All vehicles</option>
          {vehicles.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error.message}</div>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">MRN</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Vehicle</th>
              <th className="px-3 py-3">Item</th>
              <th className="px-3 py-3 text-right">Req</th>
              <th className="px-3 py-3 text-right">Recd</th>
              <th className="px-3 py-3 text-right">Outstanding</th>
              <th className="px-3 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>}
            {!isLoading && items.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Nothing pending delivery. 🎉</td></tr>
            )}
            {items.map((it) => {
              const outstanding = Math.max(0, Number(it.reqQty) - Number(it.recQty));
              return (
                <tr key={it.id} className="hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700">{it.mrnNum || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">{fmtDate(it.reqDateISO || it.reqDate)}</td>
                  <td className="px-3 py-2 text-slate-600">{it.vehicleMachinery || '—'}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{it.itemName}</div>
                    {it.itemDesc && <div className="text-xs text-slate-400">{it.itemDesc}</div>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{num(it.reqQty)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{num(it.recQty)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-amber-600">{num(outstanding)}</td>
                  <td className="px-3 py-2 text-right">
                    {canWrite ? (
                      <button
                        onClick={() => setReceiveItem(it)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Receive
                      </button>
                    ) : (
                      <span className="text-xs text-slate-300">read-only</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{isFetching ? 'Updating…' : ''}</span>
        <Pagination page={data?.page || 1} totalPages={data?.totalPages || 1} total={data?.total} onPage={setPage} />
      </div>

      <ReceiveModal open={!!receiveItem} onClose={() => setReceiveItem(null)} item={receiveItem} />
    </div>
  );
}
