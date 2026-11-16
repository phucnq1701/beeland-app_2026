// ⚠️ TỰ SINH — bản chép nguyên văn web src/hooks/useAgencySan.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { useEffect, useState } from "react";
import { getAgencySan, type AgencySanInfo } from "../lib/agencySan";

/**
 * Sàn giao dịch của tài khoản đại lý đang đăng nhập.
 * `locked = true` → form phải khóa (readonly) trường Sàn giao dịch.
 */
export const useAgencySan = () => {
  const [san, setSan] = useState<AgencySanInfo | null>(null);

  useEffect(() => {
    let alive = true;
    getAgencySan()
      .then((s) => {
        if (alive) setSan(s);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return { agencySan: san, locked: !!san };
};

export default useAgencySan;
