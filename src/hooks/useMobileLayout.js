import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MOBILE_QUERY } from '../utils/layout';

const matches = () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;

/** True at 768px and below. Components use this to not render mobile-only chrome at all on desktop. */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

/**
 * State for the off-canvas sidebar: closes on Escape, on every route change, and when the
 * viewport grows past the breakpoint; locks page scroll while it is open.
 */
export function useMobileSidebar() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => { if (!isMobile) setOpen(false); }, [isMobile]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return { isMobile, open: isMobile && open, setOpen, close, toggle };
}
