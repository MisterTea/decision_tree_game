import { useEffect, useState } from 'react';

export const COMPACT_QUERY = '(max-width: 700px), (max-width: 1000px) and (max-height: 520px)';
export function useCompactScreen() {
  const [compact, setCompact] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(COMPACT_QUERY).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(COMPACT_QUERY);
    const update = () => setCompact(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return compact;
}
