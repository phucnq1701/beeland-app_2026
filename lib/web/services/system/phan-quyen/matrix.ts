// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/system/phan-quyen/matrix.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Ma trận phân quyền — hàm thuần (không gọi mạng), dùng cho tab Phân quyền / Gán người dùng / màn Nhân viên.
 * Quy tắc (docs-claude/09-decisions.md PQ1–PQ14): cây nhóm chỉ để sắp xếp; chỉ nhóm cuối có quyền + nhân viên;
 * ô không tích thao tác ⇒ "không cấp" (PQ12); dòng cũ has_permission + [] = mọi thao tác.
 */
import type { CellInput, MatrixCell, MatrixForm, MatrixMe, MatrixModule, PermGroup, ScopeCode } from "./types";

export interface GroupNode extends PermGroup {
  children: GroupNode[];
}

const byOrder = (a: PermGroup, b: PermGroup) =>
  a.sort_order - b.sort_order || a.per_name.localeCompare(b.per_name, "vi");

/** Danh sách phẳng ⇒ cây (sắp theo thứ tự, tên). Nhóm có cha không tồn tại thì coi là gốc. */
export function buildGroupTree(groups: PermGroup[]): GroupNode[] {
  const map = new Map<string, GroupNode>();
  for (const g of groups) map.set(g.id, { ...g, children: [] });
  const roots: GroupNode[] = [];
  for (const node of map.values()) {
    const parent = node.parent_id ? map.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (list: GroupNode[]) => {
    list.sort(byOrder);
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

/** Nhóm cuối theo thứ tự hiển thị (duyệt sâu) — mỗi nhóm cuối là 1 cột của ma trận */
export function leafGroups(tree: GroupNode[]): GroupNode[] {
  const out: GroupNode[] = [];
  const walk = (list: GroupNode[]) =>
    list.forEach((n) => (n.children.length ? walk(n.children) : out.push(n)));
  walk(tree);
  return out;
}

/** Số tầng tiêu đề (= độ sâu lớn nhất của cây) */
export function treeHeight(tree: GroupNode[]): number {
  return tree.reduce((h, n) => Math.max(h, 1 + treeHeight(n.children)), 0);
}

/** Các nhóm theo thứ tự hiển thị kèm độ sâu (cho bảng cây / ô chọn) */
export function flattenGroups(tree: GroupNode[], depth = 0): Array<GroupNode & { level: number }> {
  return tree.flatMap((n) => [{ ...n, level: depth }, ...flattenGroups(n.children, depth + 1)]);
}

/** Ô chọn nhóm cho nhân viên: chỉ nhóm cuối, nhãn theo đường dẫn (PQ14) */
export function leafGroupOptions(groups: PermGroup[]): Array<{ value: string; label: string }> {
  return leafGroups(buildGroupTree(groups)).map((g) => ({ value: g.id, label: g.path || g.per_name }));
}

export interface ParentOption {
  value: string;
  /** Tên kèm lý do nếu không chọn được */
  title: string;
  path: string;
  disabled: boolean;
  children: ParentOption[];
}

/**
 * Cây nhóm cho ô "Nhóm cấp trên": hiện đủ mọi nhóm để người dùng thấy đúng sơ đồ; nhóm không chọn được thì mờ và ghi lý do
 * (chính nó / con cháu của nó, hoặc đang có nhân viên / quyền — máy chủ cũng chặn).
 */
export function parentOptionTree(groups: PermGroup[], groupId?: string | null): ParentOption[] {
  const walk = (nodes: GroupNode[], inside: boolean): ParentOption[] =>
    nodes.map((n) => {
      const self = n.id === groupId;
      const blockedTree = inside || self;
      const busy = [n.n_employees > 0 && `${n.n_employees} nhân viên`, n.n_forms > 0 && `${n.n_forms} quyền`].filter(Boolean).join(", ");
      const reason = self ? "chính nhóm này" : inside ? "nhóm con của nhóm này" : busy ? `đang có ${busy}` : "";
      return {
        value: n.id,
        title: reason ? `${n.per_name} (${reason})` : n.per_name,
        path: n.path || n.per_name,
        disabled: !!reason,
        children: walk(n.children, blockedTree),
      };
    });
  return walk(buildGroupTree(groups), false);
}

export const cellKey = (groupUid: string, formUid: string) => `${groupUid}|${formUid}`;

/** Ô đã lưu theo khoá nhóm|form */
export function indexCells(cells: MatrixCell[]): Map<string, MatrixCell> {
  return new Map(cells.map((c) => [cellKey(c.group_uid, c.form_uid), c]));
}

export type CellKind = "none" | "some" | "all" | "legacy-all";

export interface CellView {
  kind: CellKind;
  /** thao tác đang cấp (dòng cũ "mọi thao tác" ⇒ toàn bộ thao tác của form) */
  selected: string[];
  count: number;
  total: number;
  scope: ScopeCode;
  label: string;
}

/** Trạng thái hiển thị của 1 ô */
export function cellView(cell: MatrixCell | undefined, form: MatrixForm): CellView {
  const total = form.features.length;
  const scope: ScopeCode = cell?.type_code === "EMPLOYEE" ? "EMPLOYEE" : "COMPANY";
  if (!cell || !cell.has_permission) {
    return { kind: "none", selected: [], count: 0, total, scope, label: `0/${total}` };
  }
  if (!cell.features.length) {
    return { kind: "legacy-all", selected: [...form.features], count: total, total, scope, label: "Tất cả" };
  }
  const selected = normalizeFeatures(cell.features, form.features);
  const count = selected.length;
  return { kind: count >= total ? "all" : "some", selected, count, total, scope, label: `${count}/${total}` };
}

/** Bỏ trùng, chữ hoa, chỉ giữ thao tác của form, theo thứ tự thao tác của form */
export function normalizeFeatures(list: string[], formFeatures: string[]): string[] {
  const want = new Set(list.map((c) => String(c).trim().toUpperCase()).filter(Boolean));
  return formFeatures.filter((c) => want.has(c.toUpperCase()));
}

/** Ô gửi lên máy chủ */
export function toCellInput(groupUid: string, form: MatrixForm, features: string[], scope: ScopeCode): CellInput {
  return { group_uid: groupUid, form_uid: form.form_uid, features: normalizeFeatures(features, form.features), type_code: scope };
}

/** Mọi chức năng của 1 module / nhóm chức năng */
export function formsOf(node: MatrixModule | MatrixModule["groups"][number]): MatrixForm[] {
  return "groups" in node ? node.groups.flatMap((g) => g.forms) : node.forms;
}

export type BulkMode = "all" | "none" | "COMPANY" | "EMPLOYEE";

/**
 * Đặt hàng loạt cho các ô (nhóm × form): all = mọi thao tác của form; none = bỏ hết;
 * COMPANY / EMPLOYEE = chỉ đổi phạm vi các ô đang cấp (ô chưa cấp bỏ qua). Ô không đổi thì không gửi.
 */
export function bulkInputs(
  groupUids: string[],
  forms: MatrixForm[],
  cells: Map<string, MatrixCell>,
  mode: BulkMode,
): CellInput[] {
  const out: CellInput[] = [];
  for (const g of groupUids) {
    for (const f of forms) {
      const cur = cellView(cells.get(cellKey(g, f.form_uid)), f);
      if (mode === "all") {
        if (cur.kind === "all" || !f.features.length) continue;
        out.push(toCellInput(g, f, f.features, cur.scope));
      } else if (mode === "none") {
        if (cur.kind === "none") continue;
        out.push(toCellInput(g, f, [], cur.scope));
      } else {
        if (cur.kind === "none" || cur.scope === mode) continue;
        out.push(toCellInput(g, f, cur.selected, mode));
      }
    }
  }
  return out;
}

/** Áp kết quả lưu vào bản đồ ô (ô gửi rỗng ⇒ has_permission = false như máy chủ) */
export function applyInputs(cells: Map<string, MatrixCell>, inputs: CellInput[]): Map<string, MatrixCell> {
  const next = new Map(cells);
  for (const i of inputs) {
    const key = cellKey(i.group_uid, i.form_uid);
    if (!i.features.length && !next.has(key)) continue;
    next.set(key, {
      group_uid: i.group_uid,
      form_uid: i.form_uid,
      has_permission: i.features.length > 0,
      features: [...i.features],
      type_code: i.type_code,
    });
  }
  return next;
}

export type ColumnScope = ScopeCode | "MIXED" | "NONE";

export const COLUMN_SCOPE_TEXT: Record<ColumnScope, string> = {
  COMPANY: "Theo công ty",
  EMPLOYEE: "Theo nhân viên",
  MIXED: "Tất cả",
  NONE: "Chưa cấp",
};

/** Phạm vi đang áp cho cả cột: giống nhau ở mọi ô đang cấp, "MIXED" nếu lẫn, "NONE" nếu chưa cấp ô nào */
export function columnScope(groupUid: string, forms: MatrixForm[], cells: Map<string, MatrixCell>): ColumnScope {
  let seen: ScopeCode | null = null;
  for (const f of forms) {
    const v = cellView(cells.get(cellKey(groupUid, f.form_uid)), f);
    if (v.kind === "none") continue;
    if (seen && seen !== v.scope) return "MIXED";
    seen = v.scope;
  }
  return seen ?? "NONE";
}

export type ColumnLock = null | "full" | "mine" | "readonly";

/** Cột nhóm bị khoá: nhóm toàn quyền (ô không có tác dụng), nhóm của chính mình, không có quyền sửa */
export function columnLock(group: PermGroup, me: MatrixMe): ColumnLock {
  if (group.is_full_access) return "full";
  if (me.my_groups.includes(group.id)) return "mine";
  if (!me.can_edit) return "readonly";
  return null;
}

export const COLUMN_LOCK_TEXT: Record<Exclude<ColumnLock, null>, string> = {
  full: "Nhóm toàn quyền — được mọi chức năng, không cần phân quyền từng ô",
  mine: "Nhóm bạn đang thuộc — không tự sửa quyền của nhóm mình",
  readonly: "Bạn chỉ có quyền xem phân quyền",
};

/** Tìm chức năng theo tên / đường dẫn / FormID (bỏ dấu) — trả module đã lọc (bỏ nhánh rỗng) */
export function filterModules(modules: MatrixModule[], keyword: string): MatrixModule[] {
  const kw = fold(keyword);
  if (!kw) return modules;
  return modules
    .map((m) => {
      if (fold(m.module_name).includes(kw)) return m;
      const groups = m.groups
        .map((g) =>
          fold(g.group_name).includes(kw)
            ? g
            : {
                ...g,
                forms: g.forms.filter(
                  (f) => fold(f.form_name).includes(kw) || fold(f.form_path || "").includes(kw) || String(f.form_id) === kw,
                ),
              },
        )
        .filter((g) => g.forms.length);
      return { ...m, groups };
    })
    .filter((m) => m.groups.length);
}

export const fold = (s: string) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

/** Thông điệp lỗi hiển thị (máy chủ trả thông điệp nghiệp vụ tiếng Việt) */
export const errorMessage = (e: unknown, fallback: string): string =>
  (e instanceof Error && e.message) || (typeof e === "object" && e && "message" in e && String((e as { message: unknown }).message)) || fallback;
