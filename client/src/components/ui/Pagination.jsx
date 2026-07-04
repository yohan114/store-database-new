// Compact pager: "‹ Prev   Page X of Y   Next ›" plus a total count.
export default function Pagination({ page, totalPages, total, onPage }) {
  if (!totalPages || totalPages <= 1) {
    return <div className="text-xs text-slate-400">{total != null ? `${total} record${total === 1 ? '' : 's'}` : ''}</div>;
  }
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-xs text-slate-400">{total != null ? `${total} records` : ''}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          ‹ Prev
        </button>
        <span className="px-3 text-slate-600">
          Page <span className="font-semibold">{page}</span> of {totalPages}
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
