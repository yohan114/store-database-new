import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import Modal from '../../components/ui/Modal.jsx';
import { fmtDate } from '../../lib/format.js';

const TYPE_COLOR = {
  Register: 'bg-slate-200 text-slate-600',
  Issue: 'bg-brand-100 text-brand-700',
  Transfer: 'bg-indigo-100 text-indigo-700',
  Return: 'bg-amber-100 text-amber-700',
  Dispose: 'bg-rose-100 text-rose-700',
  Update: 'bg-slate-100 text-slate-500',
};

export default function BatteryTimelineModal({ open, onClose, batteryId, serial }) {
  const { data, isLoading } = useQuery({
    queryKey: ['battery', batteryId],
    queryFn: () => api.get(`/batteries/${batteryId}`),
    enabled: open && !!batteryId,
  });
  const movements = data?.movements || [];

  return (
    <Modal open={open} onClose={onClose} title={`History — ${serial || ''}`} size="lg">
      {isLoading ? (
        <div className="py-8 text-center text-slate-400">Loading…</div>
      ) : movements.length === 0 ? (
        <div className="py-6 text-center text-slate-400">No movements recorded.</div>
      ) : (
        <ol className="relative space-y-4 border-l-2 border-slate-100 pl-5">
          {movements.map((m) => (
            <li key={m.id} className="relative">
              <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-400" />
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TYPE_COLOR[m.movementType] || 'bg-slate-100 text-slate-500'}`}>{m.movementType}</span>
                <span className="text-xs text-slate-400">{fmtDate(m.movementDateISO || m.movementDate)}</span>
              </div>
              <div className="mt-1 text-sm text-slate-700">
                {m.fromLocation} → <span className="font-medium">{m.toLocation}</span>
                {m.conditionAfter ? <span className="text-slate-400"> · {m.conditionAfter}</span> : null}
              </div>
              {m.notes && <div className="mt-0.5 text-xs text-slate-400">{m.notes}</div>}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
