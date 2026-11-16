// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/PricingConfigCloudService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * CẤU HÌNH TÍNH GIÁ CỦA DỰ ÁN (Sản phẩm > Báo cáo & cấu hình > Cấu hình tính giá)
 *
 * Bảng `public.cloud_pricing_configs` đã chuẩn hóa theo uuid — giống cách làm của
 * kho mẫu bên Hệ thống > Phân quyền công ty > Cấu hình mẫu tính giá:
 *   - id       : uuid, LÀ mã cấu hình (không còn cột `ma_ch`)
 *   - ma_ctdk  : uuid công ty đăng ký (cloud_companies.id) — lấy TỪ TOKEN đăng nhập
 *   - ma_da    : uuid dự án (da_projects.id) — suy ra từ dự án đang chọn
 *   - form_code: CAOTANG / THAPTANG / CSCAOTANG / CSTHAPTANG
 *   - detail   : danh sách trường của cấu hình (jsonb)
 * Không còn cột `loai` / `ma_ch` / `raw`; danh mục trường lấy từ
 * `sys_pricing_fields_default` (loadSysPricingFields).
 *
 * Các lần chiết khấu của chính sách giá nằm ở bảng RIÊNG của dự án
 * `public.cloud_pricing_config_rounds` (KHÔNG dùng bảng của kho mẫu).
 */
import { supabase } from "../_shims/integrations/supabase/client";
import { sessionCompanyId } from "../_shims/lib/session";
import { getDaProjectRaw } from "./DaProjectCatalog";
import { memoAsync, clearApiCache } from "../lib/apiCache";

const CFG = "cloud_pricing_configs";
const RND = "cloud_pricing_config_rounds";

/** Mã form của 2 tab "Chính sách giá" */
export const POLICY_FORM_CODES = ["CSCAOTANG", "CSTHAPTANG"];
export const isPolicyFormCode = (formCode: any) =>
  POLICY_FORM_CODES.includes(String(formCode ?? "").toUpperCase());

/** Các mã công ty đăng ký được phép tạo "mẫu chung" cho toàn hệ thống */
export const SHARED_TENANTS = ["beesky", "beesky1"];

const tenantCode = () => {
  try {
    const u = JSON.parse(localStorage.getItem("authUser") || "{}");
    return String(
      localStorage.getItem("TenCTDKVT") ?? u?.data?.maCTDK ?? u?.maCTDK ?? "",
    )
      .trim()
      .toLowerCase();
  } catch {
    return "";
  }
};
export const canManageSharedTemplate = () =>
  SHARED_TENANTS.includes(tenantCode());

/** uuid công ty đăng ký (từ token) */
const companyId = () => sessionCompanyId() || "";

/** Dọn cache đọc cấu hình sau mọi thao tác ghi để form luôn lấy bản mới nhất */
const clearPricingConfigCache = () => clearApiCache("pricing-config:");

/** uuid dự án theo mã dự án cũ (MaDA) hoặc uuid */
const projectId = async (maDA: any): Promise<string> => {
  const v = String(maDA ?? "").trim();
  if (!v) return "";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))
    return v;
  try {
    const row: any = await getDaProjectRaw(v);
    return row?.id ? String(row.id) : "";
  } catch {
    return "";
  }
};

/** uuid của các công ty hệ thống (dùng để đọc mẫu chung) */
let sharedIdsCache: Promise<string[]> | null = null;
const sharedCompanyIds = (): Promise<string[]> => {
  if (!sharedIdsCache) {
    sharedIdsCache = (async () => {
      try {
        const { data } = await supabase
          .from("cloud_companies" as any)
          .select("id, code")
          .in("code", SHARED_TENANTS);
        return ((data as any[]) || []).map((r) => String(r.id));
      } catch {
        return [];
      }
    })();
  }
  return sharedIdsCache;
};

const fromRow = (row: any) => ({
  ID: row?.id,
  Name: row?.ten ?? "",
  Status: !!row?.status,
  Detail: Array.isArray(row?.detail) ? row.detail : [],
  CreatedAt: row?.updated_at,
  IsMauChung: !!row?.la_mau_chung,
  // Nhóm biểu mẫu: CAOTANG/THAPTANG (tính giá sản phẩm) hoặc
  // CSCAOTANG/CSTHAPTANG (chính sách giá — nơi khai báo vòng chiết khấu)
  FormCode: row?.form_code ?? null,
  __ownerTenant: row?.ma_ctdk,
  __cloud: true,
});

const fromRoundRow = (row: any) => ({
  ID: row?.id,
  CauHinhId: row?.cau_hinh_id,
  Name: row?.ten ?? "",
  LoaiCK: row?.loai_ck ?? "PHANTRAM",
  OrderBy: Number(row?.order_by) || 1,
  Details: Array.isArray(row?.details)
    ? row.details
    : Array.isArray(row?.detail)
      ? row.detail
      : [],
});

export const PricingConfigCloudService = {
  /**
   * Danh sách cấu hình của dự án theo biểu mẫu.
   * Cache theo đúng payload (công ty + uuid dự án + formCode) để các lần mở
   * form thêm/sửa cùng dự án không phải gọi lại `cloud_pricing_configs`.
   */
  list: async (maDA: any, formCode: string) => {
    const uid = companyId();
    const pid = await projectId(maDA);
    if (!uid || !pid) return [];
    const code = String(formCode ?? "").toUpperCase();
    return memoAsync(`pricing-config:list:${uid}:${pid}:${code}`, async () => {
      const { data, error } = await supabase
        .from(CFG as any)
        .select("*")
        .eq("ma_ctdk", uid)
        .eq("ma_da", pid)
        .eq("form_code", code)
        .order("created_at", { ascending: true });
      if (error) return [];
      return ((data as any[]) || []).map(fromRow);
    });
  },

  /** Mẫu chung do công ty hệ thống công bố — mọi công ty đều thấy */
  listShared: async (formCode: string) => {
    const uid = companyId();
    const code = String(formCode ?? "").toUpperCase();
    return memoAsync(`pricing-config:shared:${uid}:${code}`, async () => {
      const ids = await sharedCompanyIds();
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from(CFG as any)
        .select("*")
        .eq("la_mau_chung", true)
        .eq("form_code", code)
        .in("ma_ctdk", ids)
        .order("created_at", { ascending: true });
      if (error) return [];
      return ((data as any[]) || [])
        .filter((r) => String(r?.ma_ctdk ?? "") !== uid)
        .map((r) => ({ ...fromRow(r), Status: false, __shared: true }));
    });
  },

  /** Cấu hình của dự án + mẫu chung (dùng cho form sản phẩm) */
  listWithShared: async (maDA: any, formCode: string) => {
    const [own, shared] = await Promise.all([
      PricingConfigCloudService.list(maDA, formCode),
      PricingConfigCloudService.listShared(formCode).catch(() => []),
    ]);
    const seen = new Set(own.map((r: any) => String(r?.ID ?? "")));
    return [
      ...own,
      ...(shared as any[]).filter((r) => !seen.has(String(r?.ID ?? ""))),
    ];
  },

  /** Thêm / sửa 1 cấu hình — trả về uuid cấu hình */
  save: async (payload: any, maDA: any, formCode: string) => {
    const uid = companyId();
    const pid = await projectId(maDA);
    if (!uid) throw new Error("Chưa xác định được công ty đăng ký — hãy đăng nhập lại");
    if (!pid) throw new Error("Chưa xác định được dự án — hãy chọn lại dự án");
    const code = String(formCode ?? "").toUpperCase();
    const id = String(payload?.ID ?? "").trim();
    const ten = payload?.Name ?? payload?.TenCauHinh ?? payload?.Ten ?? null;
    const status = !!(payload?.Status ?? payload?.MacDinh);

    if (id) {
      const { data: cur } = await supabase
        .from(CFG as any)
        .select("id, detail")
        .eq("id", id)
        .eq("ma_ctdk", uid)
        .maybeSingle();
      if (cur) {
        const detail = Array.isArray(payload?.Detail)
          ? payload.Detail
          : ((cur as any).detail ?? []);
        const { error } = await supabase
          .from(CFG as any)
          .update({ ten, status, detail } as any)
          .eq("id", (cur as any).id);
        if (error) throw new Error(error.message);
        clearPricingConfigCache();
        return (cur as any).id as string;
      }
    }

    const { data, error } = await supabase
      .from(CFG as any)
      .insert({
        ma_ctdk: uid,
        ma_da: pid,
        form_code: code,
        ten,
        status,
        detail: Array.isArray(payload?.Detail) ? payload.Detail : [],
      } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    clearPricingConfigCache();
    return (data as any).id as string;
  },

  remove: async (id: any) => {
    const uid = companyId();
    if (!uid) return;
    await supabase
      .from(CFG as any)
      .delete()
      .eq("ma_ctdk", uid)
      .eq("id", String(id ?? ""));
    clearPricingConfigCache();
  },

  /** Đặt mặc định: bỏ mặc định các cấu hình khác cùng dự án + biểu mẫu */
  setDefault: async (id: any, maDA: any, formCode: string) => {
    const uid = companyId();
    const pid = await projectId(maDA);
    if (!uid || !pid) return;
    const code = String(formCode ?? "").toUpperCase();
    await supabase
      .from(CFG as any)
      .update({ status: false } as any)
      .eq("ma_ctdk", uid)
      .eq("ma_da", pid)
      .eq("form_code", code);
    await supabase
      .from(CFG as any)
      .update({ status: true } as any)
      .eq("ma_ctdk", uid)
      .eq("id", String(id ?? ""));
    clearPricingConfigCache();
  },

  /** Bật/tắt cờ mẫu chung (chỉ công ty hệ thống được dùng) */
  setShared: async (id: any, _maDA: any, _formCode: string, value: boolean) => {
    if (!canManageSharedTemplate())
      throw new Error("Chỉ công ty hệ thống mới được đặt mẫu chung");
    const uid = companyId();
    const { error } = await supabase
      .from(CFG as any)
      .update({ la_mau_chung: !!value } as any)
      .eq("ma_ctdk", uid)
      .eq("id", String(id ?? ""));
    if (error) throw new Error(error.message);
    clearPricingConfigCache();
  },

  /** Thêm/sửa 1 dòng chi tiết (trường) trong cột detail của cấu hình */
  upsertDetailItem: async (cauHinhId: any, item: any) => {
    const uid = companyId();
    const cfgId = String(cauHinhId ?? "").trim();
    if (!uid) throw new Error("Chưa xác định được công ty đăng ký — hãy đăng nhập lại");
    if (!cfgId) throw new Error("Thiếu mã cấu hình cần lưu");

    const { data, error } = await supabase
      .from(CFG as any)
      .select("id, detail, ma_ctdk")
      .eq("id", cfgId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row: any = data;
    if (!row) throw new Error("Không tìm thấy cấu hình cần lưu");
    if (String(row.ma_ctdk) !== uid)
      throw new Error(
        'Đây là cấu hình "Mẫu chung" của hệ thống — hãy bấm "Nhân bản cấu hình" rồi sửa trên bản sao của dự án',
      );

    const id =
      String(item?.ID ?? "") || `D-${Date.now().toString(36).toUpperCase()}`;
    const detail = Array.isArray(row.detail) ? [...row.detail] : [];
    const next = { ...(item || {}), ID: id, CauHinhId: cfgId };
    const idx = detail.findIndex((d: any) => String(d?.ID ?? "") === id);
    if (idx >= 0) detail[idx] = { ...detail[idx], ...next };
    else detail.push(next);
    const { error: e2 } = await supabase
      .from(CFG as any)
      .update({ detail } as any)
      .eq("id", row.id);
    if (e2) throw new Error(e2.message);
    return id;
  },

  /**
   * Ghi đè toàn bộ danh sách chi tiết của 1 cấu hình trong 1 lần cập nhật.
   * Dùng khi sao chép chi tiết từ "Cấu hình mẫu chung" — tránh việc gọi
   * upsert song song làm ghi đè lẫn nhau (mất dòng).
   */
  replaceDetail: async (cauHinhId: any, items: any[]) => {
    const uid = companyId();
    const cfgId = String(cauHinhId ?? "").trim();
    if (!uid) throw new Error("Chưa xác định được công ty đăng ký — hãy đăng nhập lại");
    if (!cfgId) throw new Error("Thiếu mã cấu hình cần lưu");

    const { data, error } = await supabase
      .from(CFG as any)
      .select("id, ma_ctdk")
      .eq("id", cfgId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row: any = data;
    if (!row) throw new Error("Không tìm thấy cấu hình cần lưu");
    if (String(row.ma_ctdk) !== uid)
      throw new Error("Không có quyền sửa cấu hình này");

    const stamp = Date.now().toString(36).toUpperCase();
    const detail = (items || []).map((it: any, i: number) => ({
      ...(it || {}),
      ID: `D-${stamp}-${i}`,
      CauHinhId: cfgId,
      OrderBy: it?.OrderBy ?? i + 1,
    }));
    const { error: e2 } = await supabase
      .from(CFG as any)
      .update({ detail } as any)
      .eq("id", cfgId);
    if (e2) throw new Error(e2.message);
    return detail.length;
  },



  /** Xóa 1 dòng chi tiết theo ID (quét các cấu hình của công ty hiện tại) */
  removeDetailItem: async (detailId: any) => {
    const uid = companyId();
    const id = String(detailId ?? "").trim();
    if (!uid || !id) return;
    const { data } = await supabase
      .from(CFG as any)
      .select("id, detail")
      .eq("ma_ctdk", uid);
    for (const row of ((data as any[]) || [])) {
      const detail = Array.isArray(row?.detail) ? row.detail : [];
      if (!detail.some((d: any) => String(d?.ID ?? "") === id)) continue;
      await supabase
        .from(CFG as any)
        .update({
          detail: detail.filter((d: any) => String(d?.ID ?? "") !== id),
        } as any)
        .eq("id", row.id);
    }
  },

  /* ---------------- Các lần chiết khấu (chính sách giá) ---------------- */

  /** Thêm/sửa 1 lần chiết khấu của 1 cấu hình chính sách giá */
  saveRound: async (payload: any, maDA?: any) => {
    const uid = companyId();
    const cfgId = String(payload?.CauHinhId ?? "").trim();
    if (!uid) throw new Error("Chưa xác định được công ty đăng ký — hãy đăng nhập lại");
    if (!cfgId) throw new Error("Thiếu mã cấu hình chính sách giá");

    const { data: cfg } = await supabase
      .from(CFG as any)
      .select("id, ma_ctdk, ma_da")
      .eq("id", cfgId)
      .maybeSingle();
    const pid = (cfg as any)?.ma_da || (await projectId(maDA));
    if (!cfg || !pid) throw new Error("Không tìm thấy cấu hình chính sách giá");
    if (String((cfg as any).ma_ctdk) !== uid)
      throw new Error(
        'Đây là cấu hình "Mẫu chung" — hãy nhân bản về dự án rồi cấu hình chiết khấu',
      );

    const row = {
      ma_ctdk: uid,
      ma_da: pid,
      cau_hinh_id: cfgId,
      ten: payload?.Name ?? "",
      loai_ck: payload?.LoaiCK ?? "PHANTRAM",
      order_by: Number(payload?.OrderBy) || 1,
      details: Array.isArray(payload?.Details) ? payload.Details : [],
    };
    const id = String(payload?.ID ?? "").trim();
    const q = supabase.from(RND as any);
    const { data, error } = id
      ? await q.update(row as any).eq("id", id).select("id").single()
      : await q.insert(row as any).select("id").single();
    if (error) throw new Error(error.message);
    return (data as any).id as string;
  },

  /** Danh sách lần chiết khấu của 1 cấu hình */
  listRounds: async (cauHinhId: any) => {
    const { data } = await supabase
      .from(RND as any)
      .select("*")
      .eq("cau_hinh_id", String(cauHinhId ?? ""))
      .order("order_by", { ascending: true });
    return ((data as any[]) || []).map(fromRoundRow);
  },

  /** 1 lần chiết khấu theo uuid */
  getRound: async (roundId: any) => {
    const { data } = await supabase
      .from(RND as any)
      .select("*")
      .eq("id", String(roundId ?? ""))
      .maybeSingle();
    return data ? fromRoundRow(data) : null;
  },

  removeRound: async (roundId: any) => {
    const { error } = await supabase
      .from(RND as any)
      .delete()
      .eq("id", String(roundId ?? ""));
    if (error) throw new Error(error.message);
  },
};

export default PricingConfigCloudService;
