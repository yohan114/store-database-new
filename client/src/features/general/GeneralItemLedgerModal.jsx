import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import Modal from '../../components/ui/Modal.jsx';
import { fmtDate, num } from '../../lib/format.js';

const TYPE_COLOR = {
  Receive: 'bg-emerald-100 text-emerald-700',
  Issue: 'bg-rose-100 text-rose-700',
  Transfer: 'bg-indigo-100 text-indigo-700',
};

// Running stock ledger for one general item.
export default function GeneralItemLedgerModal({ open, onClose, itemId, name }) {
  const { data, isLoading } = useQuery({
    queryKey: ['gi-item', itemId],
    queryFn: () => api.get(`/general-items/${itemId}`),
    enabled: open && !!itemId,
  });
  const txns = data?.transactions || [];

  return (
    <Modal open={open} onClose={onClose} title={`Ledger — ${name || ''}`} size="xl">
      {isLoading ? (
        <div className="py-8 text-center text-slate-400">Loading…</div>
      ) : (
        <>
          <div className="mb-3 text-sm text-slate-500">
            Current stock: <span className="font-semibold text-slate-800">{num(data?.currentStock)}</span> {data?.unit} · {txns.length} transaction(s)
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2 text-right">Qty</th>
                  <th className="px-2 py-2 text-right">Balance</th>
                  <th className="px-2 py-2">Ref / vehicle</th>
                  <th className="px-2 py-2">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {txns.length === 0 && <tr><td colSpan={6} className="px-2 py-3 text-center text-slate-400">No transactions.</td></tr>}
                {txns.map((t) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap px-2 py-1.5 text-slate-600">{fmtDate(t.txDateISO || t.txDate)}</td>
                    <td className="px-2 py-1.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TYPE_COLOR[t.txType] || 'bg-slate-100'}`}>{t.txType}</span></td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{num(t.qty)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{num(t.balance)}</td>
                    <td className="px-2 py-1.5 text-slate-500">{t.transferredToRack || t.vehicleMachinery || t.grnNum || t.mrnNum || '—'}</td>
                    <td className="px-2 py-1.5 text-slate-400">{t.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
