import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';

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

export default function Dashboard() {
  const stats = useQuery({
    queryKey: ['sidebar-stats'],
    queryFn: () => api.get('/sidebar-stats'),
  });
  const summary = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get('/dashboard/summary'),
  });

  const isLoading = stats.isLoading || summary.isLoading;
  const error = stats.error || summary.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Live snapshot of requests, deliveries, stock and spend.
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

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Rebuild in progress
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          This is the new React interface (Phase 0). The Dashboard above reads
          your real database live. Remaining screens open in the legacy view from
          the sidebar and are being ported one at a time.
        </p>
      </div>
    </div>
  );
}
