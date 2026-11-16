// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/PermissionBridge.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * CẦU NỐI: các màn hình phân quyền hiện tại vẫn ghi vào bảng cũ
 * (cloud_company_form_permissions, cloud_module_group*, cloud_catalogs).
 * Mọi thao tác đó được GHI SONG SONG sang cấu trúc 3 cấp chuẩn mới
 * (sys_packages / sys_package_forms / company_form_permissions / perm_*)
 * để hệ thống chuyển dần sang chuẩn mới mà không gián đoạn.
 *
 * Lỗi ở đây luôn được bỏ qua để không chặn luồng nghiệp vụ.
 */
import { PermissionMatrixService } from "./PermissionMatrixService";

const quiet = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (e) {
    console.warn("[PermissionBridge] bỏ qua:", e);
  }
};

const num = (v: any): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Cấp 2 — quyền form của công ty đăng ký (theo mã công ty text hoặc uuid) */
export const bridgeCompanyForms = (
  companyKey: string,
  forms: Array<{ FormID?: any; formID?: any; Per?: any; per?: any }>,
) =>
  quiet(async () => {
    const company = await PermissionMatrixService.getCompany(companyKey);
    if (!company?.id) return;
    const rows = forms
      .map((f) => ({
        formId: num(f.FormID ?? f.formID),
        hasPermission: (f.Per ?? f.per) != null,
      }))
      .filter((r) => r.formId != null) as Array<{ formId: number; hasPermission: boolean }>;
    if (rows.length) await PermissionMatrixService.setCompanyForms(company.id, rows);
  });

/** Cấp 1 — gói sản phẩm (sys_packages) */
export const bridgePackage = (row: {
  ID?: any;
  TenSanPham?: any;
  SoTienTrenThang?: any;
  ApDung?: any;
}) =>
  quiet(async () => {
    const name = String(row?.TenSanPham ?? "").trim();
    if (!name) return;
    const { SysPackageService } = await import("./SysPackageService");
    await SysPackageService.savePackage({
      id: /^[0-9a-f-]{36}$/i.test(String(row?.ID ?? "")) ? String(row.ID) : null,
      name,
      pricePerMonth: row?.SoTienTrenThang,
      isActive: !!row?.ApDung,
    });
  });

/** Cấp 1 — form thuộc gói sản phẩm (sys_package_forms) */
export const bridgePackageForms = (
  packageKey: any,
  forms: Array<{ FormID?: any; formID?: any; FormUid?: any; Per?: any; per?: any }>,
) =>
  quiet(async () => {
    if (!packageKey || !forms?.length) return;
    const { SysPackageService } = await import("./SysPackageService");
    const { idToUid } = await SysPackageService.formIdMaps();
    const on: string[] = [];
    const off: string[] = [];
    for (const f of forms) {
      const fid = num(f.FormID ?? f.formID);
      const uid = f.FormUid || (fid != null ? idToUid.get(fid) : undefined);
      if (!uid) continue;
      ((f.Per ?? f.per) != null ? on : off).push(String(uid));
    }
    if (on.length) await SysPackageService.setPackageForms(packageKey, on, true);
    if (off.length) await SysPackageService.setPackageForms(packageKey, off, false);
  });


/** Cấp 3 — gán vai trò cho người dùng */
export const bridgeUserRoles = (
  rows: Array<{
    userCode: string;
    email?: string | null;
    fullName?: string | null;
    accountType: "SYSTEM" | "AGENCY";
    perID: number | null;
  }>,
) =>
  quiet(async () => {
    // Dữ liệu cũ chỉ có perID, không đủ UUID nhóm quyền để gán an toàn.
    // Luồng mới chỉ gán từ drawer bằng employee_id + group_uid.
    void rows;
  });

export const PermissionBridge = {
  bridgeCompanyForms,
  bridgePackage,
  bridgePackageForms,
  bridgeUserRoles,
};

export default PermissionBridge;
