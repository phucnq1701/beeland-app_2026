// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/statusConfigScope.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { supabase } from "../_shims/integrations/supabase/client";
import { currentMaCTDK } from "./InterestDetailService";

/**
 * Phạm vi áp dụng cấu hình TRẠNG THÁI (sản phẩm / booking / hợp đồng).
 *
 * Quy tắc:
 *  - Công ty quản trị (beesky1) cấu hình bộ chuẩn trong "Phân quyền công ty".
 *  - Công ty đăng ký khác:
 *      + Nếu beesky1 BẬT "áp dụng bắt buộc" cho nhóm trạng thái đó → mọi công ty
 *        đều đọc đúng bộ của beesky1 và KHÔNG được sửa (chỉ xem).
 *      + Nếu không bắt buộc → dùng cấu hình riêng của công ty; chưa cấu hình thì
 *        kế thừa bộ chuẩn của beesky1; không có nữa mới dùng bộ mặc định code.
 */
export const SUPER_TENANT = "beesky1";
/** Các mã công ty được coi là công ty hệ thống (được sửa bộ chuẩn) */
export const SYSTEM_TENANTS = ["beesky", "beesky1"];

const ENFORCE_CATALOG_TYPE = "cau_hinh_trang_thai_ap_dung";

export const currentTenant = () => (currentMaCTDK() || "").trim();

export const isSystemTenant = () =>
  SYSTEM_TENANTS.includes(currentTenant().toLowerCase());

const enforceCache = new Map<string, { at: number; value: boolean }>();
const TTL = 60_000;

export const invalidateStatusScopeCache = () => enforceCache.clear();

/** Nhóm trạng thái có đang bị áp dụng bắt buộc toàn hệ thống hay không */
export const isEnforced = async (catalogType: string): Promise<boolean> => {
  const hit = enforceCache.get(catalogType);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  try {
    const { data } = await supabase
      .from("cloud_catalogs" as any)
      .select("ap_dung")
      .eq("ma_ctdk", SUPER_TENANT)
      .eq("catalog_type", ENFORCE_CATALOG_TYPE)
      .eq("item_code", catalogType)
      .maybeSingle();
    const value = (data as any)?.ap_dung === true;
    enforceCache.set(catalogType, { at: Date.now(), value });
    return value;
  } catch {
    return false;
  }
};

/** Bật/tắt áp dụng bắt buộc (chỉ công ty hệ thống được ghi) */
export const setEnforced = async (catalogType: string, value: boolean) => {
  if (!isSystemTenant())
    throw new Error(
      "Chỉ công ty quản trị (beesky1) được đổi phạm vi áp dụng cấu hình trạng thái."
    );
  const { error } = await supabase.from("cloud_catalogs" as any).upsert(
    {
      ma_ctdk: SUPER_TENANT,
      catalog_type: ENFORCE_CATALOG_TYPE,
      item_code: catalogType,
      item_name: catalogType,
      parent_code: null,
      ap_dung: value,
      raw: { enforced: value },
    } as any,
    { onConflict: "ma_ctdk,catalog_type,item_code" }
  );
  if (error) throw error;
  enforceCache.set(catalogType, { at: Date.now(), value });
};

export interface StatusScope {
  /** Mã công ty được dùng để ĐỌC cấu hình */
  readTenant: string;
  /** Có bị khóa theo bộ chuẩn của công ty quản trị hay không */
  enforced: boolean;
  /** Công ty hiện tại có được phép sửa cấu hình hay không */
  canEdit: boolean;
}

export const resolveScope = async (catalogType: string): Promise<StatusScope> => {
  const tenant = currentTenant();
  const system = isSystemTenant();
  const enforced = await isEnforced(catalogType);
  return {
    readTenant: enforced && !system ? SUPER_TENANT : tenant,
    enforced,
    canEdit: system || !enforced,
  };
};

/**
 * Đọc danh sách cấu hình theo quy tắc kế thừa: riêng → bộ chuẩn beesky1 → rỗng.
 * Trả về mảng row thô của bảng cloud_catalogs.
 */
export const loadScopedRows = async (
  catalogType: string
): Promise<{ rows: any[]; scope: StatusScope; inherited: boolean }> => {
  const scope = await resolveScope(catalogType);
  const fetch = async (ma_ctdk: string) => {
    if (!ma_ctdk) return [] as any[];
    const { data, error } = await supabase
      .from("cloud_catalogs" as any)
      .select("*")
      .eq("ma_ctdk", ma_ctdk)
      .eq("catalog_type", catalogType);
    if (error) throw error;
    return (data || []) as any[];
  };

  let rows = await fetch(scope.readTenant);
  let inherited = false;
  if (
    !rows.length &&
    scope.readTenant.toLowerCase() !== SUPER_TENANT &&
    !isSystemTenant()
  ) {
    rows = await fetch(SUPER_TENANT);
    inherited = rows.length > 0;
  }
  return { rows, scope, inherited };
};
