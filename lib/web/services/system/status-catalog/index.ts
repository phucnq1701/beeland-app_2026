// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/system/status-catalog/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { rpcRaw } from "../../_core/rpc";
import { sessionCompanyId } from "../../../_shims/lib/session";
import { toSavePayload, toStatusConfig, toStatusItem } from "./mapper";
import type { StatusConfig, StatusGroup, StatusItem, StatusItemInput, StatusItemRaw, StatusType } from "./types";

/**
 * Trạng thái sản phẩm (bds_trang_thai) / phiếu giữ chỗ (pgc_trang_thai) 2 cấp.
 * Cấp 1 dùng chung (Beesky cấu hình ở Hệ thống > Phân quyền công ty > Cấu hình trạng thái, không xoá được).
 * Cấp 2 = màu riêng của công ty đăng ký (Sản phẩm > Danh mục). Màu hiệu lực = màu công ty, chưa cài thì màu gốc.
 * Đọc/ghi qua RPC fn_status_*: công ty lấy từ JWT, quyền kiểm ở máy chủ.
 */

export type {
  StatusCompany,
  StatusConfig,
  StatusConfigItem,
  StatusGroup,
  StatusItem,
  StatusItemInput,
  StatusOverride,
  StatusType,
} from "./types";

export { buildFlatStatusRows, buildStatusTree, filterStatusItems, UNGROUPED_NAME } from "./tree";
export type { StatusTreeCompanyRow, StatusTreeGroupRow, StatusTreeItemRow, StatusTreeRow } from "./tree";

export const STATUS_TYPES: StatusType[] = ["bds_trang_thai", "pgc_trang_thai"];

export const STATUS_TYPE_LABEL: Record<StatusType, string> = {
  bds_trang_thai: "Trạng thái sản phẩm",
  pgc_trang_thai: "Trạng thái phiếu giữ chỗ",
};

// ---------------------------------------------------------------- cache + thông báo đổi
/** Cache hết hạn sau 2 phút: công ty / Beesky đổi màu ở máy khác thì người đang mở app thấy sau tối đa 2 phút */
export const STATUS_CACHE_TTL_MS = 2 * 60_000;
const cache = new Map<StatusType, { at: number; p: Promise<StatusItem[]> }>();
let colorMap: Promise<Map<string, string | null>> | null = null;
let colorMapAt = 0;
/** Bảng màu đã nạp xong — cho mapper đồng bộ (statusColorOf) */
let knownColors: Map<string, string | null> | null = null;
/** Công ty đăng nhập lúc nạp cache — đổi tài khoản thì bỏ cache */
let cacheTenant = "";
const listeners = new Set<() => void>();

/** Xoá cache danh mục trạng thái (không báo người nghe) */
export const invalidateStatusCatalog = () => {
  cache.clear();
  colorMap = null;
  knownColors = null;
};

const ensureTenant = () => {
  const t = sessionCompanyId() || "";
  if (t !== cacheTenant) {
    invalidateStatusCatalog();
    cacheTenant = t;
  }
};

/** Nghe khi danh mục trạng thái / màu công ty đổi (sau mọi lần ghi). Trả hàm huỷ nghe. */
export const onStatusCatalogChanged = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

const changed = () => {
  invalidateStatusCatalog();
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  });
};

// ---------------------------------------------------------------- đọc
const fetchList = async (type: StatusType, companyId?: string | null) => {
  const rows = await rpcRaw<StatusItemRaw[] | null>(
    "fn_status_catalog_list",
    companyId ? { p_type: type, p_company_id: companyId } : { p_type: type },
    { fallback: "Không tải được danh mục trạng thái" }
  );
  return (Array.isArray(rows) ? rows : []).map(toStatusItem);
};

/**
 * Trạng thái của 1 loại, màu theo công ty đăng ký đang đăng nhập (có cache).
 * `companyId` (chỉ Beesky có hiệu lực) = xem thay công ty khác, không cache.
 */
export const listStatuses = (type: StatusType, companyId?: string | null): Promise<StatusItem[]> => {
  if (companyId) return fetchList(type, companyId);
  ensureTenant();
  const hit = cache.get(type);
  if (hit && Date.now() - hit.at < STATUS_CACHE_TTL_MS) return hit.p;
  const p = fetchList(type);
  const entry = { at: Date.now(), p };
  cache.set(type, entry);
  p.catch(() => {
    if (cache.get(type) === entry) cache.delete(type);
  });
  return p;
};

/** uuid trạng thái (chữ thường) → màu hiệu lực, gộp cả 2 loại (có cache) */
export const loadStatusColorMap = (): Promise<Map<string, string | null>> => {
  ensureTenant();
  if (colorMap && Date.now() - colorMapAt >= STATUS_CACHE_TTL_MS) colorMap = null;
  if (!colorMap) {
    colorMapAt = Date.now();
    const p = Promise.all(STATUS_TYPES.map((t) => listStatuses(t))).then((lists) => {
      const m = new Map<string, string | null>();
      lists.flat().forEach((s) => m.set(s.Uid, s.Mau));
      if (colorMap === p) knownColors = m;
      return m;
    });
    colorMap = p;
    p.catch(() => {
      if (colorMap === p) colorMap = null;
    });
  }
  return colorMap;
};

/**
 * Màu hiệu lực theo uuid trạng thái, đồng bộ — cho mapper không await được (mapSalesDoc, BdsProductService…).
 * Bảng màu chưa nạp ⇒ trả `fallback` (màu gốc trong dữ liệu) và nạp nền cho lần sau.
 */
export const statusColorOf = (id: unknown, fallback: string | null = null): string | null => {
  ensureTenant();
  const key = id ? String(id).toLowerCase() : "";
  if (!key) return fallback;
  // Chưa nạp / hết hạn ⇒ nạp nền; trong lúc chờ dùng bảng cũ (hoặc màu dự phòng)
  if (!colorMap || Date.now() - colorMapAt >= STATUS_CACHE_TTL_MS) loadStatusColorMap().catch(() => undefined);
  if (!knownColors) return fallback;
  return knownColors.has(key) ? knownColors.get(key) ?? fallback : fallback;
};

/** Nạp sẵn bảng màu khi đã đăng nhập (gọi lúc khởi động app) */
export const preloadStatusColors = () => {
  if (sessionCompanyId()) loadStatusColorMap().catch(() => undefined);
};

/**
 * Dữ liệu đọc qua REST nhúng `cloud_catalogs` (vd. `tt:cloud_catalogs!trang_thai_id(id,…,color_code)`):
 * thay `row[key].color_code` bằng màu hiệu lực của công ty. Lỗi đọc danh mục ⇒ trả nguyên dữ liệu.
 */
export const applyStatusColors = async <T>(rows: T[], key: string): Promise<T[]> => {
  if (!Array.isArray(rows) || !rows.length) return rows;
  let m: Map<string, string | null>;
  try {
    m = await loadStatusColorMap();
  } catch {
    return rows;
  }
  rows.forEach((r) => {
    const tt = (r as Record<string, { id?: unknown; color_code?: string | null } | null | undefined> | null)?.[key];
    const id = tt?.id ? String(tt.id).toLowerCase() : "";
    if (id && m.has(id)) tt.color_code = m.get(id) ?? tt.color_code ?? null;
  });
  return rows;
};

/** Cấu hình đầy đủ cho Beesky: nhóm, trạng thái kèm màu riêng từng công ty, danh sách công ty */
export const getStatusConfig = async (type: StatusType): Promise<StatusConfig> =>
  toStatusConfig(
    await rpcRaw<Partial<StatusConfig> | null>("fn_status_config_get", { p_type: type }, {
      fallback: "Không tải được cấu hình trạng thái",
    })
  );

// ---------------------------------------------------------------- ghi
/** Tạo / sửa trạng thái cấp 1 (chỉ Beesky). Không đổi được mã; không có xoá — tắt Áp dụng thay vì xoá. */
export const saveStatus = async (type: StatusType, input: StatusItemInput): Promise<StatusItem> => {
  const r = await rpcRaw<StatusItemRaw>("fn_status_catalog_save", toSavePayload(type, input), {
    fallback: "Không lưu được trạng thái",
  });
  changed();
  return toStatusItem(r);
};

export const saveStatusGroup = async (type: StatusType, g: { code: string; name: string; thu_tu?: number | null }) => {
  const r = await rpcRaw<StatusGroup>(
    "fn_status_group_save",
    { p_type: type, p_code: g.code, p_name: g.name, p_thu_tu: g.thu_tu ?? null },
    { fallback: "Không lưu được nhóm trạng thái" }
  );
  changed();
  return r;
};

/** Xoá nhóm rỗng (máy chủ chặn nhóm còn trạng thái) */
export const deleteStatusGroup = async (type: StatusType, code: string) => {
  await rpcRaw("fn_status_group_delete", { p_type: type, p_code: code }, { fallback: "Không xoá được nhóm trạng thái" });
  changed();
};

/**
 * Màu riêng của công ty đăng ký cho 1 trạng thái. `color` null = dùng màu mặc định (xoá màu riêng).
 * `companyId` chỉ có hiệu lực với Beesky (đặt thay công ty khác).
 */
export const setCompanyStatusColor = async (
  type: StatusType,
  catalogId: string,
  color: string | null,
  companyId?: string | null
): Promise<StatusItem> => {
  const r = await rpcRaw<StatusItemRaw>(
    "fn_status_company_color_set",
    { p_type: type, p_catalog_id: catalogId, p_color: color, p_company_id: companyId ?? null },
    { fallback: "Không lưu được màu trạng thái" }
  );
  changed();
  return toStatusItem(r);
};
