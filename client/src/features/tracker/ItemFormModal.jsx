import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import Modal from '../../components/ui/Modal.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useVehicles, useCategories } from '../../lib/hooks.js';
import { toDateInput } from '../../lib/format.js';

const empty = { mrnNum: '', reqDate: '', vehicleMachinery: '', itemName: '', itemDesc: '', reqQty: '', category: '' };

export default function ItemFormModal({ open, onClose, item }) {
  const editing = !!item;
  const qc = useQueryClient();
  const toast = useToast();
  const { data: vehicles = [] } = useVehicles();
  const { data: cats } = useCategories();
  const [f, setF] = useState(empty);

  useEffect(() => {
    if (!open) return;
    setF(
      item
        ? {
            mrnNum: item.mrnNum || '',
            reqDate: toDateInput(item.reqDateISO || item.reqDate),
            vehicleMachinery: item.vehicleMachinery || '',
            itemName: item.itemName || '',
            itemDesc: item.itemDesc || '',
            reqQty: item.reqQty ?? '',
            category: item.category || '',
          }
        : empty
    );
  }, [open, item]);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, reqQty: Number(f.reqQty) || 0 };
      return editing ? api.put(`/items/${item.id}`, body) : api.post('/items', body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['sidebar-stats'] });
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success(editing ? 'MRN line updated.' : 'MRN line added.');
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const canSave = f.itemName.trim() && !save.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit MRN line #${item.id}` : 'Add MRN line'}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={!canSave}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add line'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="MRN number">
          <input className="input" value={f.mrnNum} onChange={set('mrnNum')} placeholder="e.g. MRN-1024" />
        </Field>
        <Field label="Request date">
          <input type="date" className="input" value={f.reqDate} onChange={set('reqDate')} />
        </Field>
        <Field label="Vehicle / Machinery">
          <input className="input" list="vehicle-options" value={f.vehicleMachinery} onChange={set('vehicleMachinery')} placeholder="e.g. Excavator 01" />
          <datalist id="vehicle-options">
            {vehicles.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </Field>
        <Field label="Quantity requested">
          <input type="number" step="any" className="input" value={f.reqQty} onChange={set('reqQty')} placeholder="0" />
        </Field>
        <Field label="Item name" className="sm:col-span-2">
          <input className="input" value={f.itemName} onChange={set('itemName')} placeholder="e.g. Hydraulic filter" autoFocus />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <input className="input" value={f.itemDesc} onChange={set('itemDesc')} placeholder="optional details / part no." />
        </Field>
        <Field label="Category" className="sm:col-span-2">
          <select className="input" value={f.category} onChange={set('category')}>
            <option value="">Auto-detect from item name</option>
            {(cats?.categories || []).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
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
