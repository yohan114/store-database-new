import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import Modal from '../../components/ui/Modal.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useVehicles } from '../../lib/hooks.js';
import { num } from '../../lib/format.js';

const today = () => new Date().toISOString().slice(0, 10);
const TYPES = ['Receive', 'Issue', 'Transfer'];

// Logs a stock movement against a general item (maintains a running balance).
export default function GeneralItemTxModal({ open, onClose, item }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: vehicles = [] } = useVehicles();
  const { data: racks = [] } = useQuery({ queryKey: ['gi-racks'], queryFn: () => api.get('/general-items/racks'), staleTime: 60_000 });
  const [f, setF] = useState({});

  useEffect(() => {
    if (open && item) {
      setF({ txType: 'Receive', txDate: today(), qty: '', mrnNum: '', grnNum: '', vehicleMachinery: '', remarks: '', transferredToRack: '' });
    }
  }, [open, item]);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const tx = useMutation({
    mutationFn: () => api.post('/general-items/transaction', { ...f, itemId: item.id, qty: Number(f.qty) || 0 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['general-items'] });
      qc.invalidateQueries({ queryKey: ['gi-stats'] });
      qc.invalidateQueries({ queryKey: ['gi-item', item.id] });
      toast.success('Transaction recorded.');
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!item) return null;
  const isTransfer = f.txType === 'Transfer';
  const valid = f.txDate && Number(f.qty) > 0 && (!isTransfer || f.transferredToRack?.trim());

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Stock movement — ${item.itemName}`}
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
      <div className="mb-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Rack <span className="font-semibold">{item.rackNumber || '—'}</span> · current stock{' '}
        <span className="font-semibold text-slate-800">{num(item.currentStock)}</span> {item.unit}
      </div>

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
