import { PURCHASE_SOURCES } from '../../lib/constants.js';

// The Local / Head Office tick pair used on request and delivery forms.
export default function SourceTicks({ value, onChange, name }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PURCHASE_SOURCES.map((src) => (
        <label
          key={src}
          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            value === src
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
          }`}
        >
          <input
            type="radio"
            name={name}
            className="accent-brand-600"
            checked={value === src}
            onChange={() => onChange(src)}
          />
          {src}
        </label>
      ))}
    </div>
  );
}
