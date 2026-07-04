import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import Modal from '../../components/ui/Modal.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useVehicles } from '../../lib/hooks.js';
import { toDateInput } from '../../lib/format.js';

const CONDITIONS = ['New', 'Old', 'Expired'];
const STATES = ['In Store', 'Installed', 'Disposed'];
const blank = () => ({ serialNumber: '', itemName: 'Battery', brand: '', itemDesc: '', condition: 'New', state: 'In Store', currentVehicle: '', purchaseDate: '', expiryDate: '', notes: '' });

export default function BatteryFormModal({ open, onClose, battery }) {
  const editing = !!battery;
  const qc = useQueryClient();
  const toast = useToast();
  const { data: vehicles = [] } = useVehicles();
  const [f, setF] = useState(blank());

  useEffect(() => {
    if (!open) return;
    setF(
      battery
        ? {
            serialNumber: battery.serialNumber || '', itemName: battery.itemName || 'Battery', brand: battery.brand || '',
            itemDesc: battery.itemDesc || '', condition: battery.condition || 'New', state: battery.state || 'In Store',
            currentVehicle: battery.currentVehicle || '', purchaseDate: toDateInput(battery.purchaseDateISO || battery.purchaseDate),
            expiryDate: toDateInput(battery.expiryDateISO || battery.expiryDate), notes: battery.notes || '',
          }
        : blank()
    );
  }, [open, battery]);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => (editing ? api.put(`/batteries/${battery.id}`, f) : api.post('/batteries', f)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batteries'] });
      qc.invalidateQueries({ queryKey: ['battery-stats'] });
      toast.success(editing ? 'Battery updated.' : 'Battery registered.');
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit battery ${battery.serialNumber}` : 'Register battery'}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={() => save.mutate()} disabled={!f.serialNumber.trim() || save.isPending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Register'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Serial number *"><input className="input" value={f.serialNumber} onChange={set('serialNumber')} autoFocus /></Field>
        <Field label="Brand"><input className="input" value={f.brand} onChange={set('brand')} placeholder="e.g. Exide" /></Field>
        <Field label="Item name"><input className="input" value={f.itemName} onChange={set('itemName')} /></Field>
        <Field label="Specification / description"><input className="input" value={f.itemDesc} onChange={set('itemDesc')} placeholder="e.g. 12V 100Ah" /></Field>
        <Field label="Condition">
          <select className="input" value={f.condition} onChange={set('condition')}>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="State">
          <select className="input" value={f.state} onChange={set('state')}>{STATES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        {f.state === 'Installed' && (
          <Field label="Installed on vehicle" className="sm:col-span-2">
            <input className="input" list="batt-vehicles" value={f.currentVehicle} onChange={set('currentVehicle')} />
            <datalist id="batt-vehicles">{vehicles.map((v) => <option key={v} value={v} />)}</datalist>
          </Field>
        )}
        <Field label="Purchase date"><input type="date" className="input" value={f.purchaseDate} onChange={set('purchaseDate')} /></Field>
        <Field label="Expiry date"><input type="date" className="input" value={f.expiryDate} onChange={set('expiryDate')} /></Field>
        <Field label="Notes" className="sm:col-span-2"><input className="input" value={f.notes} onChange={set('notes')} /></Field>
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
