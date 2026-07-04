import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import Modal from '../../components/ui/Modal.jsx';
import { fmtDate, num } from '../../lib/format.js';

// Items requested and issues made for a single vehicle / machine.
export default function FleetDetailModal({ open, onClose, vehicle }) {
  const { data, isLoading } = useQuery({
    queryKey: ['fleet-details', vehicle],
    queryFn: () => api.get(`/fleet/details?vehicle=${encodeURIComponent(vehicle)}`),
    enabled: open && !!vehicle,
  });

  if (!vehicle) return null;
  const items = data?.items || [];
  const issues = data?.issues || [];

  return (
    <Modal open={open} onClose={onClose} title={`🚜 ${vehicle}`} size="xl">
      {isLoading ? (
        <div className="py-8 text-center text-slate-400">Loading…</div>
      ) : (
        <div className="space-y-5">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Requested items ({items.length})</h3>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-400">
                  <tr><th className="px-2 py-2">MRN</th><th className="px-2 py-2">Item</th><th className="px-2 py-2 text-right">Req</th><th className="px-2 py-2 text-right">Recd</th><th className="px-2 py-2">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length === 0 && <tr><td colSpan={5} className="px-2 py-3 text-center text-slate-400">None</td></tr>}
                  {items.map((it) => {
                    const pending = Number(it.reqQty) > Number(it.recQty);
                    return (
                      <tr key={it.id}>
                        <td className="px-2 py-1.5 text-slate-500">{it.mrnNum || '—'}</td>
                        <td className="px-2 py-1.5 font-medium text-slate-700">{it.itemName}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{num(it.reqQty)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{num(it.recQty)}</td>
                        <td className="px-2 py-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${pending ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {pending ? 'Awaiting supplier' : 'Received'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Issued to this vehicle ({issues.length})</h3>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-400">
                  <tr><th className="px-2 py-2">Date</th><th className="px-2 py-2">Item</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2">Issued to</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {issues.length === 0 && <tr><td colSpan={4} className="px-2 py-3 text-center text-slate-400">None</td></tr>}
                  {issues.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap px-2 py-1.5 text-slate-500">{fmtDate(r.issueDateISO || r.issueDate)}</td>
                      <td className="px-2 py-1.5 font-medium text-slate-700">{r.itemName}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{num(r.qty)}</td>
                      <td className="px-2 py-1.5 text-slate-500">{r.issuedTo || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
