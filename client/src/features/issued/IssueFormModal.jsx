import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import Modal from '../../components/ui/Modal.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useIssuableStock, useVehicles } from '../../lib/hooks.js';
import { useDebounce } from '../../lib/useDebounce.js';
import { num, toDateInput } from '../../lib/format.js';

const today = () => new Date().toISOString().slice(0, 10);

// Issue an item out. Items must have been received first; you pick from stock and
// can't exceed what's available. Two modes: a specific received MRN line, or the
// item's pooled stock (server allocates FIFO across that name's lines).
export default function IssueFormModal({ open, onClose, issue }) {
  const editing = !!issue;
  const qc = useQueryClient();
  const toast = useToast();
  const { data: vehicles = [] } = useVehicles();

  const [mode, setMode] = useState('line');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState(null); // selected stock row
  const [common, setCommon] = useState({ qty: '', issueDate: today(), toVehicle: '', issuedTo: '', issuedBy: '', notes: '' });

  const debSearch = useDebounce(search, 300);
  const { data: stock = [], isFetching } = useIssuableStock(debSearch, mode);

  // Reset on open. In edit mode we prefill the simple fields (the source line is fixed).
  useEffect(() => {
    if (!open) return;
    setMode('line');
    setSearch('');
    setPicked(null);
    setCommon(
      editing
        ? {
            qty: issue.qty ?? '',
            issueDate: toDateInput(issue.issueDateISO || issue.issueDate) || today(),
            toVehicle: issue.vehicleMachinery || '',
            issuedTo: issue.issuedTo || '',
            issuedBy: issue.issuedBy || '',
            notes: issue.notes || '',
          }
        : { qty: '', issueDate: today(), toVehicle: '', issuedTo: '', issuedBy: '', notes: '' }
    );
  }, [open, editing, issue]);

  const set = (k) => (e) => setCommon((p) => ({ ...p, [k]: e.target.value }));
  const available = picked ? picked.available : null;
  const qtyNum = Number(common.qty) || 0;
  const overLimit = available != null && qtyNum > available + 1e-9;

  const save = useMutation({
    mutationFn: () => {
      if (editing) {
        return api.put(`/issues/${issue.id}`, {
          issueDate: common.issueDate,
          vehicleMachinery: common.toVehicle,
          itemName: issue.itemName,
          itemDesc: issue.itemDesc,
          category: issue.category,
          mrnNum: issue.mrnNum,
          qty: qtyNum,
          issuedTo: common.issuedTo,
          issuedBy: common.issuedBy,
          notes: common.notes,
        });
      }
      const base = {
        qty: qtyNum,
        issueDate: common.issueDate,
        vehicleMachinery: common.toVehicle || undefined,
        issuedTo: common.issuedTo,
        issuedBy: common.issuedBy,
        notes: common.notes,
      };
      return mode === 'line'
        ? api.post('/issues', { ...base, itemId: picked.itemId })
        : api.post('/issues', { ...base, mode: 'name', cleanName: picked.cleanName, itemName: picked.itemName });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issues'] });
      qc.invalidateQueries({ queryKey: ['issuable-stock'] });
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['sidebar-stats'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(editing ? 'Issue updated.' : 'Item issued.');
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const canSave = qtyNum > 0 && !overLimit && (editing || picked) && !save.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit issue #${issue.id}` : 'Issue item out'}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={() => save.mutate()} disabled={!canSave} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Issue item'}
          </button>
        </>
      }
    >
      {editing ? (
        <div className="mb-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Editing the issue of <span className="font-semibold text-slate-800">{issue.itemName}</span>
          {issue.mrnNum ? <> · MRN {issue.mrnNum}</> : null}. Quantity is re-checked against available stock.
        </div>
      ) : (
        <div className="mb-4 space-y-3">
          {/* Mode toggle */}
          <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
            {[['line', 'From received line'], ['name', 'By item name']].map(([m, label]) => (
              <button
                key={m}
                onClick={() => { setMode(m); setPicked(null); }}
                className={`rounded-md px-3 py-1.5 font-medium transition ${mode === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Stock picker */}
          {picked ? (
            <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
              <div>
                <div className="font-medium text-slate-800">{picked.itemName}</div>
                <div className="text-xs text-slate-500">
                  {mode === 'line'
                    ? <>{picked.vehicleMachinery || 'no vehicle'} · MRN {picked.mrnNum || '—'}</>
                    : <>pooled across all received lines</>}
                  {' · '}<span className="font-semibold text-emerald-700">Available {num(picked.available)}</span>
                </div>
              </div>
              <button onClick={() => setPicked(null)} className="text-sm text-brand-700 hover:underline">Change</button>
            </div>
          ) : (
            <div>
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={mode === 'line' ? 'Search received items (item, vehicle, MRN)…' : 'Search item name…'}
                className="input"
              />
              <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200">
                {isFetching && <div className="px-3 py-2 text-xs text-slate-400">Searching…</div>}
                {!isFetching && stock.length === 0 && (
                  <div className="px-3 py-3 text-center text-sm text-slate-400">
                    No stock available{search ? ' for that search' : ''}. Items must be received before they can be issued.
                  </div>
                )}
                {stock.map((row) => (
                  <button
                    key={mode === 'line' ? row.itemId : row.cleanName}
                    onClick={() => { setPicked(row); setCommon((p) => ({ ...p, qty: '' })); }}
                    className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50"
                  >
                    <span>
                      <span className="font-medium text-slate-800">{row.itemName}</span>
                      {mode === 'line' && <span className="ml-2 text-xs text-slate-400">{row.vehicleMachinery || '—'} · MRN {row.mrnNum || '—'}</span>}
                    </span>
                    <span className="ml-3 whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{num(row.available)} avail</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quantity + details (shown once a source is chosen, or always in edit mode) */}
      {(editing || picked) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={available != null ? `Quantity * (max ${num(available)})` : 'Quantity *'}>
            <input
              type="number" step="any" min="0" max={available ?? undefined}
              className={`input ${overLimit ? 'border-rose-400 focus:ring-rose-100' : ''}`}
              value={common.qty} onChange={set('qty')} autoFocus={editing}
            />
            {overLimit && <span className="mt-1 block text-xs text-rose-600">Only {num(available)} available.</span>}
          </Field>
          <Field label="Issue date"><input type="date" className="input" value={common.issueDate} onChange={set('issueDate')} /></Field>
          <Field label="To vehicle / machinery">
            <input className="input" list="issue-vehicles" value={common.toVehicle} onChange={set('toVehicle')} placeholder={!editing && mode === 'line' ? '(defaults to the line’s vehicle)' : ''} />
            <datalist id="issue-vehicles">{vehicles.map((v) => <option key={v} value={v} />)}</datalist>
          </Field>
          <Field label="Issued to"><input className="input" value={common.issuedTo} onChange={set('issuedTo')} placeholder="person / section" /></Field>
          <Field label="Issued by"><input className="input" value={common.issuedBy} onChange={set('issuedBy')} /></Field>
          <Field label="Notes"><input className="input" value={common.notes} onChange={set('notes')} /></Field>
        </div>
      )}
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
