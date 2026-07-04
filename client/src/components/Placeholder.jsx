// Shown for screens that are not yet ported to React. Keeps the new shell
// complete and navigable while we migrate one screen at a time; always offers
// the legacy view as a fallback so no workflow is ever blocked.
export default function Placeholder({ title, legacyHint }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <div className="mb-3 text-4xl">🛠️</div>
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          This screen is being rebuilt in the new interface. Until it lands here,
          you can keep using it in the existing view — your data is the same.
        </p>
        <a
          href="/item_tracker.html"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Open in legacy view
        </a>
        {legacyHint && <p className="mt-3 text-xs text-slate-400">{legacyHint}</p>}
      </div>
    </div>
  );
}
