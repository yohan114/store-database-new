import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { fmtDate, num } from '../../lib/format.js';
import { SOURCE_LOCAL, SOURCE_HEAD_OFFICE } from '../../lib/constants.js';

// Series colors are fixed to the entity (validated ≥3:1 on white, CVD ΔE 70+).
const COLOR_LOCAL = '#199e70';
const COLOR_HO = '#2a78d6';

function KpiCard({ label, value, sub, accent = 'brand' }) {
  const accents = {
    brand: 'text-brand-600 bg-brand-50',
    amber: 'text-amber-600 bg-amber-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    rose: 'text-rose-600 bg-rose-50',
    slate: 'text-slate-600 bg-slate-100',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span className={`h-2.5 w-2.5 rounded-full ${accents[accent]}`} />
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-800">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

const rs = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-LK', { maximumFractionDigits: 2 });
const rsShort = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return 'Rs. ' + (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return 'Rs. ' + (v / 1_000).toFixed(0) + 'k';
  return 'Rs. ' + v.toFixed(0);
};
const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en', { month: 'short' });
};

// Stacked monthly bar chart (Local vs Head Office) in plain SVG.
function MonthlyChart({ months }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...months.map((m) => m.local + m.headOffice + m.other));
  const W = 720, H = 220, PAD_L = 8, PAD_B = 22, PAD_T = 8;
  const plotH = H - PAD_B - PAD_T;
  const slot = (W - PAD_L) / months.length;
  const barW = Math.min(34, slot * 0.55);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Monthly purchases by source">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={PAD_L} x2={W} y1={PAD_T + plotH * (1 - f)} y2={PAD_T + plotH * (1 - f)} stroke="#e2e8f0" strokeWidth="1" />
        ))}
        <line x1={PAD_L} x2={W} y1={PAD_T + plotH} y2={PAD_T + plotH} stroke="#cbd5e1" strokeWidth="1" />
        {months.map((m, i) => {
          const total = m.local + m.headOffice + m.other;
          const x = PAD_L + slot * i + (slot - barW) / 2;
          const hLocal = (m.local / max) * plotH;
          const hHo = (m.headOffice / max) * plotH;
          const yHo = PAD_T + plotH - hHo;
          const yLocal = yHo - (hLocal ? hLocal + 2 : 0); // 2px gap between segments
          const isHover = hover === i;
          return (
            <g key={m.month}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {/* hit target wider than the mark */}
              <rect x={PAD_L + slot * i} y={PAD_T} width={slot} height={plotH} fill="transparent" />
              {hHo > 0 && (
                <rect x={x} y={yHo} width={barW} height={hHo} fill={COLOR_HO} rx="3"
                  opacity={hover === null || isHover ? 1 : 0.45} />
              )}
              {hLocal > 0 && (
                <rect x={x} y={yLocal} width={barW} height={hLocal} fill={COLOR_LOCAL} rx="3"
                  opacity={hover === null || isHover ? 1 : 0.45} />
              )}
              {total > 0 && isHover && (
                <text x={x + barW / 2} y={Math.min(yLocal, yHo) - 6} textAnchor="middle" fontSize="11" fill="#334155" fontWeight="600">
                  {rsShort(total)}
                </text>
              )}
              <text x={PAD_L + slot * i + slot / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#94a3b8">
                {monthLabel(m.month)}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
          <div className="font-semibold text-slate-700">{months[hover].month}</div>
          <div className="mt-1 space-y-0.5 text-slate-600">
            <div><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: COLOR_LOCAL }} /> Local: <span className="font-medium">{rs(months[hover].local)}</span></div>
            <div><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: COLOR_HO }} /> Head Office: <span className="font-medium">{rs(months[hover].headOffice)}</span></div>
            {months[hover].other > 0 && <div>Unclassified: {rs(months[hover].other)}</div>}
            {months[hover].unpricedCount > 0 && (
              <div className="text-amber-600">{months[hover].unpricedCount} deliveries not yet priced</div>
            )}
          </div>
        </div>
      )}
      <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_LOCAL }} /> Local Purchase</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_HO }} /> Head Office Purchase</span>
      </div>
    </div>
  );
}

function PendingPanel({ title, color, rows, emptyText }) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.itemName, r.mrnNum, r.vehicleMachinery].some((v) => (v || '').toLowerCase().includes(needle))
    );
  }, [rows, q]);

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{rows.length}</span>
      </div>
      <div className="border-b border-slate-100 px-4 py-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search item, MRN, vehicle…"
          className="input w-full py-1.5 text-xs"
        />
      </div>
      <div className="max-h-80 overflow-y-auto">
        {filtered.length === 0 && <div className="px-4 py-8 text-center text-xs text-slate-400">{emptyText}</div>}
        <table className="min-w-full text-xs">
          <tbody className="divide-y divide-slate-50">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-700">{r.itemName}</div>
                  <div className="text-slate-400">
                    {r.mrnNum ? `MRN ${r.mrnNum}` : 'no MRN'} · {r.vehicleMachinery || '—'} · {fmtDate(r.reqDateISO || r.reqDate)}
                  </div>
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                  <div className="font-semibold text-slate-700">{num(r.outstanding)}</div>
                  <div className="text-slate-400">of {num(r.reqQty)}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right">
                  {r.ageDays != null && (
                    <span className={`rounded-full px-2 py-0.5 font-medium ${
                      r.ageDays > 14 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'
                    }`}>{r.ageDays}d</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const stats = useQuery({
    queryKey: ['sidebar-stats'],
    queryFn: () => api.get('/sidebar-stats'),
  });
  const summary = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get('/dashboard/summary'),
  });
  const purchases = useQuery({
    queryKey: ['dashboard-purchases'],
    queryFn: () => api.get('/dashboard/purchases'),
  });

  const isLoading = stats.isLoading || summary.isLoading;
  const error = stats.error || summary.error || purchases.error;
  const p = purchases.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Live snapshot of requests, deliveries, purchases and spend.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Could not load data: {error.message}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Items (MRN lines)" value={stats.data?.totalItems ?? 0} accent="brand" />
          <KpiCard label="Pending Delivery" value={stats.data?.pendingDelivery ?? 0} accent="amber" sub="awaiting supplier" />
          <KpiCard label="Pending Pricing" value={stats.data?.pendingPricing ?? 0} accent="rose" sub="received, no GRN price" />
          <KpiCard label="In-Stock SKUs" value={stats.data?.inStockCount ?? 0} accent="emerald" />
          <KpiCard label="Total Issued" value={stats.data?.totalIssues ?? 0} accent="slate" />
          <KpiCard label="Total Spend" value={rs(summary.data?.totalSpend)} accent="emerald" />
          <KpiCard label="Active Suppliers" value={summary.data?.supplierCount ?? 0} accent="brand" />
          <KpiCard label="Unpriced Received" value={summary.data?.unpricedReceivedCount ?? 0} accent="amber" sub="needs a unit price" />
        </div>
      )}

      {/* Purchases: today / month-to-date per source + 12-month view */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Purchases</h2>
        {purchases.isLoading ? (
          <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white" />
        ) : p ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Today — Local" value={rs(p.today.local)} accent="emerald" sub={SOURCE_LOCAL} />
              <KpiCard label="Today — Head Office" value={rs(p.today.headOffice)} accent="brand" sub={SOURCE_HEAD_OFFICE} />
              <KpiCard label="This Month — Local" value={rs(p.monthToDate.local)} accent="emerald"
                sub={p.monthToDate.unpricedCount ? `${p.monthToDate.unpricedCount} deliveries not yet priced` : 'all priced'} />
              <KpiCard label="This Month — Head Office" value={rs(p.monthToDate.headOffice)} accent="brand" sub={SOURCE_HEAD_OFFICE} />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Monthly expenses — last 12 months</h3>
                <span className="text-xs text-slate-400">priced deliveries only</span>
              </div>
              <MonthlyChart months={p.monthly} />
            </div>
          </>
        ) : null}
      </section>

      {/* Pending items by source */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-800">Pending items</h2>
          {p && p.pending.unassigned.length > 0 && (
            <Link to="/tracker" className="text-xs text-slate-400 underline-offset-2 hover:underline">
              {p.pending.unassigned.length} older pending lines have no source — assign them in the Tracker
            </Link>
          )}
        </div>
        {p && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PendingPanel
              title="Pending — Head Office"
              color={COLOR_HO}
              rows={p.pending.headOffice}
              emptyText="Nothing pending from head office."
            />
            <PendingPanel
              title="Pending — Local Purchase"
              color={COLOR_LOCAL}
              rows={p.pending.local}
              emptyText="Nothing pending to buy locally."
            />
          </div>
        )}
      </section>
    </div>
  );
}
