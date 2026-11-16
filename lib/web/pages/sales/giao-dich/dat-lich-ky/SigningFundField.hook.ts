// ⚠️ TỰ SINH — thân component SigningFundField của web src/pages/sales/giao-dich/dat-lich-ky/SigningFundField.tsx chép NGUYÊN VĂN thành hook (scripts/sync-web-pricing.cjs).
// Bỏ câu return JSX + 0 câu giao diện: . KHÔNG SỬA TAY.
// @ts-nocheck
/* eslint-disable */
import { useState, useEffect } from "react";
import { listPriceListUnitFunds } from "../../../../services/products/price-list";

export function useWebSigningFund({ value, onChange }: any = {}) {
  const [funds, setFunds] = useState<{ value: string; label: string; ma: string }[]>([]);
  useEffect(() => {
    let alive = true;
    listPriceListUnitFunds()
      .then((f) => alive && setFunds(f.map((x) => ({ value: x.id.toLowerCase(), label: x.name, ma: String(x.ma ?? "") }))))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!funds.length || value?.QuyKy) return;
    const cu = value?.QuyCauHinh ? String(value.QuyCauHinh).toLowerCase() : null;
    const def = (cu && funds.some((f) => f.value === cu) ? cu : null) ?? funds.find((f) => f.ma === "QUY_CDT")?.value ?? funds[0].value;
    // Cập nhật theo state mới nhất (form dùng setState) — tránh đè các cập nhật khác cùng lượt render
    onChange((prev: any) => (prev?.QuyKy ? prev : { ...prev, QuyKy: def }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funds, value?.QuyKy, value?.QuyCauHinh]);
  return { funds, setFunds };
}
