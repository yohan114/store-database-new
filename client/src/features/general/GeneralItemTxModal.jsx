import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import Modal from '../../components/ui/Modal.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useVehicles } from '../../lib/hooks.js';
import { num } from '../../lib/format.js';

const today = () => new Date().toISOString().slice(0, 10);
const TYPES = ['Receive', 'Issue', 'Transfer'];

// Logs a stock movement against a general item (maintains a running balance).
// Pass `item` to bind to a row, or leave it null to let the user pick the item
// here (searchable, with rack + live balance) without hunting the table first.
export default function GeneralItemTxModal({ open, onClose, item }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: vehicles = [] } = useVehicles();
  const { data: racks = [] } = useQuery({ queryKey: ['gi-racks'], queryFn: () => api.get('/general-items/racks'), staleTime: 60_000 });
  const needsPicker = open && !item;
  const { data: allItems = [] } = useQuery({
    queryKey: ['general-items', 'picker'],
    queryFn: () => api.get('/general-items'),
    enabled: needsPicker,
    staleTime: 30_000,
  });
  const [pickedId, setPickedId] = useState('');
  const [pickSearch, setPickSearch] = useState('');
  const [f, setF] = useState({});

  useEffect(() => {
    if (open) {
      setF({ txType: 'Receive', txDate: today(), qty: '', mrnNum: '', grnNum: '', vehicleMachinery: '', remarks: '', transferredToRack: '', issuedTo: '', issuedBy: '' });
      setPickedId('');
      setPickSearch('');
    }
  }, [open, item]);

  const picked = item || allItems.find((it) => it.id === Number(pickedId)) || null;

  const pickerMatches = useMemo(() => {
    if (!needsPicker) return [];
    const needle = pickSearch.trim().toLowerCase();
    const pool = needle
      ? allItems.filter((it) =>
          [it.itemName, it.partNumber, it.rackNumber, it.specification].some((v) => (v || '').toLowerCase().includes(needle)))
      : allItems;
    return pool.slice(0, 40);
  }, [needsPicker, allItems, pickSearch]);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const tx = useMutation({
    mutationFn: () => api.post('/general-items/transaction', { ...f, itemId: picked.id, qty: Number(f.qty) || 0 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['general-items'] });
      qc.invalidateQueries({ queryKey: ['gi-stats'] });
      qc.invalidateQueries({ queryKey: ['gi-item', picked.id] });
      toast.success('Transaction recorded.');
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const isTransfer = f.txType === 'Transfer';
  const isIssue = f.txType === 'Issue';
  const qty = Number(f.qty) || 0;
  const stock = Number(picked?.currentStock) || 0;
  const balanceAfter = f.txType === 'Receive' ? stock + qty : stock - qty;
  const overIssue = (isIssue || isTransfer) && qty > stock;
  const valid = picked && f.txDate && qty > 0 && !overIssue && (!isTransfer || f.transferredToRack?.trim());

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={picked ? `Stock movement — ${picked.itemName}` : 'Stock movement'}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={() => tx.mutate()} disabled={!valid || tx.isPending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {tx.isPending ? 'Saving…' : 'Record'}
          </button>
        </>
      }
    >
      {needsPicker && (
        <div className="mb-4 space-y-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Item *</span>
            <input
              className="input"
              value={pickSearch}
              onChange={(e) => { setPickSearch(e.target.value); setPickedId(''); }}
              placeholder="Search item, part no, rack…"
              autoFocus
            />
          </label>
          {!picked && (
            <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200">
              {pickerMatches.length === 0 && <div className="px-3 py-4 text-center text-xs text-slate-400">No matching items.</div>}
              {pickerMatches.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => { setPickedId(String(it.id)); setPickSearch(it.itemName); }}
                  className="flex w-full items-center justify-between gap-2 border-b border-slate-50 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50"
                >
                  <span>
                    <span className="font-medium text-slate-700">{it.itemName}</span>
                    <span className="ml-2 text-xs text-slate-400">Rack {it.rackNumber || '—'}{it.partNumber ? ` · ${it.partNumber}` : ''}</span>
                  </span>
                  <span className={`whitespace-nowrap text-xs font-semibold tabular-nums ${it.currentStock > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {num(it.currentStock)} {it.unit}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {picked && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span>Rack <span className="font-semibold">{picked.rackNumber || '—'}</span></span>
          <span>current stock <span className="font-semibold text-slate-800">{num(stock)}</span> {picked.unit}</span>
          {qty > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${overIssue ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
              balance after: {num(balanceAfter)}
            </span>
          )}
        </div>
      )}
      {overIssue && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700">
          Only {num(stock)} {picked?.unit} in stock — cannot {f.txType.toLowerCase()} {num(qty)}.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Type">
          <select className="input" value={f.txType} onChange={set('txType')}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Date"><input type="date" className="input" value={f.txDate} onChange={set('txDate')} /></Field>
        <Field label="Quantity *"><input type="number" step="any" className="input" value={f.qty} onChange={set('qty')} /></Field>
        {isTransfer ? (
          <Field label="To rack *">
            <input className="input" list="gi-tx-racks" value={f.transferredToRack} onChange={set('transferredToRack')} placeholder="destination rack" />
            <datalist id="gi-tx-racks">{racks.map((r) => <option key={r} value={r} />)}</datalist>
          </Field>
        ) : (
          <Field label="Vehicle / Machinery">
            <input className="input" list="gi-tx-vehicles" value={f.vehicleMachinery} onChange={set('vehicleMachinery')} />
            <datalist id="gi-tx-vehicles">{vehicles.map((v) => <option key={v} value={v} />)}</datalist>
          </Field>
        )}
        {isIssue && (
          <>
            <Field label="Issued to">
              <input className="input" value={f.issuedTo} onChange={set('issuedTo')} placeholder="person / department receiving" />
            </Field>
            <Field label="Issued by">
              <input className="input" value={f.issuedBy} onChange={set('issuedBy')} placeholder="storekeeper" />
            </Field>
          </>
        )}
        <Field label="MRN number"><input className="input" value={f.mrnNum} onChange={set('mrnNum')} /></Field>
        <Field label="GRN number"><input className="input" value={f.grnNum} onChange={set('grnNum')} /></Field>
        <Field label="Remarks" className="sm:col-span-2"><input className="input" value={f.remarks} onChange={set('remarks')} /></Field>
      </div>
    </Modal>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
