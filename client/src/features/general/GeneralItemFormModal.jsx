import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import Modal from '../../components/ui/Modal.jsx';
import { useToast } from '../../components/ui/Toast.jsx';

const UNITS = ['Pcs', 'Set', 'Box', 'Pair', 'Litre', 'Kg', 'Metre', 'Roll'];
const blank = () => ({ itemName: '', partNumber: '', category: 'General Items', specification: '', unit: 'Pcs', rackNumber: '', minStock: '', notes: '' });

export default function GeneralItemFormModal({ open, onClose, item }) {
  const editing = !!item;
  const qc = useQueryClient();
  const toast = useToast();
  const { data: racks = [] } = useQuery({ queryKey: ['gi-racks'], queryFn: () => api.get('/general-items/racks'), staleTime: 60_000 });
  const { data: subcats = [] } = useQuery({ queryKey: ['gi-subcats'], queryFn: () => api.get('/general-items/subcategories'), staleTime: 60_000 });
  const [f, setF] = useState(blank());

  useEffect(() => {
    if (!open) return;
    setF(item ? {
      itemName: item.itemName || '', partNumber: item.partNumber || '', category: item.category || 'General Items',
      specification: item.specification || '', unit: item.unit || 'Pcs', rackNumber: item.rackNumber || '',
      minStock: item.minStock ?? '', notes: item.notes || '',
    } : blank());
  }, [open, item]);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, minStock: Number(f.minStock) || 0 };
      return editing ? api.put(`/general-items/${item.id}`, body) : api.post('/general-items', body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['general-items'] });
      qc.invalidateQueries({ queryKey: ['gi-stats'] });
      qc.invalidateQueries({ queryKey: ['gi-racks'] });
      toast.success(editing ? 'Item updated.' : 'Item registered.');
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${item.itemName}` : 'Register general item'}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={() => save.mutate()} disabled={!f.itemName.trim() || save.isPending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Register'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Item name *" className="sm:col-span-2"><input className="input" value={f.itemName} onChange={set('itemName')} autoFocus /></Field>
        <Field label="Part number"><input className="input" value={f.partNumber} onChange={set('partNumber')} /></Field>
        <Field label="Rack number">
          <input className="input" list="gi-rack-list" value={f.rackNumber} onChange={set('rackNumber')} placeholder="e.g. 13A" />
          <datalist id="gi-rack-list">{racks.map((r) => <option key={r} value={r} />)}</datalist>
        </Field>
        <Field label="Category">
          <input className="input" list="gi-cat-list" value={f.category} onChange={set('category')} />
          <datalist id="gi-cat-list">{subcats.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Unit">
          <input className="input" list="gi-unit-list" value={f.unit} onChange={set('unit')} />
          <datalist id="gi-unit-list">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
        </Field>
        <Field label="Specification" className="sm:col-span-2"><input className="input" value={f.specification} onChange={set('specification')} /></Field>
        <Field label="Minimum stock (reorder level)"><input type="number" step="any" className="input" value={f.minStock} onChange={set('minStock')} /></Field>
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
