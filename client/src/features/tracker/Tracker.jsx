import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { useToast } from '../../components/ui/Toast.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import ItemFormModal from './ItemFormModal.jsx';
import { useVehicles, useCategories, usePermissions } from '../../lib/hooks.js';
import { useDebounce } from '../../lib/useDebounce.js';
import { fmtDate, num, rs } from '../../lib/format.js';

const PAGE_SIZE = 25;
const TABS = [
  ['', 'All'],
  ['pending-delivery', 'Pending delivery'],
  ['pending-pricing', 'Pending pricing'],
  ['completed', 'Completed'],
];

function statusOf(it) {
  if (Number(it.reqQty) > Number(it.recQty)) return ['Pending delivery', 'bg-amber-100 text-amber-700'];
  if (it.hasUnpriced) return ['Pending pricing', 'bg-rose-100 text-rose-700'];
  return ['Completed', 'bg-emerald-100 text-emerald-700'];
}

export default function Tracker() {
  const qc = useQueryClient();
  const toast = useToast();
  const { canWrite, canDelete } = usePermissions();
  const { data: vehicles = [] } = useVehicles();
  const { data: cats } = useCategories();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [vehicle, setVehicle] = useState('all');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('reqDate');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const [formItem, setFormItem] = useState(undefined); // undefined = closed

  const debSearch = useDebounce(search, 350);

  const params = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
    sort,
    order,
  });
  if (debSearch) params.set('search', debSearch);
  if (category !== 'all') params.set('category', category);
  if (vehicle !== 'all') params.set('vehicle', vehicle);
  if (filter) params.set('filter', filter);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['items', { s: debSearch, category, vehicle, filter, sort, order, page }],
    queryFn: () => api.get(`/items?${params.toString()}`),
    placeholderData: keepPreviousData,
  });

  const items = data?.items || [];

  const del = useMutation({
    mutationFn: (id) => api.del(`/items/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['sidebar-stats'] });
      toast.success('MRN line deleted.');
    },
    onError: (e) => toast.error(e.message),
  });

  const resetTo = (setter) => (v) => { setter(v); setPage(1); };

  const sortBy = (key) => {
    if (sort === key) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSort(key); setOrder('asc'); }
    setPage(1);
  };
  const Arrow = ({ k }) => (sort === k ? <span className="text-brand-500">{order === 'asc' ? '▲' : '▼'}</span> : null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">MRN Tracker</h1>
          <p className="text-sm text-slate-500">Material requests, their deliveries and pricing status.</p>
        </div>
        {canWrite && (
          <button
            onClick={() => setFormItem(null)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            + Add MRN
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => resetTo(setSearch)(e.target.value)}
            placeholder="Search item, MRN, vehicle, GRN, supplier…"
            className="input max-w-xs flex-1"
          />
          <select className="input max-w-[12rem]" value={category} onChange={(e) => resetTo(setCategory)(e.target.value)}>
            <option value="all">All categories</option>
            {(cats?.categories || []).map((c) => (
              <option key={c} value={c}>{c}{cats?.counts?.[c] ? ` (${cats.counts[c]})` : ''}</option>
            ))}
          </select>
          <select className="input max-w-[12rem]" value={vehicle} onChange={(e) => resetTo(setVehicle)(e.target.value)}>
            <option value="all">All vehicles</option>
            {vehicles.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-1">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => resetTo(setFilter)(key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                filter === key ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error.message}</div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-8 px-3 py-3"></th>
              <Th onClick={() => sortBy('mrnNum')}>MRN <Arrow k="mrnNum" /></Th>
              <Th onClick={() => sortBy('reqDate')}>Date <Arrow k="reqDate" /></Th>
              <Th onClick={() => sortBy('vehicleMachinery')}>Vehicle <Arrow k="vehicleMachinery" /></Th>
              <Th onClick={() => sortBy('itemName')}>Item <Arrow k="itemName" /></Th>
              <Th onClick={() => sortBy('category')}>Category <Arrow k="category" /></Th>
              <Th onClick={() => sortBy('reqQty')} className="text-right">Req <Arrow k="reqQty" /></Th>
              <Th onClick={() => sortBy('recQty')} className="text-right">Recd <Arrow k="recQty" /></Th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">No matching records.</td></tr>
            )}
            {items.map((it) => {
              const [label, cls] = statusOf(it);
              const isOpen = expanded === it.id;
              return (
                <FragmentRow
                  key={it.id}
                  it={it}
                  isOpen={isOpen}
                  label={label}
                  cls={cls}
                  onToggle={() => setExpanded(isOpen ? null : it.id)}
                  canWrite={canWrite}
                  canDelete={canDelete}
                  onEdit={() => setFormItem(it)}
                  onDelete={() => {
                    if (window.confirm(`Delete MRN line "${it.itemName}"? This also removes its ${it.recCount} receipt(s).`)) del.mutate(it.id);
                  }}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{isFetching ? 'Updating…' : ''}</span>
        <Pagination page={data?.page || 1} totalPages={data?.totalPages || 1} total={data?.total} onPage={setPage} />
      </div>

      <ItemFormModal open={formItem !== undefined} onClose={() => setFormItem(undefined)} item={formItem || null} />
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

function FragmentRow({ it, isOpen, label, cls, onToggle, canWrite, canDelete, onEdit, onDelete }) {
  return (
    <>
      <tr className="hover:bg-slate-50/60">
        <td className="px-3 py-2 text-center">
          <button onClick={onToggle} className="text-slate-400 hover:text-slate-700" title="Show receipts">
            {it.recCount > 0 ? (isOpen ? '▾' : '▸') : ''}
          </button>
        </td>
        <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700">{it.mrnNum || '—'}</td>
        <td className="whitespace-nowrap px-3 py-2 text-slate-500">{fmtDate(it.reqDateISO || it.reqDate)}</td>
        <td className="px-3 py-2 text-slate-600">{it.vehicleMachinery || '—'}</td>
        <td className="px-3 py-2">
          <div className="font-medium text-slate-800">{it.itemName}</div>
          {it.itemDesc && <div className="text-xs text-slate-400">{it.itemDesc}</div>}
        </td>
        <td className="px-3 py-2"><span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{it.category || '—'}</span></td>
        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{num(it.reqQty)}</td>
        <td className="px-3 py-2 text-right tabular-nums text-slate-700">{num(it.recQty)}</td>
        <td className="px-3 py-2"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span></td>
        <td className="px-3 py-2">
          <div className="flex justify-end gap-1">
            {canWrite && (
              <button onClick={onEdit} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">Edit</button>
            )}
            {canDelete && (
              <button onClick={onDelete} className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">Delete</button>
            )}
          </div>
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-slate-50/60">
          <td></td>
          <td colSpan={9} className="px-3 py-3">
            <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
              <span className="text-slate-500">Requested <span className="font-semibold text-slate-700">{num(it.reqQty)}</span></span>
              <span className="text-slate-500">Received <span className="font-semibold text-emerald-700">{num(it.recQty)}</span></span>
              <span className="text-slate-500">Issued <span className="font-semibold text-rose-700">{num(it.issuedQty || 0)}</span></span>
              <span className="text-slate-500">In stock <span className="font-semibold text-slate-800">{num((it.recQty || 0) - (it.issuedQty || 0))}</span></span>
            </div>
            <ReceiptsPanel receipts={it.receipts || []} />
          </td>
        </tr>
      )}
    </>
  );
}

function ReceiptsPanel({ receipts }) {
  if (!receipts.length) return <div className="text-xs text-slate-400">No receipts recorded.</div>;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-3 py-2">Delivered</th>
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="px-3 py-2">Supplier</th>
            <th className="px-3 py-2">GRN</th>
            <th className="px-3 py-2">Invoice</th>
            <th className="px-3 py-2 text-right">Unit price</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {receipts.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap px-3 py-1.5 text-slate-600">{fmtDate(r.deliveryDateISO || r.deliveryDate)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{num(r.qty)}</td>
              <td className="px-3 py-1.5 text-slate-600">{r.supplierName || '—'}</td>
              <td className="px-3 py-1.5 text-slate-600">{r.grnNumber || '—'}</td>
              <td className="px-3 py-1.5 text-slate-600">{r.invoiceNumber || '—'}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{r.unitPrice ? rs(r.unitPrice) : <span className="text-rose-500">unpriced</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
