import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import Modal from '../../components/ui/Modal.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useVehicles, useCategories } from '../../lib/hooks.js';
import { toDateInput } from '../../lib/format.js';

const today = () => new Date().toISOString().slice(0, 10);
const blank = () => ({ transferDate: today(), mtnNum: '', itemName: '', itemDesc: '', qty: '', category: '', fromLocation: '', toLocation: '', transferredBy: '', receivedBy: '', mrnNum: '', notes: '' });

export default function TransferFormModal({ open, onClose, transfer }) {
  const editing = !!transfer;
  const qc = useQueryClient();
  const toast = useToast();
  const { data: vehicles = [] } = useVehicles();
  const { data: cats } = useCategories();
  const [f, setF] = useState(blank());

  useEffect(() => {
    if (!open) return;
    setF(transfer ? {
      transferDate: toDateInput(transfer.transferDateISO || transfer.transferDate),
      mtnNum: transfer.mtnNum || '', itemName: transfer.itemName || '', itemDesc: transfer.itemDesc || '',
      qty: transfer.qty ?? '', category: transfer.category || '', fromLocation: transfer.fromLocation || '',
      toLocation: transfer.toLocation || '', transferredBy: transfer.transferredBy || '', receivedBy: transfer.receivedBy || '',
      mrnNum: transfer.mrnNum || '', notes: transfer.notes || '',
    } : blank());
  }, [open, transfer]);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, qty: Number(f.qty) || 0 };
      return editing ? api.put(`/transfers/${transfer.id}`, body) : api.post('/transfers', body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] });
      qc.invalidateQueries({ queryKey: ['transfer-stats'] });
      toast.success(editing ? 'Transfer updated.' : 'Transfer recorded.');
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const canSave = f.mtnNum.trim() && f.itemName.trim() && !save.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit transfer ${transfer.mtnNum}` : 'Record material transfer'}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={() => save.mutate()} disabled={!canSave} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Record transfer'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="MTN number *"><input className="input" value={f.mtnNum} onChange={set('mtnNum')} autoFocus /></Field>
        <Field label="Transfer date"><input type="date" className="input" value={f.transferDate} onChange={set('transferDate')} /></Field>
        <Field label="Item name *" className="sm:col-span-2"><input className="input" value={f.itemName} onChange={set('itemName')} /></Field>
        <Field label="Description" className="sm:col-span-2"><input className="input" value={f.itemDesc} onChange={set('itemDesc')} /></Field>
        <Field label="Quantity"><input type="number" step="any" className="input" value={f.qty} onChange={set('qty')} /></Field>
        <Field label="Category">
          <select className="input" value={f.category} onChange={set('category')}>
            <option value="">Auto-detect</option>
            {(cats?.categories || []).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="From location">
          <input className="input" list="xfer-locs" value={f.fromLocation} onChange={set('fromLocation')} />
        </Field>
        <Field label="To location">
          <input className="input" list="xfer-locs" value={f.toLocation} onChange={set('toLocation')} />
        </Field>
        <datalist id="xfer-locs">{vehicles.map((v) => <option key={v} value={v} />)}</datalist>
        <Field label="Transferred by"><input className="input" value={f.transferredBy} onChange={set('transferredBy')} /></Field>
        <Field label="Received by"><input className="input" value={f.receivedBy} onChange={set('receivedBy')} /></Field>
        <Field label="MRN number"><input className="input" value={f.mrnNum} onChange={set('mrnNum')} /></Field>
        <Field label="Notes"><input className="input" value={f.notes} onChange={set('notes')} /></Field>
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
