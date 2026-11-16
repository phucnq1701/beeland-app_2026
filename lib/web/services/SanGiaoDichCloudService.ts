// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/SanGiaoDichCloudService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { listDmAgencies } from "./DmCompanyCloudService";

/**
 * SÀN GIAO DỊCH = ĐẠI LÝ (public.dm_companies, is_san = true)
 * Không còn dùng danh mục `dai_ly` trong cloud_catalogs.
 */
export interface SanGiaoDichItem {
  ID: string | number | null;
  MaSan: string | number | null;
  MaCT: string | number | null;
  TenSan: string;
  TenCT: string;
  [k: string]: any;
}

const toId = (v: any): string | number | null => {
  if (v == null || String(v).trim() === "") return null;
  const s = String(v).trim();
  return /^\d+$/.test(s) ? Number(s) : s;
};

export const normalizeSanGiaoDich = (s: any): SanGiaoDichItem => {
  const id = toId(s?.Id ?? s?.ID ?? s?.MaSan ?? s?.MaCT ?? s?.MaDL ?? s?.item_code);
  const ten = String(
    s?.TenCT ?? s?.TenSan ?? s?.TenCTVT ?? s?.TenDaiLy ?? s?.Name ?? s?.item_name ?? ""
  ).trim();
  return { ...s, ID: id, MaSan: id, MaCT: id, TenSan: ten, TenCT: ten };
};

/** Danh sách sàn giao dịch = đại lý trên dm_companies (is_san = true) */
export const listSanGiaoDich = async (): Promise<SanGiaoDichItem[]> => {
  const rows = await listDmAgencies();
  return (Array.isArray(rows) ? rows : [])
    .map((r: any) =>
      normalizeSanGiaoDich({
        ...r,
        ID: r?.Id ?? r?.ID,
        TenCT: r?.TenCTVT || r?.TenCT,
      })
    )
    .filter((s) => s.ID != null && !!s.TenCT);
};

/** Chuẩn hóa 1 danh sách bất kỳ về SanGiaoDichItem, loại trùng ID */
export const normalizeSanGiaoDichList = (rows: any): SanGiaoDichItem[] => {
  const raw = Array.isArray(rows) ? rows : rows?.data ?? rows?.Data ?? [];
  const map = new Map<string, SanGiaoDichItem>();
  (Array.isArray(raw) ? raw : []).forEach((r: any) => {
    const s = normalizeSanGiaoDich(r);
    if (s.ID == null || !s.TenCT) return;
    if (!map.has(String(s.ID))) map.set(String(s.ID), s);
  });
  return Array.from(map.values());
};

/** Label hiển thị chuẩn của sàn giao dịch */
export const sanGiaoDichLabel = (s: any): string =>
  normalizeSanGiaoDich(s).TenCT || "—";

/** Options chuẩn cho Select (value = ID, label = TenCT) */
export const toSanGiaoDichOptions = (
  list: any
): { label: string; value: any }[] =>
  normalizeSanGiaoDichList(list).map((s) => ({
    label: s.TenCT,
    value: s.ID as any,
  }));

/** Tìm tên sàn theo ID trong 1 danh sách */
export const findSanGiaoDichName = (list: any, id: any): string => {
  if (id == null || id === "") return "";
  const found = normalizeSanGiaoDichList(list).find(
    (s) => String(s.ID) === String(id)
  );
  return found?.TenCT ?? "";
};
