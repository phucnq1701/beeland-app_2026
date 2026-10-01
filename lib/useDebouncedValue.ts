import { useEffect, useState } from 'react';

/** Trả về `value` sau khi nó đứng yên `delayMs` mili giây (dùng cho ô tìm kiếm). */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
