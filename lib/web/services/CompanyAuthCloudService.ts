// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/CompanyAuthCloudService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { supabase } from "../_shims/integrations/supabase/client";
import { currentMaCTDK } from "./InterestDetailService";
import { CongTyService } from "../_stubs/services/CongTyService";
import { PermissionService } from "../_stubs/services/PermissionService";
import { markManualSync } from "../lib/cloudSync";
import { PermissionBridge } from "./PermissionBridge";
import { SysPackageService } from "./SysPackageService";



/**
 * Đồng bộ (ghi song song) dữ liệu Phân quyền công ty lên Cloud.
 * - Nguồn nghiệp vụ chính vẫn là API beesky.
 * - Mọi thao tác đọc/ghi thành công đều được mirror lên Cloud theo ma_ctdk.
 * - Khi API lỗi, có thể đọc dữ liệu dự phòng từ Cloud.
 */

const tenant = () => (currentMaCTDK() || "").toLowerCase();

/** Mã công ty đăng ký cấp cao nhất: xem được dữ liệu của tất cả công ty đăng ký */
export const SUPER_TENANT = "beesky1";
export const currentCompanyCode = (): string => {
  try {
    const direct = (localStorage.getItem("TenCTDKVT") || "").trim();
    if (direct) return direct.toLowerCase();
    const u = JSON.parse(localStorage.getItem("authUser") || "{}");
    return String(
      u?.data?.tenCTDKVT ?? u?.data?.TenCTDKVT ?? u?.tenCTDKVT ?? u?.TenCTDKVT ?? ""
    )
      .trim()
      .toLowerCase();
  } catch {
    return "";
  }
};
export const isSuperTenant = () =>
  tenant() === SUPER_TENANT || currentCompanyCode() === SUPER_TENANT;


/** Chỉ lọc theo ma_ctdk khi KHÔNG phải tenant cấp cao nhất */
const scopeTenant = (q: any) => (isSuperTenant() ? q : q.eq("ma_ctdk", tenant()));

/**
 * Bảng `cloud_companies` là danh sách CÔNG TY ĐĂNG KÝ (tenant) do công ty chủ quản quản lý.
 * Khi tenant thường tự đọc bản ghi của mình, chấp nhận cả `code` mới và `ma_ctdk` cũ.
 */
const scopeRegisteredTenant = (q: any) => {
  if (isSuperTenant()) return q;
  const code = tenant();
  if (!code) return q.eq("code", "__none__");
  return q.or(`code.eq.${code},ma_ctdk.eq.${code},ma_ct.eq.${code}`);
};

/** Bỏ qua lỗi cloud để không chặn luồng nghiệp vụ chính */
const safe = async <T>(fn: () => Promise<T>): Promise<T | null> => {
  try {
    return await fn();
  } catch (e) {
    console.warn("[CompanyAuthCloud] bỏ qua lỗi đồng bộ:", e);
    return null;
  }
};

const t = (name: string) => supabase.from(name as any);

const num = (v: any): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ==================== 1. DANH SÁCH CÔNG TY ====================
export interface CloudCompany {
  MaCT?: string;
  TenCT?: string;
  Email?: string;
  DienThoai?: string;
  DiaChi?: string;
  Server?: string;
  Key?: string;
  MaCTDK?: string | number;
}

export const mirrorCompanies = async (rows: any[]) => {
  const currentTenant = tenant();
  if (!currentTenant || !rows?.length) return;
  await safe(async () => {
    const payload = rows.map((r) => {
      const loginCode = String(r?.MaCT ?? r?.code ?? r?.maCT ?? "")
        .trim()
        .toLowerCase();
      const legacyRef = String(r?.MaCTDK ?? r?.maCTDK ?? r?.ma_ctdk_ref ?? "").trim();
      const tenantCode = loginCode || legacyRef.toLowerCase() || currentTenant;
      const legacyPackage =
        r?.MaNhomSP != null && String(r.MaNhomSP).trim() !== ""
          ? String(r.MaNhomSP)
          : null;
      // package_code phải khớp sys_packages (3 cấp), MaNhomSP chỉ là ID gói cũ
      const packageCode =
        (r?.packageCode ?? r?.package_code ?? null) || legacyPackage;

      return {
        // Cấp tenant: mã đăng nhập của công ty đăng ký, không phải mã công ty nội bộ.
        code: tenantCode,
        ten_ct: r?.TenCT ?? r?.TenCTVT ?? r?.Name ?? null,
        email: r?.Email ?? r?.Email1 ?? null,
        dien_thoai: r?.DienThoai ?? r?.DienThoai1 ?? null,
        dia_chi: r?.DiaChi ?? null,
        package_code: packageCode,

        is_active: r?.ApDung === false || r?.State === true ? false : true,
        raw: { ...(r ?? {}), MaCT: tenantCode, MaCTDK: legacyRef || tenantCode },
      };
    });
    const { error } = await t("cloud_companies").upsert(payload as any, {
      onConflict: "code",
    });
    if (error) throw error;
  });
};

/** Khoá định danh duy nhất của 1 công ty (ưu tiên ID/MaCTDK, sau đó là MaCT) */
export const companyKey = (r: any): string => {
  const id = r?.ID ?? r?.Id ?? r?.id;
  if (id != null && String(id) !== "") return `id:${String(id)}`;
  const ref = r?.MaCTDK ?? r?.maCTDK;
  if (ref != null && String(ref) !== "") return `ref:${String(ref)}`;
  return `ct:${String(r?.MaCT ?? "").trim().toLowerCase()}`;
};

/** Loại bỏ công ty trùng: giữ bản ghi xuất hiện sau cùng (mới nhất) */
export const dedupeCompanies = (rows: any[]): any[] => {
  const map = new Map<string, any>();
  (rows || []).forEach((r) => map.set(companyKey(r), r));
  return Array.from(map.values());
};

export const listCompaniesFromCloud = async (): Promise<any[]> => {
  const res = await safe(async () => {
    const { data, error } = await t("cloud_companies").select("*")
      .order("updated_at", { ascending: true });
    if (error) throw error;
    return dedupeCompanies(
      (data || []).map((r: any) => ({
        ...(r.raw || {}),
        ID: r.raw?.ID ?? r.id,
        CompanyId: r.id,
        MaCT: r.code,
        TenCT: r.ten_ct,
        Email: r.email,
        Email1: r.email ?? (r.raw || {}).Email1 ?? null,
        DienThoai: r.dien_thoai ?? (r.raw || {}).DienThoai ?? null,
        DienThoai1: r.dien_thoai ?? (r.raw || {}).DienThoai1 ?? null,
        DiaChi: r.dia_chi,
        Server: (r.raw || {}).Server ?? null,
        Key: (r.raw || {}).Key ?? null,
        MaNhomSP: (r.raw || {}).MaNhomSP ?? null,
        MaCTDK: r.code,
        PackageCode: r.package_code,
      }))
    );

  });
  if (res?.length) return res;
  return [];
};



// ==================== 2. PHÂN QUYỀN FORM THEO CÔNG TY ====================
const companyRef = (company: any): string =>
  String(company?.MaCT ?? company?.code ?? company?.MaCTDK ?? company?.maCTDK ?? "").trim();

export const mirrorCompanyFormPermissions = async (
  company: any,
  forms: any[]
) => {
  const ma_ctdk = tenant();
  const ref = companyRef(company);
  if (!ma_ctdk || !ref || !forms?.length) return;
  await safe(async () => {
    const payload = forms
      .filter((f) => num(f?.FormID) != null)
      .map((f) => ({
        ma_ctdk,
        ma_ctdk_ref: ref,
        server: company?.Server ?? null,
        form_id: num(f.FormID)!,
        form_name: f?.FormName ?? null,
        module_id_level1: num(f?.ModulIDLevel1),
        has_permission: !!f?.Per,
      }));
    const { error } = await t("cloud_company_form_permissions").upsert(
      payload as any,
      { onConflict: "ma_ctdk,ma_ctdk_ref,form_id" }
    );
    if (error) throw error;
  });
  // Ghi song song sang cấu trúc 3 cấp chuẩn mới
  await PermissionBridge.bridgeCompanyForms(ref, forms as any);

};

export const mirrorCompanyFormPermission = async (
  company: any,
  form: any,
  hasPermission: boolean
) => {
  await mirrorCompanyFormPermissions(company, [
    { ...form, Per: hasPermission ? form?.FormID : null },
  ]);
};

// ==================== 3. GÓI SẢN PHẨM (sys_packages) ====================
// Bảng cũ cloud_module_groups / cloud_module_group_forms đã bị xoá.
const pkgToLegacy = (p: any) => ({
  ID: p.id,
  MaGoi: p.packageCode,
  TenSanPham: p.name,
  SoTienTrenThang: p.pricePerMonth,
  ApDung: p.isActive,
});

/** Giữ tên hàm cũ để màn hình không phải đổi — nay không mirror gì thêm */
export const mirrorModuleGroups = async (_rows: any[]) => {};

/** Lưu gói sản phẩm vào sys_packages */
export const saveModuleGroup = async (row: any): Promise<void> => {
  await SysPackageService.savePackage({
    id: row?.ID && /^[0-9a-f-]{36}$/i.test(String(row.ID)) ? String(row.ID) : null,
    name: String(row?.TenSanPham ?? "").trim(),
    pricePerMonth: row?.SoTienTrenThang,
    isActive: !!row?.ApDung,
  });
};

export const listModuleGroupsFromCloud = async (): Promise<any[]> => {
  const res = await safe(async () => {
    const rows = await SysPackageService.listPackages();
    return rows.map(pkgToLegacy);
  });
  return res || [];
};

// ============ 4. FORM THUỘC GÓI SẢN PHẨM (sys_package_forms) ============
export const mirrorModuleGroupForms = async (
  packageKey: any,
  forms: any[],
) => {
  if (!packageKey || !forms?.length) return;
  await safe(async () => {
    const { idToUid } = await SysPackageService.formIdMaps();
    const on: string[] = [];
    const off: string[] = [];
    for (const f of forms) {
      const uid =
        f?.FormUid || (num(f?.FormID) != null ? idToUid.get(num(f.FormID)!) : undefined);
      if (!uid) continue;
      (f?.Per ? on : off).push(uid);
    }
    if (on.length) await SysPackageService.setPackageForms(packageKey, on, true);
    if (off.length) await SysPackageService.setPackageForms(packageKey, off, false);
  });
};

export const mirrorModuleGroupForm = async (
  packageKey: any,
  form: any,
  hasPermission: boolean
) => {
  await mirrorModuleGroupForms(packageKey, [
    { ...form, Per: hasPermission ? form?.FormID : null },
  ]);
};

/** Nhân bản 1 gói sản phẩm + toàn bộ form đã tích */
export const duplicateModuleGroup = async (
  group: any,
  newName?: string
): Promise<{ ok: boolean; message?: string; group?: any }> => {
  try {
    const clone = await SysPackageService.duplicatePackage(group?.ID, newName);
    return { ok: true, group: pkgToLegacy(clone) };
  } catch (e: any) {
    return { ok: false, message: e?.message || "Nhân bản thất bại" };
  }
};

/** Xoá gói sản phẩm (kèm form của gói) */
export const removeModuleGroupFromCloud = async (group: any) => {
  await safe(async () => {
    await SysPackageService.removePackage(group?.ID ?? group?.MaGoi);
  });
};


// ==================== 5. CẤU HÌNH NGÂN HÀNG ====================
export const mirrorBankConfigs = async (company: any, rows: any[]) => {
  const ma_ctdk = tenant();
  const ref = company?.MaCTDK != null ? String(company.MaCTDK) : "";
  if (!ma_ctdk || !ref || !rows?.length) return;
  await safe(async () => {
    const payload = rows
      .filter((r) => r?.ID != null)
      .map((r) => ({
        ma_ctdk,
        ma_ctdk_ref: ref,
        config_id: String(r.ID),
        ten_ngan_hang: r?.MerchantName ?? r?.TenNganHang ?? null,
        so_tai_khoan: r?.AccountNo ?? r?.SoTaiKhoan ?? null,
        ma_da: r?.MaDA != null ? String(r.MaDA) : null,
        raw: r ?? {},
      }));
    const { error } = await t("cloud_company_bank_configs").upsert(
      payload as any,
      { onConflict: "ma_ctdk,ma_ctdk_ref,config_id" }
    );
    if (error) throw error;
  });
};

export const removeBankConfigFromCloud = async (company: any, id: any) => {
  const ref = company?.MaCTDK != null ? String(company.MaCTDK) : "";
  if (!ref || id == null) return;
  await safe(async () => {
    const { error } = await t("cloud_company_bank_configs")
      .delete()
      .eq("ma_ctdk", tenant())
      .eq("ma_ctdk_ref", ref)
      .eq("config_id", String(id));
    if (error) throw error;
  });
};

// ==================== 6. CÀI ĐẶT THÔNG BÁO ====================
export const mirrorNotificationPerms = async (
  company: any,
  chucNang: { ID: number; Name: string }[],
  checkedIds: number[]
) => {
  const ma_ctdk = tenant();
  const ref = company?.MaCTDK != null ? String(company.MaCTDK) : "";
  if (!ma_ctdk || !ref || !chucNang?.length) return;
  await safe(async () => {
    const payload = chucNang
      .filter((c) => num(c?.ID) != null)
      .map((c) => ({
        ma_ctdk,
        ma_ctdk_ref: ref,
        server: company?.Server ?? null,
        ma_cntb: num(c.ID)!,
        ten_chuc_nang: c?.Name ?? null,
        enabled: checkedIds.includes(c.ID),
      }));
    const { error } = await t("cloud_company_notification_perms").upsert(
      payload as any,
      { onConflict: "ma_ctdk,ma_ctdk_ref,ma_cntb" }
    );
    if (error) throw error;
  });
};


// ==================== ĐỌC DỰ PHÒNG / ƯU TIÊN CLOUD ====================
export const listCompanyFormPermissionsFromCloud = async (
  company: any
): Promise<any[]> => {
  const ref = companyRef(company);
  if (!ref) return [];
  const res = await safe(async () => {
    const { data, error } = await scopeTenant(t("cloud_company_form_permissions").select("*"))
      .eq("ma_ctdk_ref", ref);
    if (error) throw error;
    return (data || []).map((r: any) => ({
      FormID: r.form_id,
      FormName: r.form_name,
      ModulIDLevel1: r.module_id_level1,
      Per: r.has_permission ? r.form_id : null,
    }));
  });
  return res || [];
};

export const listModuleGroupFormsFromCloud = async (
  packageKey: any
): Promise<any[]> => {
  if (!packageKey) return [];
  const res = await safe(async () => {
    const rows = await SysPackageService.packageForms(packageKey);
    return rows.map((r) => ({
      FormUid: r.formUid,
      FormID: r.formId,
      FormName: r.formName,
      ModulIDLevel1: r.moduleIdLevel1,
      Per: r.formId,
    }));
  });
  return res || [];
};


export const listBankConfigsFromCloud = async (
  company: any
): Promise<any[]> => {
  const ref = company?.MaCTDK != null ? String(company.MaCTDK) : "";
  if (!ref) return [];
  const res = await safe(async () => {
    const { data, error } = await scopeTenant(t("cloud_company_bank_configs").select("*"))
      .eq("ma_ctdk_ref", ref)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map((r: any) => ({
      ...(r.raw || {}),
      ID: r.config_id,
      MerchantName: r.ten_ngan_hang,
      AccountNo: r.so_tai_khoan,
      MaDA: r.ma_da,
    }));
  });
  return res || [];
};

export const listNotificationPermsFromCloud = async (
  company: any
): Promise<{ chucNang: any[]; checkedIds: number[] }> => {
  const ref = company?.MaCTDK != null ? String(company.MaCTDK) : "";
  if (!ref) return { chucNang: [], checkedIds: [] };
  const res = await safe(async () => {
    const { data, error } = await scopeTenant(t("cloud_company_notification_perms").select("*"))
      .eq("ma_ctdk_ref", ref)
      .order("ma_cntb", { ascending: true });
    if (error) throw error;
    const rows = data || [];
    return {
      chucNang: rows.map((r: any) => ({ ID: r.ma_cntb, Name: r.ten_chuc_nang })),
      checkedIds: rows.filter((r: any) => r.enabled).map((r: any) => r.ma_cntb),
    };
  });
  return res || { chucNang: [], checkedIds: [] };
};

// ==================== 7. MIRROR TOÀN BỘ CÔNG TY ĐĂNG KÝ ====================
/**
 * Kéo toàn bộ công ty đăng ký từ Beeland → cloud_companies,
 * đồng thời mirror quyền form của từng công ty → cloud_company_form_permissions.
 * Mục tiêu: khi tắt API cũ, phân quyền vẫn hoạt động hoàn toàn từ Cloud theo ma_ctdk.
 */
export const syncAllCompaniesToCloud = async (
  filterRefs?: (string | number)[]
): Promise<{
  companies: number;
  permissions: number;
  errors: string[];
}> => {
  markManualSync();
  const result = { companies: 0, permissions: 0, errors: [] as string[] };
  const ma_ctdk = tenant();
  if (!ma_ctdk) {
    result.errors.push("Chưa xác định được mã công ty đăng ký (ma_ctdk)");
    return result;
  }

  let companies: any[] = [];
  try {
    const res = await CongTyService.getCongTy();
    companies = res?.data || [];
  } catch (e: any) {
    result.errors.push(`Không tải được danh sách công ty: ${e?.message || e}`);
    return result;
  }

  if (filterRefs?.length) {
    const keys = new Set(filterRefs.map((v) => String(v)));
    companies = companies.filter(
      (c) => keys.has(String(c?.MaCTDK ?? "")) || keys.has(String(c?.MaCT ?? ""))
    );
  }

  if (companies.length) {
    await mirrorCompanies(companies);
    result.companies = companies.length;
  }

  for (const c of companies) {
    try {
      const resForm = await PermissionService.TheoCongTy.getForm({
        MaCTDK: c?.MaCTDK,
        Server: c?.Server,
      });
      const forms = resForm?.data || [];
      if (forms.length) {
        await mirrorCompanyFormPermissions(c, forms);
        result.permissions += forms.length;
      }
    } catch (e: any) {
      result.errors.push(`${c?.TenCT || c?.MaCT}: ${e?.message || e}`);
    }
  }

  // Mirror nhóm module (dùng chung cho toàn bộ ma_ctdk)
  try {
    const resGroup = await CongTyService.NhomModules.Get();
    await mirrorModuleGroups(resGroup?.data || []);
  } catch {
    /* bỏ qua */
  }

  return result;
};

// ==================== 8. PHÂN QUYỀN CHẠY BẰNG CLOUD (KHI TẮT API) ====================
/**
 * Dựng lại `menu_congty` (danh sách form công ty được đăng ký) từ Cloud theo ma_ctdk.
 * Dùng khi API cũ tắt/lỗi để phân quyền menu vẫn hoạt động.
 */
export const getCompanyMenuFromCloud = async (
  maCTDK?: string,
  maCTDKRef?: string | number
): Promise<any[]> => {
  const scope = (maCTDK || tenant() || "").toLowerCase();
  if (!scope) return [];
  const res = await safe(async () => {
    const q = t("cloud_company_form_permissions")
      .select("form_id, form_name, module_id_level1, has_permission, ma_ctdk_ref")
      .eq("ma_ctdk", scope)
      .eq("has_permission", true);
    const { data, error } = await q;
    if (error) throw error;
    const ref =
      maCTDKRef != null && typeof maCTDKRef !== "object"
        ? String(maCTDKRef).trim()
        : "";
    // Nhận cả quyền lưu theo mã công ty đăng ký (scope) lẫn theo mã công ty (ref),
    // vì form cấp trên Cloud có thể được ghi ở một trong hai khoá.
    const rows = ((data as any[]) || []).filter((r) => {
      const rr = String(r?.ma_ctdk_ref ?? "");
      if (!ref) return true;
      return rr === ref || rr === scope || rr === "" || rr === "[object Object]";
    });
    const seen = new Set<number>();
    const out: any[] = [];
    for (const r of rows) {
      if (seen.has(r.form_id)) continue;
      seen.add(r.form_id);
      out.push({
        FormID: r.form_id,
        FormName: r.form_name,
        ModulIDLevel1: r.module_id_level1,
      });
    }
    return out;
  });

  return res || [];
};

/**
 * Mirror `menu_congty` lấy từ API cũ lên Cloud theo ma_ctdk để lần sau đọc offline được.
 */
/**
 * Tạo sẵn 1 công ty mặc định trong danh mục Công ty của công ty đăng ký mới.
 * Tên lấy theo thông tin đã khai báo (TenCT / MaCT), để tài khoản mới đăng nhập
 * là đã có công ty dùng ngay thay vì danh sách trống.
 */
export const seedDefaultCompanyCatalog = async (
  maCTDK: string,
  info: {
    MaCT?: string;
    TenCT?: string;
    DiaChi?: string;
    DienThoai?: string;
    Email?: string;
    Fax?: string;
  }
) => {
  const scope = String(maCTDK || tenant() || "").trim().toLowerCase();
  if (!scope) return null;
  const code = String(info?.MaCT ?? scope).trim();
  const name = String(info?.TenCT ?? "").trim() || code.toUpperCase();
  return await safe(async () => {
    const { data: tenantCompany } = await t("cloud_companies")
      .select("id")
      .eq("code", scope)
      .limit(1);
    const tenantCompanyId = ((tenantCompany as any[]) || [])[0]?.id ?? null;
    if (!tenantCompanyId) return null;
    const { data: existed } = await t("dm_companies")
      .select("id")
      .eq("tenant_company_id", tenantCompanyId)
      .limit(1);
    if (((existed as any[]) || []).length) return null;

    const row = {
      ID: 1,
      MaCT: code,
      TenCTVT: name,
      TenCT: code.toUpperCase(),
      DiaChi: info?.DiaChi ?? "",
      DienThoai: info?.DienThoai ?? "",
      Email: info?.Email ?? "",
      Fax: info?.Fax ?? "",
      State: true,
    };
    const { error } = await t("dm_companies").insert(
      {
        ten_ct: row.TenCT,
        ten_ct_vt: name,
        dia_chi: row.DiaChi,
        dien_thoai: row.DienThoai,
        email: row.Email,
        tenant_company_id: tenantCompanyId,
        ap_dung: true,
        is_san: false,
        // Công ty gốc của tenant mới = Chủ đầu tư (loại công ty bắt buộc, 2026-11-05)
        loai_cong_ty: "chu_dau_tu",
        raw: { ...row, TenantCompanyId: tenantCompanyId } as any,
      } as any
    );
    if (error) throw error;
    return row;
  });
};

/** Chỉ nhận mã tham chiếu dạng chuỗi/số (tránh lưu "[object Object]") */
const refCode = (v: any): string | null => {
  if (v == null) return null;
  if (typeof v === "object") return null;
  const s = String(v).trim();
  return s && s !== "[object Object]" ? s : null;
};

export const mirrorCompanyMenu = async (

  maCTDK: string,
  maCTDKRef: string | number | undefined,
  menuCongTy: any[]
) => {
  const scope = (maCTDK || tenant() || "").toLowerCase();
  const ref = refCode(maCTDKRef) ?? scope;
  if (!scope || !menuCongTy?.length) return;

  await safe(async () => {
    const payload = menuCongTy
      .filter((f) => num(f?.FormID) != null)
      .map((f) => ({
        ma_ctdk: scope,
        ma_ctdk_ref: ref,
        form_id: num(f.FormID)!,
        form_name: f?.FormName ?? null,
        module_id_level1: num(f?.ModulIDLevel1),
        has_permission: true,
      }));
    const { error } = await t("cloud_company_form_permissions").upsert(
      payload as any,
      { onConflict: "ma_ctdk,ma_ctdk_ref,form_id" }
    );
    if (error) throw error;
  });
};

/**
 * Đảm bảo `menu_congty` trong localStorage luôn có dữ liệu:
 * nếu API cũ trả rỗng/lỗi → lấy từ Cloud theo ma_ctdk.
 */
export const ensureCompanyMenu = async (
  maCTDK: string,
  menuCongTy: any[],
  maCTDKRef?: string | number
): Promise<any[]> => {
  // Luôn đọc thêm quyền form đã cấp trên Cloud rồi HỢP với menu API cũ,
  // để các form mới chỉ có trên Cloud (vd: Nộp tiền bổ sung) vẫn hiển thị.
  const cloudMenu = await getCompanyMenuFromCloud(maCTDK, maCTDKRef);

  if (menuCongTy?.length) {
    mirrorCompanyMenu(maCTDK, maCTDKRef, menuCongTy);
    if (!cloudMenu.length) return menuCongTy;
    const seen = new Set(
      menuCongTy.map((f: any) => String(f?.FormID ?? f?.formID))
    );
    const merged = [...menuCongTy];
    for (const f of cloudMenu) {
      const k = String(f?.FormID);
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(f);
    }
    localStorage.setItem("menu_congty", JSON.stringify(merged));
    return merged;
  }

  if (cloudMenu.length) {
    localStorage.setItem("menu_congty", JSON.stringify(cloudMenu));
  }
  return cloudMenu;
};

/**
 * Làm mới `menu_congty` ngay trong phiên đang đăng nhập (không cần đăng nhập lại)
 * để các form vừa được cấp quyền trên Cloud hiển thị ngay.
 */
export const refreshCompanyMenu = async (): Promise<any[]> => {
  const scope = (tenant() || "").toLowerCase();
  if (!scope) return [];
  let current: any[] = [];
  try {
    current = JSON.parse(localStorage.getItem("menu_congty") || "[]");
  } catch {
    current = [];
  }
  let ref: any;
  try {
    const au = JSON.parse(localStorage.getItem("authUser") || "{}");
    ref = au?.maCT ?? au?.MaCT;
  } catch {
    ref = undefined;
  }
  const merged = await ensureCompanyMenu(
    scope,
    Array.isArray(current) ? current : [],
    typeof ref === "object" ? undefined : ref
  );
  try {
    const { resetMenuPermissionCache } = await import("../_stubs/lib/menuPermissions");
    resetMenuPermissionCache();
  } catch {
    /* ignore */
  }
  return merged;
};



// ==================== 9. DANH MỤC MODULE / FORM TỪ CLOUD ====================
/** Bản đồ FormID -> tên module (lấy từ danh mục form chuẩn trên Cloud) */
const formModuleNameMap = async (): Promise<Map<number, string>> => {
  const res = await safe(async () => {
    const { data, error } = await t("cloud_form_registry")
      .select("form_id, module_name")
      .not("form_id", "is", null);
    if (error) throw error;
    const m = new Map<number, string>();
    for (const r of (data as any[]) || []) {
      if (r?.form_id != null && r?.module_name) m.set(Number(r.form_id), r.module_name);
    }
    return m;
  });
  return res || new Map();
};

/**
 * Dựng danh sách module cấp 1 từ chính dữ liệu quyền form đã đồng bộ lên Cloud.
 * Dùng khi API cũ tắt (không lấy được `permission/get-modules`).
 */
export const buildModuleLevel1FromForms = async (
  forms: any[]
): Promise<{ ModulID: any; ModulName: string }[]> => {
  const nameMap = await formModuleNameMap();
  const groups = new Map<string, { ModulID: any; ModulName: string; votes: Map<string, number> }>();
  for (const f of forms || []) {
    const key = String(f?.ModulIDLevel1 ?? "0");
    if (!groups.has(key))
      groups.set(key, {
        ModulID: f?.ModulIDLevel1 ?? 0,
        ModulName: "",
        votes: new Map(),
      });
    const g = groups.get(key)!;
    const nm = nameMap.get(Number(f?.FormID));
    if (nm) g.votes.set(nm, (g.votes.get(nm) || 0) + 1);
  }
  return Array.from(groups.values())
    .map((g) => {
      let best = "";
      let bestCount = 0;
      g.votes.forEach((c, n) => {
        if (c > bestCount) {
          best = n;
          bestCount = c;
        }
      });
      return {
        ModulID: g.ModulID,
        ModulName: best || `Nhóm chức năng ${g.ModulID}`,
      };
    })
    .sort((a, b) => Number(a.ModulID) - Number(b.ModulID));
};

/**
 * Danh mục form chuẩn (mẫu) lấy từ toàn bộ dữ liệu quyền đã đồng bộ trên Cloud.
 * Dùng để hiển thị đầy đủ module cho công ty chưa có bản ghi phân quyền nào.
 */
export const listFormCatalogFromCloud = async (): Promise<any[]> => {
  const build = (data: any[]) => {
    const seen = new Map<number, any>();
    for (const r of data || []) {
      if (r?.form_id == null) continue;
      const prev = seen.get(r.form_id);
      // ưu tiên bản ghi có module_id_level1 để không bị rơi vào nhóm "Khác"
      if (prev && (prev.ModulIDLevel1 != null || r.module_id_level1 == null)) continue;
      seen.set(r.form_id, {
        FormID: r.form_id,
        FormName: r.form_name,
        ModulIDLevel1: r.module_id_level1,
        Per: null,
      });
    }
    return Array.from(seen.values()).sort((a, b) => a.FormID - b.FormID);
  };

  /** Bảng tra tên form chuẩn (dùng khi bản ghi của tenant thiếu form_name) */
  const nameMap = async (): Promise<Map<string, string>> => {
    const map = new Map<string, string>();
    const rows = await safe(async () => {
      const { data, error } = await t("cloud_form_registry")
        .select("form_id, form_name")
        .limit(5000);
      if (error) throw error;
      return (data as any[]) || [];
    });
    for (const r of rows || []) {
      if (r?.form_id != null && r?.form_name)
        map.set(String(r.form_id), r.form_name);
    }
    // bổ sung từ các tenant khác đã có tên
    const rows2 = await safe(async () => {
      const { data, error } = await t("cloud_company_form_permissions")
        .select("form_id, form_name")
        .not("form_name", "is", null)
        .limit(5000);
      if (error) throw error;
      return (data as any[]) || [];
    });
    for (const r of rows2 || []) {
      const k = String(r?.form_id);
      if (r?.form_id != null && r?.form_name && !map.has(k))
        map.set(k, r.form_name);
    }
    return map;
  };

  const res = await safe(async () => {
    // 1) Ưu tiên dữ liệu của chính tenant hiện tại (beesky1 = super tenant sẽ thấy toàn bộ)
    const own = await scopeTenant(
      t("cloud_company_form_permissions").select("form_id, form_name, module_id_level1")
    ).limit(5000);
    if (own.error) throw own.error;
    const ownRows = build((own.data as any[]) || []);
    if (ownRows.length) return ownRows;

    // 2) Dự phòng: lấy danh mục chung
    const { data, error } = await t("cloud_company_form_permissions")
      .select("form_id, form_name, module_id_level1")
      .limit(5000);
    if (error) throw error;
    return build((data as any[]) || []);
  });

  const list = res || [];
  if (list.some((r: any) => !r?.FormName)) {
    const map = await nameMap();
    return list.map((r: any) =>
      r?.FormName
        ? r
        : { ...r, FormName: map.get(String(r.FormID)) || `Chức năng ${r.FormID}` }
    );
  }
  return list;
};



/**
 * Đổi mã công ty dùng để đăng nhập (MaCT) — cập nhật cả Cloud lẫn API cũ.
 * Đồng thời chuyển các tài khoản Cloud đang gắn mã cũ sang mã mới.
 */
export const renameCompanyCode = async (
  company: any,
  newCode: string,
): Promise<{ ok: boolean; message?: string }> => {
  const oldCode = String(company?.MaCT ?? "").trim();
  const next = String(newCode ?? "").trim();
  if (!next) return { ok: false, message: "Chưa nhập mã đăng nhập mới" };
  if (!oldCode) return { ok: false, message: "Không xác định được mã hiện tại" };
  if (next.toLowerCase() === oldCode.toLowerCase())
    return { ok: false, message: "Mã mới trùng mã hiện tại" };

  const nextLower = next.toLowerCase();
  const oldLower = oldCode.toLowerCase();

  // 0) Không cho trùng mã với công ty đăng ký khác
  const dup = await safe(async () => {
    const { data } = await t("cloud_companies")
      .select("id,code")
      .eq("code", nextLower);
    return ((data as any[]) || []).filter(
      (r: any) => String(r?.id ?? "") !== String(company?.CompanyId ?? company?.id ?? "")
    );

  });
  if (dup?.length) return { ok: false, message: `Mã "${next}" đã được dùng` };

  // 1) Cloud: bảng công ty đăng ký (tenant)
  await safe(async () => {
    const rawNext = { ...(company || {}), MaCT: nextLower, code: nextLower };
    let q = t("cloud_companies").update({
      code: nextLower,
      raw: rawNext as any,
    });
    if (company?.CompanyId || company?.id) q = q.eq("id", company.CompanyId ?? company.id);
    else q = q.eq("code", oldLower);
    const { error } = await q;
    if (error) throw error;
  });

  // 2) Cloud: dữ liệu theo tenant cũ chuyển sang mã mới
  await safe(async () => {
    const tables = [
      "cloud_users",
      "cloud_company_form_permissions",
      "dm_employees",
      "cloud_catalogs",
    ];
    for (const name of tables) {
      const { error } = await t(name).update({ ma_ctdk: nextLower } as any).eq("ma_ctdk", oldLower);
      if (error) throw error;
    }
  });

  // 3) API cũ (nếu còn bật)
  await safe(async () => {
    await CongTyService.addCongTy({ ...(company || {}), MaCT: next });
  });

  return { ok: true };
};


export const CompanyAuthCloudService = {
  renameCompanyCode,
  companyKey,
  dedupeCompanies,

  mirrorCompanies,
  listCompaniesFromCloud,
  mirrorCompanyFormPermissions,
  mirrorCompanyFormPermission,
  mirrorModuleGroups,
  saveModuleGroup,
  listModuleGroupsFromCloud,
  mirrorModuleGroupForms,
  mirrorModuleGroupForm,
  duplicateModuleGroup,
  removeModuleGroupFromCloud,
  mirrorBankConfigs,
  removeBankConfigFromCloud,
  mirrorNotificationPerms,
  listCompanyFormPermissionsFromCloud,
  listModuleGroupFormsFromCloud,
  listBankConfigsFromCloud,
  listNotificationPermsFromCloud,
  syncAllCompaniesToCloud,
  getCompanyMenuFromCloud,
  mirrorCompanyMenu,
  seedDefaultCompanyCatalog,
  ensureCompanyMenu,
  refreshCompanyMenu,
  buildModuleLevel1FromForms,
  listFormCatalogFromCloud,
};
