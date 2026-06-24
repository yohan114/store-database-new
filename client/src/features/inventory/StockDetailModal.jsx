import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import Modal from '../../components/ui/Modal.jsx';
import { fmtDate, num, rs } from '../../lib/format.js';

// Movement history (deliveries in + issues out) for one stock item.
export default function StockDetailModal({ open, onClose, row }) {
  const { data, isLoading } = useQuery({
    queryKey: ['inventory-details', row?.cleanName],
    queryFn: () => api.get(`/inventory/details?cleanName=${encodeURIComponent(row.cleanName)}`),
    enabled: open && !!row?.cleanName,
  });

  if (!row) return null;
  const receipts = data?.receipts || [];
  const issues = data?.issues || [];

  return (
    <Modal open={open} onClose={onClose} title={row.itemName} size="xl">
      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm">
        <span className="text-slate-500">Received: <span className="font-medium text-emerald-700">{num(row.totalReceived)}</span></span>
        <span className="text-slate-500">Issued: <span className="font-medium text-rose-700">{num(row.totalIssued)}</span></span>
        <span className="text-slate-500">Current stock: <span className="font-semibold text-slate-800">{num(row.currentStock)}</span></span>
        <span className="text-slate-500">Category: <span className="font-medium text-slate-700">{row.category}</span></span>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-slate-400">Loading movement history…</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-emerald-700">Deliveries in ({receipts.length})</h3>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-400">
                  <tr><th className="px-2 py-2">Date</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2">GRN</th><th className="px-2 py-2 text-right">Price</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receipts.length === 0 && <tr><td colSpan={4} className="px-2 py-3 text-center text-slate-400">None</td></tr>}
                  {receipts.map((r, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap px-2 py-1.5 text-slate-600">{fmtDate(r.deliveryDate)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{num(r.qty)}</td>
                      <td className="px-2 py-1.5 text-slate-500">{r.grnNumber || '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.unitPrice ? rs(r.unitPrice) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-rose-700">Issues out ({issues.length})</h3>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-400">
                  <tr><th className="px-2 py-2">Date</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2">Vehicle</th><th className="px-2 py-2">To</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {issues.length === 0 && <tr><td colSpan={4} className="px-2 py-3 text-center text-slate-400">None</td></tr>}
                  {issues.map((r, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap px-2 py-1.5 text-slate-600">{fmtDate(r.issueDate)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{num(r.qty)}</td>
                      <td className="px-2 py-1.5 text-slate-500">{r.vehicleMachinery || '—'}</td>
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
