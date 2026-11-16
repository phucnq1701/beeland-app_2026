// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/sales/signing-shift-config/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Cấu hình **loại thủ tục** (+ hồ sơ) + **ca làm việc** theo BỘ (Dự án, Quỹ, Điểm ký) — Bán hàng › Cài đặt › Cấu hình ca làm việc.
 * Mỗi bộ có thủ tục / ca riêng; một dự án có nhiều bộ (mỗi điểm ký một bộ, quỹ riêng ưu tiên hơn "tất cả quỹ").
 * Máy chủ: fn_signing_config_list / _get / _save / _delete (kiểm quyền + phạm vi dự án). Quyết định DK1–DK13.
 */
import { rpcRaw } from "../../_core/rpc";
import { toConfig, toConfigRow, toSavePayload } from "./mapper";
import type { ConfigKey, ConfigRow, ProcedureType, SigningConfig, SigningConfigRaw, WorkShift } from "./types";

export type { ConfigKey, ConfigRow, DoiTuongHoSo, HoSoRef, ProcedureType, SigningConfig, WorkShift } from "./types";

/** Mẫu nạp bằng nút "Nạp mẫu" trên màn hình (chưa lưu) */
export const DEFAULT_PROCEDURES: ProcedureType[] = [
  { code: "KY_HDMB", name: "Ký hợp đồng mua bán", order: 1, active: true },
  { code: "KY_DC", name: "Ký đặt cọc", order: 2, active: true },
  { code: "KY_VBTT", name: "Ký văn bản thỏa thuận", order: 3, active: true },
  { code: "KY_PLHD", name: "Ký phụ lục hợp đồng", order: 4, active: true },
  { code: "BAN_GIAO", name: "Bàn giao sản phẩm", order: 5, active: true },
];

export const DEFAULT_SHIFTS: WorkShift[] = [
  { code: "SANG_1", name: "Ca sáng 1", from: "08:00", to: "10:00", procedures: [], capacity: 10, order: 1, active: true },
  { code: "SANG_2", name: "Ca sáng 2", from: "10:00", to: "12:00", procedures: [], capacity: 10, order: 2, active: true },
  { code: "CHIEU_1", name: "Ca chiều 1", from: "13:30", to: "15:30", procedures: [], capacity: 10, order: 3, active: true },
  { code: "CHIEU_2", name: "Ca chiều 2", from: "15:30", to: "17:30", procedures: [], capacity: 10, order: 4, active: true },
];

/** Sinh mã từ tên (bỏ dấu, viết hoa, A-Z 0-9 _), đảm bảo không trùng */
export const genCode = (name: string, existing: string[]) => {
  const base =
    (name || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 20) || "MUC";
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
};

export const SigningConfigService = {
  /** Nơi gọi cũ: bộ "tất cả quỹ, chưa gán điểm" của dự án (chưa có ⇒ rỗng) */
  getConfig: async (projectId: string | null): Promise<SigningConfig> =>
    toConfig(await rpcRaw<SigningConfigRaw>("fn_signing_config_get", { p_project_id: projectId })),

  /** Một bộ theo id */
  getConfigById: async (configId: string): Promise<SigningConfig> =>
    toConfig(await rpcRaw<SigningConfigRaw>("fn_signing_config_get", { p_config_id: configId })),

  /** Bảng các bộ (lọc dự án tuỳ chọn) — quyền Xem ở Cài đặt */
  listConfigs: async (projectId?: string | null): Promise<ConfigRow[]> => {
    const r = await rpcRaw<{ rows?: unknown[] }>("fn_signing_config_list", { p_project_id: projectId ?? null });
    return (r?.rows ?? []).map(toConfigRow);
  },

  /** Thêm / sửa một bộ (thủ tục + hồ sơ + ca ghi đè trong bộ) */
  saveBundle: async (key: ConfigKey, procedures: ProcedureType[], shifts: WorkShift[]): Promise<SigningConfig> =>
    toConfig(
      await rpcRaw<SigningConfigRaw>("fn_signing_config_save", {
        p_config_id: key.configId ?? null,
        p_project_id: key.projectId,
        p_quy_id: key.quyId ?? null,
        p_diem_ky_id: key.diemKyId ?? null,
        p_is_active: key.isActive ?? null,
        ...toSavePayload(procedures, shifts),
      })
    ),

  /** Nơi gọi cũ: ghi đè bộ "tất cả quỹ, chưa gán điểm" của dự án */
  saveConfig: async (projectId: string, procedures: ProcedureType[], shifts: WorkShift[]): Promise<SigningConfig> =>
    toConfig(
      await rpcRaw<SigningConfigRaw>("fn_signing_config_save", {
        p_project_id: projectId,
        ...toSavePayload(procedures, shifts),
      })
    ),

  /** Xoá bộ (máy chủ chặn khi đã có lịch ký / bàn giao dùng) */
  deleteConfig: async (configId: string): Promise<void> => {
    await rpcRaw("fn_signing_config_delete", { p_config_id: configId });
  },
};

export default SigningConfigService;
