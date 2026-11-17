// ⚠️ TỰ SINH — bản chép nguyên văn web src/lib/agencySan.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Sàn giao dịch của tài khoản đại lý đang đăng nhập.
 *
 * Dùng chung cho mọi form Agency Portal (Booking thiện chí, Phiếu đặt cọc,
 * Giữ chỗ, Đặt lịch ký, Nộp tiền bổ sung, Hoàn booking...).
 * KHÔNG ép kiểu số: id sàn hiện là uuid của dm_companies → Number() sẽ ra NaN.
 */
import { isAgencyAccount, getAgencyAliases } from "./agencyScope";
import { sessionBranchId } from "../_shims/lib/session";
import { listSanGiaoDich } from "../services/SanGiaoDichCloudService";

export interface AgencySanInfo {
  /** Giữ nguyên kiểu gốc (uuid hoặc số), không ép Number */
  id: string | number;
  name: string;
}

const norm = (v: any) => String(v ?? "").trim().toLowerCase();

let cache: { at: number; value: AgencySanInfo | null } | null = null;

/** Đọc nhanh (đồng bộ) sàn đại lý — nguồn chuẩn là chi nhánh trong token */
export const agencySanIdSync = (): string | null => {
  if (!isAgencyAccount()) return null;
  const branch = sessionBranchId();
  if (branch) return branch;
  const v = String(localStorage.getItem("agency_san_id") || "").trim();
  return v || null;
};

/**
 * Sàn của tài khoản đại lý (null nếu là tài khoản hệ thống).
 *
 * Nguồn chuẩn: claim `branch_id` trong token = `dm_employees.company_id`
 * (đúng đại lý mà tài khoản được gán). Chỉ khi token cũ không có claim này
 * mới đối chiếu danh sách sàn theo định danh CHÍNH XÁC — tuyệt đối không
 * khớp gần đúng và không lấy bừa bản ghi đầu tiên (gây lộ dữ liệu sàn khác).
 */
export const getAgencySan = async (): Promise<AgencySanInfo | null> => {
  if (!isAgencyAccount()) return null;
  if (cache && Date.now() - cache.at < 60_000) return cache.value;

  let found: AgencySanInfo | null = null;
  const branchId = sessionBranchId();
  try {
    const rows = await listSanGiaoDich();
    let hit: any = null;
    if (branchId) {
      hit = rows.find((s: any) => String(s?.ID) === branchId) ?? null;
      if (!hit) found = { id: branchId, name: "Sàn giao dịch" };
    } else {
      const aliases = [...getAgencyAliases()].filter(Boolean);
      hit =
        rows.find((s: any) =>
          [s?.ID, s?.MaCT, s?.MaSan, s?.MaDL, s?.TenCT, s?.TenSan]
            .map(norm)
            .filter(Boolean)
            .some((f) => aliases.includes(f))
        ) ?? null;
    }
    if (hit?.ID != null) found = { id: hit.ID, name: hit.TenCT || "Sàn giao dịch" };
  } catch {
    if (branchId) found = { id: branchId, name: "Sàn giao dịch" };
  }


  cache = { at: Date.now(), value: found };
  try {
    if (found) {
      localStorage.setItem("agency_san_id", String(found.id));
      localStorage.setItem("agency_san_name", found.name);
    }
  } catch {
    /* bỏ qua */
  }

  return found;
};

export const clearAgencySanCache = () => {
  cache = null;
};

/**
 * Chốt giá trị sàn trước khi ghi dữ liệu: tài khoản đại lý luôn ghi theo sàn
 * của chính mình, bỏ qua giá trị gửi lên từ giao diện.
 */
export const enforceAgencySan = async <T>(value: T): Promise<T | string | number> => {
  if (!isAgencyAccount()) return value;
  const san = await getAgencySan();
  return san ? san.id : value;
};
