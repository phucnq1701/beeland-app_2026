// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/PackageCatalogService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * GÓI SẢN PHẨM (cấp 1 của phân quyền 3 cấp).
 *
 * Nguồn dữ liệu DUY NHẤT: `sys_packages` + `sys_package_forms`.
 * Bảng cũ (cloud_module_groups / cloud_module_group_forms) đã bị xoá.
 *
 * Khoá gói lưu ở `cloud_companies.package_code` = `sys_packages.package_code`.
 */
import { SysPackageService } from "./SysPackageService";

export interface PackageRow {
  groupId: string;
  name: string;
  pricePerMonth: number | null;
  isActive: boolean;
  maCtdk: string;
}

export interface PackageForm {
  formUid: string;
  formId: number;
  formName: string | null;
  moduleIdLevel1: number | null;
  hasPermission: boolean;
}

const map = (p: any): PackageRow => ({
  groupId: p.packageCode,
  name: p.name,
  pricePerMonth: p.pricePerMonth,
  isActive: p.isActive,
  maCtdk: "",
});

export const listPackages = async (): Promise<PackageRow[]> =>
  (await SysPackageService.listPackages()).map(map);

export const getPackage = async (key: string): Promise<PackageRow | null> => {
  const p = await SysPackageService.getPackage(key);
  return p ? map(p) : null;
};

/** Toàn bộ form được mở trong gói */
export const packageForms = async (key: string): Promise<PackageForm[]> => {
  const rows = await SysPackageService.packageForms(key);
  return rows.map((r) => ({ ...r, hasPermission: true }));
};

export const packageFormIds = (key: string): Promise<Set<number>> =>
  SysPackageService.packageFormIds(key);

export const PackageCatalogService = {
  listPackages,
  getPackage,
  packageForms,
  packageFormIds,
};

export default PackageCatalogService;
