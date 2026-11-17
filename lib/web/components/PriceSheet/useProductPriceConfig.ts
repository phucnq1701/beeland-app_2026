// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/PriceSheet/useProductPriceConfig.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { ProjectService } from "../../_shims/services/Project";
import { PricingConfigCloudService } from "../../services/PricingConfigCloudService";
import {
  getPriceFieldsFromApi,
  computeAllFormulas,
  resolveFieldCode,
  solveInputForTarget,
  type FieldConfig,
} from "../../utils/pricingEngine";

/**
 * Tải cấu hình tính giá của sản phẩm (CAOTANG / THAPTANG) — giống form
 * thêm/sửa sản phẩm — và cho phép nhập trực tiếp trong phiếu tính giá.
 * Giá trị chỉ lưu trong phiếu, không ghi ngược lại bản ghi sản phẩm.
 */
export function useProductPriceConfig(params: {
  maDA?: any;
  isLow: boolean;
  product?: any;
  onValues?: (values: Record<string, any>) => void;
}) {
  const { maDA, isLow, product, onValues } = params;
  const formCode = isLow ? "THAPTANG" : "CAOTANG";
  const type: "high" | "low" = isLow ? "low" : "high";

  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [configs, setConfigs] = useState<any[]>([]);
  const [configId, setConfigId] = useState<any>(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!maDA) {
        setFields([]);
        setConfigs([]);
        return;
      }
      try {
        const res: any = await ProjectService.CauHinh.get({
          MaDA: maDA,
          FormCode: formCode,
        });
        let list: any[] = Array.isArray(res?.data) ? res.data : [];
        if (!list.length) {
          list = await PricingConfigCloudService.listWithShared(maDA, formCode);
        }
        if (!alive) return;
        setConfigs(list);
        const preferred =
          list.find(
            (i: any) =>
              String(i?.ID ?? "") === String(product?.MaCauHinhTinhGia ?? "")
          ) ||
          list.find((i: any) => i?.Status === true) ||
          list[0];
        setConfigId(preferred?.ID);
        setFields(getPriceFieldsFromApi(list, type, preferred?.ID));
      } catch {
        if (alive) {
          setFields([]);
          setConfigs([]);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [maDA, formCode, type, product?.MaCauHinhTinhGia]);

  const editableKeys = useMemo(
    () => new Set(fields.filter((f) => f.type !== "formula").map((f) => f.key)),
    [fields]
  );

  /** Đặt giá trị cho 1 mã trường và tính lại toàn bộ công thức liên quan */
  const setField = (rawKey: string, val: any, current: Record<string, any>) => {
    const key = fields.length ? resolveFieldCode(fields, rawKey) : rawKey;
    const base = { ...values, ...current };
    if (!fields.length) {
      const next = { ...base, [key]: val };
      setValues(next);
      onValues?.(next);
      return next;
    }
    const target = fields.find((f) => f.key === key);
    let next: Record<string, any>;
    if (target?.type === "formula") {
      // Nhập trực tiếp vào trường công thức (vd: Gồm VAT) → tính ngược nguồn
      const solved = solveInputForTarget(fields, base, key, val);
      next = solved
        ? computeAllFormulas({ ...base, [solved.key]: solved.value }, fields)
        : { ...base, [key]: val };
    } else {
      next = computeAllFormulas({ ...base, [key]: val }, fields);
    }
    setValues(next);
    onValues?.(next);
    return next;
  };

  /** Tính lại toàn bộ trường công thức từ dữ liệu hiện có của phiếu */
  const recomputeFrom = (current: Record<string, any>) => {
    if (!fields.length) return;
    const next = computeAllFormulas({ ...current }, fields);
    setValues(next);
    onValues?.(next);
  };

  /** Đổi cấu hình tính giá đang áp dụng cho phiếu */
  const selectConfig = (id: any) => {
    setConfigId(id);
    const list = configs.map((c: any) => ({
      ...c,
      Status: String(c.ID) === String(id),
    }));
    setFields(getPriceFieldsFromApi(list, type, id));
  };

  return {
    fields,
    editableKeys,
    values,
    setField,
    recomputeFrom,
    configs,
    configId,
    selectConfig,
  };
}
