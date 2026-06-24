import { useEffect, useState } from 'react';

// Returns a debounced copy of `value` that only updates after `delay` ms of
// quiet — used to avoid firing a query on every keystroke in search boxes.
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
