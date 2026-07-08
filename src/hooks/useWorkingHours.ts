'use client';

import { useEffect, useState } from 'react';
import {
  isWithinStaffWorkingHours,
  STAFF_WORK_START_HOUR,
  STAFF_WORK_END_HOUR,
} from '@/lib/utils';

/**
 * Theo dõi khung giờ làm việc của nhân viên (9:00 – 20:00 giờ Đức).
 * `allowed` tự cập nhật mỗi 30 giây nên UI sẽ tự khóa khi qua 20:00.
 */
export function useStaffWorkingWindow() {
  const [allowed, setAllowed] = useState<boolean>(() => isWithinStaffWorkingHours());

  useEffect(() => {
    const tick = () => setAllowed(isWithinStaffWorkingHours());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  return {
    allowed,
    startHour: STAFF_WORK_START_HOUR,
    endHour: STAFF_WORK_END_HOUR,
  };
}
