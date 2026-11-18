import { useCallback, useEffect, useState } from 'react';
import { practiceService } from '../services/practiceService';
import { studentService } from '../services/studentService';
import { useAuth } from '../context/AuthContext';

/**
 * Today's daily challenge and the student's streak (students only). Also sends the browser's own UTC offset once when it differs
 * from the stored one, so streak days follow the student's local calendar (rule: backend/app/services/daily_challenge_service.py).
 */
export function useDailyChallenge() {
  const { isAuthenticated, user } = useAuth();
  const enabled = Boolean(isAuthenticated && user && user.role !== 'admin');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setFailed(false);
    try {
      let next = await practiceService.getDaily();
      const offset = -new Date().getTimezoneOffset();
      if (next && next.day_offset_minutes !== offset) {
        try {
          await studentService.setDayOffset(offset);
          next = await practiceService.getDaily();
        } catch {
          // the streak still shows, just on the stored day boundary
        }
      }
      setData(next);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { load(); }, [load]);
  return { enabled, data, loading, failed, reload: load };
}

export default useDailyChallenge;
