// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Sales/salesConfig/useSalesConfigOptions.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Danh sách cấu hình bán hàng dùng chung cho form Booking / Đặt cọc:
 * bảng giá, cấu hình tính giá, chính sách bán hàng, tiến độ thanh toán,
 * quà tặng — nạp theo dự án + loại bất động sản (cao tầng / thấp tầng).
 *
 * Bảng giá / chính sách bán hàng / tiến độ thanh toán lấy từ các hàm trên máy
 * chủ (fn_get_current_price_lists, fn_get_sales_policies,
 * fn_get_payment_schedules) — mỗi lần mở form chỉ gọi 1 lần.
 * Cấu hình tính giá và quà tặng vẫn gọi như cũ.
 */
import { useCallback, useEffect, useState } from "react";
import type { SetStateAction } from "react";
import dayjs from "dayjs";
import { PricingConfigCloudService } from "../../../services/PricingConfigCloudService";
import { supabase } from "../../../_shims/integrations/supabase/client";
import { sessionCompanyId } from "../../../_shims/lib/session";
import { resolveProjectId } from "../../../services/DaPaymentScheduleService";
import { mapPolicyRow, mapScheduleRow } from "./approvedConfig";
import { useSavedConfigRows } from "./useSavedConfigRows";

export interface SalesConfigOption {
  value: string;
  label: string;
  raw?: any;
}

export interface SalesConfigOptions {
  loading: boolean;
  priceLists: SalesConfigOption[];
  pricingConfigs: SalesConfigOption[];
  policies: SalesConfigOption[];
  schedules: SalesConfigOption[];
  promotions: SalesConfigOption[];
}

const empty: Omit<SalesConfigOptions, "loading"> = {
  priceLists: [],
  pricingConfigs: [],
  policies: [],
  schedules: [],
  promotions: [],
};

const rpc = async (fn: string, args: Record<string, any>): Promise<any[]> => {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) {
    console.error(`${fn} failed`, error);
    return [];
  }
  return Array.isArray(data) ? data : [];
};

/**
 * Nạp 1 lần toàn bộ danh mục cấu hình bán hàng theo dự án + loại bất động sản.
 * Dùng chung cho form Booking (qua hook bên dưới) và form Chứng từ (ContractForm)
 * để hai form luôn lấy cùng một nguồn dữ liệu.
 */
export const fetchSalesConfigOptions = async (params: {
  maDA?: any;
  isLow?: boolean;
  /** Có truyền thì nạp luôn phiếu tính giá (fn_get_price_sheets) trong cùng lượt */
  sanPhamId?: string | null;
  pgcId?: string | null;
  /** uuid căn: có thì máy chủ trả has_product cho từng bảng giá (chọn bảng giá theo quỹ căn) */
  productId?: string | null;
}): Promise<Omit<SalesConfigOptions, "loading"> & { priceSheets?: any[] }> => {
  const { maDA, isLow, sanPhamId, pgcId, productId } = params;
  if (maDA == null || maDA === "") return empty;

  const pricingFormCode = isLow ? "CSTHAPTANG" : "CSCAOTANG";
  const formCode = isLow ? "THAPTANG" : "CAOTANG";
  const propertyType = isLow ? "Thấp tầng" : "Chung cư";

  const tenantUid = sessionCompanyId() || "";
  const projectId = await resolveProjectId(maDA);
  const canRpc = !!tenantUid && !!projectId;
  const isUuid = (v: any) =>
    typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
  const wantSheets = isUuid(sanPhamId) || isUuid(pgcId);

  const [resBG, resCSBH, resLTT, resCHGroups, resKM, resPS] = await Promise.all([
    canRpc
      ? rpc("fn_get_current_price_lists", {
          p_ma_ctdk_uid: tenantUid,
          p_da_project_id: projectId,
          p_type: propertyType,
          ...(isUuid(productId) ? { p_product_id: productId } : {}),
        })
      : Promise.resolve([]),
    canRpc
      ? rpc("fn_get_sales_policies", {
          p_ma_ctdk: tenantUid,
          p_da_project_id: projectId,
          p_form_code: formCode,
        })
      : Promise.resolve([]),
    canRpc
      ? rpc("fn_get_payment_schedules", {
          p_ma_ctdk: tenantUid,
          p_company_id: projectId,
          p_form_code: formCode,
        })
      : Promise.resolve([]),
    PricingConfigCloudService.list(maDA, pricingFormCode).catch(() => []),
    canRpc
      ? rpc("fn_get_promotions", { p_da_project_id: projectId })
      : Promise.resolve([]),
    wantSheets
      ? rpc("fn_get_price_sheets", {
          p_san_pham_id: isUuid(sanPhamId) ? sanPhamId : null,
          p_pgc_id: isUuid(pgcId) ? pgcId : null,
        })
      : Promise.resolve(null),
  ]);

  const pricingRows = Array.isArray(resCHGroups) ? resCHGroups : [];

  return {
    // Sắp theo priority tăng dần (số nhỏ = ưu tiên cao), giữ thứ tự máy chủ khi bằng nhau
    priceLists: [...(resBG || [])]
      .map((pl: any, i: number) => ({ pl, i }))
      .sort(
        (a, b) =>
          (Number(a.pl?.priority ?? 9999) - Number(b.pl?.priority ?? 9999)) ||
          a.i - b.i
      )
      .map(({ pl }) => pl)
      .map((pl: any) => ({
      value: String(pl.id),
      label: `${pl.name || "Bảng giá"}${
        pl.valid_from
          ? ` (${dayjs(pl.valid_from).format("DD/MM/YYYY")}${
              pl.valid_to ? ` → ${dayjs(pl.valid_to).format("DD/MM/YYYY")}` : " → ∞"
            })`
          : ""
      }`,
      raw: pl,
    })),
    pricingConfigs: pricingRows.map((c: any) => ({
      value: String(c.ID ?? c.Id),
      label: c.Name || c.TenCauHinh || String(c.ID),
      raw: c,
    })),
    policies: (resCSBH || []).map((c: any) => ({
      value: String(c.id),
      label: c.ten_cs || String(c.id),
      raw: mapPolicyRow(c),
    })),
    schedules: (resLTT || []).map((c: any) => ({
      value: String(c.id),
      label: c.name || String(c.id),
      raw: mapScheduleRow(c),
    })),
    promotions: (resKM || []).map((c: any) => ({
      value: String(c.id),
      label: c.ten_qua_tang || c.ten_khuyen_mai || String(c.id),
      raw: {
        ...c,
        ID: c.id,
        TenQuaTang: c.ten_qua_tang || c.ten_khuyen_mai,
        TenKhuyenMai: c.ten_khuyen_mai,
        SoLuong: c.so_luong ?? 1,
        GiaTri: Number(c.gia_tri ?? 0),
        MoTa: c.mo_ta,
      },
    })),
    ...(resPS ? { priceSheets: resPS } : {}),
  };
};

export const useSalesConfigOptions = (params: {
  open: boolean;
  maDA?: any;
  isLow?: boolean;
  /** Chính sách / tiến độ đang gắn trên chứng từ đã lưu: thiếu trong danh sách thì đọc theo id và thêm vào */
  savedPolicyId?: string | null;
  savedScheduleId?: string | null;
  /** uuid căn đang mở (has_product của bảng giá) */
  productId?: string | null;
}): SalesConfigOptions => {
  const { open, maDA, isLow, savedPolicyId, savedScheduleId, productId } = params;
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState(empty);
  const setPolicies = useCallback(
    (u: SetStateAction<any[]>) =>
      setState((s) => ({ ...s, policies: typeof u === "function" ? u(s.policies) : u })),
    [],
  );
  const setSchedules = useCallback(
    (u: SetStateAction<any[]>) =>
      setState((s) => ({ ...s, schedules: typeof u === "function" ? u(s.schedules) : u })),
    [],
  );
  useSavedConfigRows({
    policyId: savedPolicyId,
    scheduleId: savedScheduleId,
    loaded,
    policies: state.policies,
    setPolicies,
    schedules: state.schedules,
    setSchedules,
    asOption: true,
  });


  useEffect(() => {
    if (!open || maDA == null || maDA === "") {
      setState(empty);
      setLoaded(false);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      setLoaded(false);
      try {
        const res = await fetchSalesConfigOptions({ maDA, isLow, productId });
        if (alive) {
          setState(res);
          setLoaded(true);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, maDA, isLow, productId]);


  return { loading, ...state };
};

export default useSalesConfigOptions;
