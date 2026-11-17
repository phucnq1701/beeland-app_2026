// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/system/status-catalog/tree.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import type { StatusGroup, StatusOverride } from "./types";

/** Dòng cấp 3: màu riêng của 1 công ty cho 1 trạng thái */
export interface StatusTreeCompanyRow {
  key: string;
  level: "company";
  itemId: string;
  override: StatusOverride;
}

/** Dòng cấp 2: trạng thái (cấp 1 của danh mục). Không có hành động xoá. */
export interface StatusTreeItemRow<T> {
  key: string;
  level: "item";
  item: T;
  children?: StatusTreeCompanyRow[];
}

/** Dòng cấp 1: nhóm (group_code). code null = "Chưa phân nhóm". */
export interface StatusTreeGroupRow<T> {
  key: string;
  level: "group";
  code: string | null;
  name: string;
  thu_tu: number | null;
  count: number;
  /** Chỉ nhóm thật và rỗng mới xoá được */
  canDelete: boolean;
  children: StatusTreeItemRow<T>[];
}

export type StatusTreeRow<T> = StatusTreeGroupRow<T> | StatusTreeItemRow<T> | StatusTreeCompanyRow;

export const UNGROUPED_NAME = "Chưa phân nhóm";

type TreeItem = { id: string; item_code: string; group_code: string | null; overrides?: StatusOverride[] };

const codeNum = (c: string) => {
  const n = Number(c);
  return Number.isFinite(n) && String(c).trim() !== "" ? n : Number.MAX_SAFE_INTEGER;
};

const fold = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();

/** Lọc trạng thái theo tên hoặc mã (không phân biệt dấu, hoa thường). Từ khoá rỗng ⇒ giữ nguyên. */
export function filterStatusItems<T extends { item_code: string; item_name?: string | null }>(items: T[], keyword: string): T[] {
  const k = fold(keyword);
  if (!k) return items;
  return items.filter((i) => fold(i.item_name).includes(k) || fold(i.item_code).includes(k));
}

/**
 * Danh sách phẳng Trạng thái → Màu công ty (trạng thái sản phẩm không phân nhóm), sắp theo mã số.
 * `companyId` ⇒ chỉ giữ màu riêng của công ty đó.
 */
export function buildFlatStatusRows<T extends TreeItem>(items: T[], companyId?: string | null): StatusTreeItemRow<T>[] {
  return [...items]
    .sort((a, b) => codeNum(a.item_code) - codeNum(b.item_code) || a.item_code.localeCompare(b.item_code))
    .map((it) => {
      const ovs = (it.overrides || []).filter((o) => !companyId || o.company_id === companyId);
      const row: StatusTreeItemRow<T> = { key: `i:${it.id}`, level: "item", item: it };
      if (ovs.length)
        row.children = ovs.map((o) => ({ key: `c:${it.id}:${o.company_id}`, level: "company", itemId: it.id, override: o }));
      return row;
    });
}

/**
 * Cây Nhóm → Trạng thái → Màu công ty cho màn cấu hình / danh mục trạng thái.
 * Nhóm sắp theo thu_tu rồi mã; "Chưa phân nhóm" ở cuối và chỉ có khi còn trạng thái chưa nhóm.
 * `companyId` ⇒ chỉ giữ màu riêng của công ty đó.
 */
export function buildStatusTree<T extends TreeItem>(
  groups: StatusGroup[],
  items: T[],
  companyId?: string | null
): StatusTreeGroupRow<T>[] {
  const byGroup = new Map<string | null, T[]>();
  const known = new Set(groups.map((g) => g.code));
  items.forEach((it) => {
    const g = it.group_code && known.has(it.group_code) ? it.group_code : null;
    byGroup.set(g, [...(byGroup.get(g) || []), it]);
  });

  const itemRows = (list: T[]) => buildFlatStatusRows(list, companyId);

  const out: StatusTreeGroupRow<T>[] = [...groups]
    .sort((a, b) => (a.thu_tu ?? Number.MAX_SAFE_INTEGER) - (b.thu_tu ?? Number.MAX_SAFE_INTEGER) || a.code.localeCompare(b.code))
    .map((g) => {
      const children = itemRows(byGroup.get(g.code) || []);
      return {
        key: `g:${g.code}`,
        level: "group",
        code: g.code,
        name: g.name,
        thu_tu: g.thu_tu,
        count: children.length,
        canDelete: children.length === 0,
        children,
      };
    });

  const loose = byGroup.get(null) || [];
  if (loose.length) {
    const children = itemRows(loose);
    out.push({ key: "g:", level: "group", code: null, name: UNGROUPED_NAME, thu_tu: null, count: children.length, canDelete: false, children });
  }
  return out;
}
