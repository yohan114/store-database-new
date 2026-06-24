import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import Modal from '../../components/ui/Modal.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useVehicles } from '../../lib/hooks.js';

const today = () => new Date().toISOString().slice(0, 10);

// Movement types available depend on where the battery currently is.
function typesFor(state) {
  if (state === 'Installed') return ['Return', 'Transfer', 'Dispose'];
  if (state === 'In Store') return ['Issue', 'Dispose'];
  return [];
}

export default function BatteryMoveModal({ open, onClose, battery }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: vehicles = [] } = useVehicles();
  const types = useMemo(() => typesFor(battery?.state), [battery]);

  const [f, setF] = useState({});
  useEffect(() => {
    if (open && battery) {
      setF({
        movementType: typesFor(battery.state)[0] || 'Dispose',
        movementDate: today(),
        toVehicle: '',
        conditionAfter: '',
        issuedBy: '',
        mrnNum: '',
        notes: '',
        swapSerial: '',
        swapBrand: '',
      });
    }
  }, [open, battery]);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const needsVehicle = f.movementType === 'Issue' || f.movementType === 'Transfer';

  const move = useMutation({
    mutationFn: () => {
      const payload = {
        batteryId: battery.id,
        movementType: f.movementType,
        movementDate: f.movementDate,
        toVehicle: f.toVehicle,
        conditionAfter: f.conditionAfter || undefined,
        issuedBy: f.issuedBy,
        mrnNum: f.mrnNum,
        notes: f.notes,
      };
      if (needsVehicle && f.swapSerial.trim()) {
        payload.replaced = { serialNumber: f.swapSerial.trim(), brand: f.swapBrand, itemName: 'Battery' };
      }
      return api.post('/batteries/move', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['batteries'] });
      qc.invalidateQueries({ queryKey: ['battery-stats'] });
      toast.success('Movement recorded.');
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!battery) return null;
  const valid = f.movementType && f.movementDate && (!needsVehicle || f.toVehicle.trim());

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Move battery ${battery.serialNumber}`}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={() => move.mutate()} disabled={!valid || move.isPending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {move.isPending ? 'Saving…' : 'Record movement'}
          </button>
        </>
      }
    >
      <div className="mb-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Currently <span className="font-semibold">{battery.state}</span>
        {battery.currentVehicle ? <> on <span className="font-semibold">{battery.currentVehicle}</span></> : null} · condition{' '}
        <span className="font-semibold">{battery.condition}</span>
      </div>

      {types.length === 0 ? (
        <div className="text-sm text-slate-500">This battery is disposed — no further movements are possible.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Movement">
            <select className="input" value={f.movementType} onChange={set('movementType')}>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Date"><input type="date" className="input" value={f.movementDate} onChange={set('movementDate')} /></Field>

          {needsVehicle && (
            <Field label="To vehicle *" className="sm:col-span-2">
              <input className="input" list="move-vehicles" value={f.toVehicle} onChange={set('toVehicle')} />
              <datalist id="move-vehicles">{vehicles.map((v) => <option key={v} value={v} />)}</datalist>
            </Field>
          )}

          <Field label="Condition after (optional)">
            <select className="input" value={f.conditionAfter} onChange={set('conditionAfter')}>
              <option value="">Unchanged</option>
              <option>New</option>
              <option>Old</option>
              <option>Expired</option>
            </select>
          </Field>
          <Field label="Issued / handled by"><input className="input" value={f.issuedBy} onChange={set('issuedBy')} /></Field>
          <Field label="MRN number"><input className="input" value={f.mrnNum} onChange={set('mrnNum')} /></Field>
          <Field label="Notes"><input className="input" value={f.notes} onChange={set('notes')} /></Field>

          {needsVehicle && (
            <div className="sm:col-span-2 rounded-lg border border-dashed border-slate-300 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Replacing an old battery? (optional)</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input className="input" placeholder="Old battery serial no." value={f.swapSerial} onChange={set('swapSerial')} />
                <input className="input" placeholder="Old battery brand" value={f.swapBrand} onChange={set('swapBrand')} />
              </div>
              <p className="mt-2 text-xs text-slate-400">If filled, that battery is returned to the store as “Old”.</p>
            </div>
          )}
        </div>
      )}
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
