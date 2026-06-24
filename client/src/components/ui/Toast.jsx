import { createContext, useContext, useState, useCallback } from 'react';

const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (type, message) => {
      const id = nextId++;
      setToasts((t) => [...t, { id, type, message }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  const api = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  };

  const styles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-rose-200 bg-rose-50 text-rose-800',
    info: 'border-slate-200 bg-white text-slate-700',
  };
  const icon = { success: '✓', error: '✕', info: 'ℹ' };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => remove(t.id)}
            className={`pointer-events-auto flex cursor-pointer items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg ${styles[t.type]}`}
          >
            <span className="font-bold">{icon[t.type]}</span>
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
