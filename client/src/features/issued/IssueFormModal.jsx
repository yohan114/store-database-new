import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import Modal from '../../components/ui/Modal.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useVehicles, useCategories } from '../../lib/hooks.js';
import { toDateInput } from '../../lib/format.js';

const today = () => new Date().toISOString().slice(0, 10);
const blank = () => ({
  issueDate: today(), vehicleMachinery: '', itemName: '', itemDesc: '', qty: '',
  category: '', issuedTo: '', issuedBy: '', mrnNum: '', purchaseSource: '', notes: '',
});

export default function IssueFormModal({ open, onClose, issue }) {
  const editing = !!issue;
  const qc = useQueryClient();
  const toast = useToast();
  const { data: vehicles = [] } = useVehicles();
  const { data: cats } = useCategories();
  const [f, setF] = useState(blank());

  useEffect(() => {
    if (!open) return;
    setF(
      issue
        ? {
            issueDate: toDateInput(issue.issueDateISO || issue.issueDate),
            vehicleMachinery: issue.vehicleMachinery || '',
            itemName: issue.itemName || '',
            itemDesc: issue.itemDesc || '',
            qty: issue.qty ?? '',
            category: issue.category || '',
            issuedTo: issue.issuedTo || '',
            issuedBy: issue.issuedBy || '',
            mrnNum: issue.mrnNum || '',
            purchaseSource: issue.purchaseSource || '',
            notes: issue.notes || '',
          }
        : blank()
    );
  }, [open, issue]);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, qty: Number(f.qty) || 0 };
      return editing ? api.put(`/issues/${issue.id}`, body) : api.post('/issues', body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issues'] });
      qc.invalidateQueries({ queryKey: ['sidebar-stats'] });
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success(editing ? 'Issue updated.' : 'Item issued.');
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const canSave = f.itemName.trim() && Number(f.qty) > 0 && !save.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit issue #${issue.id}` : 'Issue item out'}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={() => save.mutate()} disabled={!canSave} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Issue item'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Issue date">
          <input type="date" className="input" value={f.issueDate} onChange={set('issueDate')} />
        </Field>
        <Field label="Quantity *">
          <input type="number" step="any" className="input" value={f.qty} onChange={set('qty')} placeholder="0" />
        </Field>
        <Field label="Item name *" className="sm:col-span-2">
          <input className="input" value={f.itemName} onChange={set('itemName')} placeholder="e.g. Hydraulic filter" autoFocus />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <input className="input" value={f.itemDesc} onChange={set('itemDesc')} placeholder="optional details / part no." />
        </Field>
        <Field label="Vehicle / Machinery">
          <input className="input" list="issue-vehicles" value={f.vehicleMachinery} onChange={set('vehicleMachinery')} placeholder="issued to which machine" />
          <datalist id="issue-vehicles">
            {vehicles.map((v) => <option key={v} value={v} />)}
          </datalist>
        </Field>
        <Field label="Category">
          <select className="input" value={f.category} onChange={set('category')}>
            <option value="">Auto-detect</option>
            {(cats?.categories || []).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Issued to">
          <input className="input" value={f.issuedTo} onChange={set('issuedTo')} placeholder="person / section" />
        </Field>
        <Field label="Issued by">
          <input className="input" value={f.issuedBy} onChange={set('issuedBy')} placeholder="storekeeper" />
        </Field>
        <Field label="MRN number">
          <input className="input" value={f.mrnNum} onChange={set('mrnNum')} />
        </Field>
        <Field label="Purchase source">
          <input className="input" value={f.purchaseSource} onChange={set('purchaseSource')} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <input className="input" value={f.notes} onChange={set('notes')} />
        </Field>
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
