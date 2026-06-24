import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import Modal from '../../components/ui/Modal.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { fmtDate, num, toDateInput } from '../../lib/format.js';

const FIELDS = ['unitPrice', 'grnNumber', 'invoiceNumber', 'invoiceDate', 'supplierName'];

// Lets a storekeeper price each receipt of an MRN line and fill in GRN/invoice.
export default function PriceModal({ open, onClose, item }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [rows, setRows] = useState({});

  useEffect(() => {
    if (open && item) {
      const init = {};
      for (const r of item.receipts || []) {
        init[r.id] = {
          unitPrice: r.unitPrice ?? '',
          grnNumber: r.grnNumber || '',
          invoiceNumber: r.invoiceNumber || '',
          invoiceDate: toDateInput(r.invoiceDate) || '',
          supplierName: r.supplierName || '',
        };
      }
      setRows(init);
    }
  }, [open, item]);

  const setField = (id, key) => (e) =>
    setRows((p) => ({ ...p, [id]: { ...p[id], [key]: e.target.value } }));

  const save = useMutation({
    mutationFn: async () => {
      const receipts = item.receipts || [];
      const updates = [];
      for (const r of receipts) {
        const edited = rows[r.id];
        if (!edited) continue;
        const orig = {
          unitPrice: r.unitPrice ?? '',
          grnNumber: r.grnNumber || '',
          invoiceNumber: r.invoiceNumber || '',
          invoiceDate: toDateInput(r.invoiceDate) || '',
          supplierName: r.supplierName || '',
        };
        const changed = FIELDS.some((k) => String(edited[k]) !== String(orig[k]));
        if (changed) {
          updates.push(
            api.put(`/receipts/${r.id}`, {
              ...edited,
              unitPrice: edited.unitPrice === '' ? null : Number(edited.unitPrice),
            })
          );
        }
      }
      if (!updates.length) return { skipped: true };
      return Promise.all(updates);
    },
    onSuccess: (res) => {
      if (res?.skipped) { toast.info('No changes to save.'); onClose(); return; }
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['sidebar-stats'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast.success('Pricing updated.');
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!item) return null;
  const receipts = item.receipts || [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Price — ${item.itemName}`}
      size="xl"
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save pricing'}
          </button>
        </>
      }
    >
      <div className="mb-3 text-sm text-slate-500">
        MRN <span className="font-medium text-slate-700">{item.mrnNum || '—'}</span> · Vehicle{' '}
        <span className="font-medium text-slate-700">{item.vehicleMachinery || '—'}</span> · {receipts.length} receipt(s)
      </div>

      <div className="space-y-3">
        {receipts.map((r) => {
          const unpriced = !r.unitPrice;
          const e = rows[r.id] || {};
          return (
            <div key={r.id} className={`rounded-xl border p-4 ${unpriced ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200'}`}>
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-slate-600">
                  Delivered <span className="font-medium">{fmtDate(r.deliveryDateISO || r.deliveryDate)}</span> · Qty{' '}
                  <span className="font-medium">{num(r.qty)}</span>
                </span>
                {unpriced && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">Unpriced</span>}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Unit price (Rs.)">
                  <input type="number" step="any" className="input" value={e.unitPrice} onChange={setField(r.id, 'unitPrice')} />
                </Field>
                <Field label="Supplier">
                  <input className="input" value={e.supplierName} onChange={setField(r.id, 'supplierName')} />
                </Field>
                <Field label="GRN number">
                  <input className="input" value={e.grnNumber} onChange={setField(r.id, 'grnNumber')} />
                </Field>
                <Field label="Invoice number">
                  <input className="input" value={e.invoiceNumber} onChange={setField(r.id, 'invoiceNumber')} />
                </Field>
                <Field label="Invoice date">
                  <input type="date" className="input" value={e.invoiceDate} onChange={setField(r.id, 'invoiceDate')} />
                </Field>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
