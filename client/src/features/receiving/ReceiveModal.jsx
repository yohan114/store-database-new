import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import Modal from '../../components/ui/Modal.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { num } from '../../lib/format.js';
import SourceTicks from '../../components/ui/SourceTicks.jsx';
import { sourceShort } from '../../lib/constants.js';

const today = () => new Date().toISOString().slice(0, 10);

// Records a delivery (receipt) against an MRN line.
export default function ReceiveModal({ open, onClose, item }) {
  const qc = useQueryClient();
  const toast = useToast();
  const outstanding = item ? Math.max(0, Number(item.reqQty) - Number(item.recQty)) : 0;

  const [f, setF] = useState({});
  useEffect(() => {
    if (open && item) {
      setF({
        qty: outstanding || '',
        deliveryDate: today(),
        supplierName: '',
        purchaseSource: item.requestSource || '',
        grnNumber: '',
        invoiceNumber: '',
        invoiceDate: '',
        unitPrice: '',
        transactionType: 'Receive',
      });
    }
  }, [open, item]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () =>
      api.post(`/items/${item.id}/receipts`, {
        ...f,
        qty: Number(f.qty) || 0,
        unitPrice: f.unitPrice === '' ? null : Number(f.unitPrice),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['sidebar-stats'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      qc.invalidateQueries({ queryKey: ['dashboard-purchases'] });
      toast.success('Delivery recorded.');
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!item) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Receive — ${item.itemName}`}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={!Number(f.qty) || !f.purchaseSource || save.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Record delivery'}
          </button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm">
        <span className="text-slate-500">MRN: <span className="font-medium text-slate-700">{item.mrnNum || '—'}</span></span>
        <span className="text-slate-500">Vehicle: <span className="font-medium text-slate-700">{item.vehicleMachinery || '—'}</span></span>
        <span className="text-slate-500">Requested: <span className="font-medium text-slate-700">{num(item.reqQty)}</span></span>
        <span className="text-slate-500">Already received: <span className="font-medium text-slate-700">{num(item.recQty)}</span></span>
        <span className="text-slate-500">Outstanding: <span className="font-semibold text-amber-600">{num(outstanding)}</span></span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Quantity received *">
          <input type="number" step="any" className="input" value={f.qty} onChange={set('qty')} autoFocus />
        </Field>
        <Field label="Delivery date">
          <input type="date" className="input" value={f.deliveryDate} onChange={set('deliveryDate')} />
        </Field>
        <Field label="Supplier">
          <input className="input" value={f.supplierName} onChange={set('supplierName')} placeholder="Supplier name" />
        </Field>
        <Field label="Received from *">
          <SourceTicks
            name="receivePurchaseSource"
            value={f.purchaseSource}
            onChange={(v) => setF((p) => ({ ...p, purchaseSource: v }))}
          />
          {item.requestSource && f.purchaseSource && f.purchaseSource !== item.requestSource && (
            <span className="mt-1 inline-block rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
              Requested from {sourceShort(item.requestSource)} — receiving as {sourceShort(f.purchaseSource)}
            </span>
          )}
        </Field>
        <Field label="GRN number">
          <input className="input" value={f.grnNumber} onChange={set('grnNumber')} />
        </Field>
        <Field label="Unit price (Rs.)">
          <input type="number" step="any" className="input" value={f.unitPrice} onChange={set('unitPrice')} placeholder="leave blank to price later" />
        </Field>
        <Field label="Invoice number">
          <input className="input" value={f.invoiceNumber} onChange={set('invoiceNumber')} />
        </Field>
        <Field label="Invoice date">
          <input type="date" className="input" value={f.invoiceDate} onChange={set('invoiceDate')} />
        </Field>
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
