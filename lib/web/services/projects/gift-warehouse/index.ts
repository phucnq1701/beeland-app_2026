// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/projects/gift-warehouse/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Kho quà tặng (form 9148 `/projects/gift-warehouses`, manual 156) — fn_gift_warehouse_*.
 * Máy chủ kiểm quyền (VIEW / ADD / EDIT / DELETE / STOCK), tenant, tồn kho và mọi ràng buộc; lỗi ném nguyên thông điệp máy chủ.
 */
import { rpcRaw } from "../../_core/rpc";
import type { GiftLoai } from "../gift-catalog/types";
import type {
  GiftWarehouse,
  GiftWarehouseInput,
  GiftWarehouseRow,
  GiftWhGroupPatch,
  GiftWhLedgerPage,
  GiftWhLine,
  GiftWhLineInput,
  GiftWhMove,
  GiftWhMoveInput,
  GiftWhMoveLoai,
  GiftWhMoveResult,
  GiftWhOptions,
  GiftWhProduct,
  GiftWhScope,
  GiftWhStatus,
} from "./types";
import type { GiftWhDocument, PolicyKhoStock } from "./policyKho";

export * from "./types";
export * from "./policyKho";

type Row = Record<string, unknown>;

const parse = (data: unknown): unknown => (typeof data === "string" ? JSON.parse(data) : data);
const obj = (data: unknown): Row => {
  const v = parse(data);
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {};
};
const arr = (data: unknown): Row[] => {
  const v = parse(data);
  return Array.isArray(v) ? v.filter((x): x is Row => !!x && typeof x === "object") : [];
};
const lowerId = (v: unknown) => String(v ?? "").trim().toLowerCase();
const idOrNull = (v: unknown) => (v == null || v === "" ? null : lowerId(v));
const str = (v: unknown) => (v == null ? "" : String(v));
const strOrNull = (v: unknown) => (v == null || v === "" ? null : String(v));
const num = (v: unknown, d = 0) => (v == null || v === "" || !Number.isFinite(Number(v)) ? d : Number(v));
const trimOrNull = (v: string | null | undefined) => v?.trim() || null;
const loai = (v: unknown): GiftLoai => (v === "percentage" ? "percentage" : "fixed_amount");
const STATUSES: GiftWhStatus[] = ["NGUNG", "SAP_HIEU_LUC", "HET_HAN", "DANG_HIEU_LUC"];
const status = (v: unknown): GiftWhStatus => (STATUSES.includes(v as GiftWhStatus) ? (v as GiftWhStatus) : "NGUNG");

const toScope = (r: Row): GiftWhScope => ({
  da_project_id: lowerId(r.da_project_id),
  ten_du_an: str(r.ten_du_an),
  toa_id: idOrNull(r.toa_id),
  ten_toa: strOrNull(r.ten_toa),
});

const toLine = (r: Row): GiftWhLine => ({
  id: lowerId(r.id),
  group_id: lowerId(r.group_id),
  item_id: idOrNull(r.item_id),
  ten_nhom: str(r.ten_nhom),
  ten_qua: strOrNull(r.ten_qua),
  loai: loai(r.loai),
  ten_dvt: strOrNull(r.ten_dvt),
  danh_muc_active: r.danh_muc_active === true,
  sl_nhap: num(r.sl_nhap),
  sl_giu: num(r.sl_giu),
  sl_chung_tu: num(r.sl_chung_tu),
  sl_xuat: num(r.sl_xuat),
  con_lai: num(r.con_lai),
  nguong_canh_bao: num(r.nguong_canh_bao),
  thu_tu: num(r.thu_tu, 1),
  is_active: r.is_active === true,
  co_xuat: r.co_xuat === true,
});

const toWarehouse = (r: Row): GiftWarehouse => ({
  id: lowerId(r.id),
  ten: str(r.ten),
  tu_ngay: str(r.tu_ngay),
  den_ngay: strOrNull(r.den_ngay),
  mo_ta: strOrNull(r.mo_ta),
  is_active: r.is_active === true,
  trang_thai: status(r.trang_thai),
  pham_vi: arr(r.pham_vi).map(toScope),
  lines: arr(r.lines).map(toLine),
});

const toRow = (r: Row): GiftWarehouseRow => ({
  id: lowerId(r.id),
  ten: str(r.ten),
  tu_ngay: str(r.tu_ngay),
  den_ngay: strOrNull(r.den_ngay),
  is_active: r.is_active === true,
  trang_thai: status(r.trang_thai),
  pham_vi: arr(r.pham_vi).map(toScope),
  so_dong: num(r.so_dong),
  so_sap_het: num(r.so_sap_het),
  so_het: num(r.so_het),
});

const toMove = (r: Row): GiftWhMove => ({
  id: lowerId(r.id),
  line_id: lowerId(r.line_id),
  ten_nhom: str(r.ten_nhom),
  ten_qua: strOrNull(r.ten_qua),
  loai: str(r.loai) as GiftWhMoveLoai,
  so_luong: num(r.so_luong),
  con_lai_sau: num(r.con_lai_sau),
  ngay: str(r.ngay),
  ref_move_id: idOrNull(r.ref_move_id),
  so_chung_tu: strOrNull(r.so_chung_tu),
  ma_sp: strOrNull(r.ma_sp),
  ly_do: strOrNull(r.ly_do),
  nguoi_nhap_ten: strOrNull(r.nguoi_nhap_ten),
  ngay_nhap: str(r.ngay_nhap),
  sl_da_hoan: r.sl_da_hoan == null ? null : num(r.sl_da_hoan),
});

const warehousePayload = (v: GiftWarehouseInput) => {
  const p: Record<string, unknown> = {
    ten: (v.ten ?? "").trim(),
    tu_ngay: v.tu_ngay,
    den_ngay: v.den_ngay || null,
    mo_ta: trimOrNull(v.mo_ta),
    is_active: v.is_active !== false,
    pham_vi: v.pham_vi.map((s) => ({ da_project_id: s.da_project_id, toa_id: s.toa_id || null })),
  };
  if (v.lines) p.lines = v.lines.map(linePayload);
  return p;
};

const linePayload = (l: GiftWhLineInput) => ({
  group_id: l.group_id,
  item_id: l.item_id || null,
  so_luong: l.so_luong,
  nguong_canh_bao: l.nguong_canh_bao,
});

const movePayload = (v: GiftWhMoveInput) => {
  const p: Record<string, unknown> = { loai: v.loai, so_luong: v.so_luong, ngay: v.ngay };
  if (v.loai === "DIEU_CHINH") p.tang = v.tang === true;
  if (v.ref_move_id) p.ref_move_id = v.ref_move_id;
  if (v.so_chung_tu !== undefined) p.so_chung_tu = trimOrNull(v.so_chung_tu);
  if (v.bds_product_id) p.bds_product_id = v.bds_product_id;
  if (v.ly_do !== undefined) p.ly_do = trimOrNull(v.ly_do);
  return p;
};

export interface GiftWarehouseFilter {
  daProjectId?: string | null;
  trangThai?: GiftWhStatus | null;
  sapHet?: boolean;
  search?: string;
}

export interface GiftWhLedgerFilter {
  lineId?: string | null;
  loai?: GiftWhMoveLoai | null;
  tu?: string | null;
  den?: string | null;
  page?: number;
  pageSize?: number;
}

/** Tồn theo mức chiết khấu theo kho (fn_gift_warehouse_stock_for_policy) */
export const toPolicyKhoStock = (r: Row): PolicyKhoStock => ({
  option_id: str(r.option_id),
  line_id: lowerId(r.line_id),
  kho_id: lowerId(r.kho_id),
  kho_ten: str(r.kho_ten),
  con_lai: num(r.con_lai),
  suc_chua: num(r.suc_chua),
  nguong: num(r.nguong),
  tu_ngay: str(r.tu_ngay),
  den_ngay: strOrNull(r.den_ngay),
  kho_active: r.kho_active === true,
  pham_vi: arr(r.pham_vi).map((s) => ({ da_project_id: lowerId(s.da_project_id), toa_id: idOrNull(s.toa_id) })),
});

const toDocument = (r: Row): GiftWhDocument => ({
  pgc_id: lowerId(r.pgc_id),
  so_chung_tu: strOrNull(r.so_chung_tu),
  ma_sp: strOrNull(r.ma_sp),
  ctbh_ten: strOrNull(r.ctbh_ten),
  policy_ten: str(r.policy_ten),
  option_ten: str(r.option_ten),
  giai_doan: strOrNull(r.giai_doan),
  nhom: strOrNull(r.nhom),
  chiem_suat: r.chiem_suat === true,
  line_id: lowerId(r.line_id),
});

export interface GiftWhDocumentFilter {
  lineId?: string | null;
  page?: number;
  pageSize?: number;
  /** Tìm trong số chứng từ / mã căn */
  search?: string | null;
  /** Nhóm giai đoạn: GIUCHO | DATCOC | HD | CHUYEN_NHUONG */
  nhom?: string | null;
}

export const giftWarehouseService = {
  async list(f: GiftWarehouseFilter = {}): Promise<GiftWarehouseRow[]> {
    return arr(
      await rpcRaw<unknown>(
        "fn_gift_warehouse_list",
        {
          p_da_project_id: f.daProjectId || null,
          p_trang_thai: f.trangThai || null,
          p_sap_het: f.sapHet ? true : null,
          p_search: f.search?.trim() || null,
        },
        { fallback: "Không tải được danh sách kho quà tặng" }
      )
    ).map(toRow);
  },

  async get(id: string): Promise<GiftWarehouse> {
    return toWarehouse(obj(await rpcRaw<unknown>("fn_gift_warehouse_get", { p_id: id }, { fallback: "Không tải được kho quà tặng" })));
  },

  async options(id?: string | null): Promise<GiftWhOptions> {
    const d = obj(await rpcRaw<unknown>("fn_gift_warehouse_options", { p_id: id || null }, { fallback: "Không tải được dữ liệu chọn" }));
    return {
      projects: arr(d.projects).map((p) => ({
        id: lowerId(p.id),
        ten: str(p.ten),
        toa: arr(p.toa).map((t) => ({ id: lowerId(t.id), ten: str(t.ten) })),
      })),
      groups: arr(d.groups).map((g) => ({
        id: lowerId(g.id),
        ten: str(g.ten),
        loai: loai(g.loai),
        items: arr(g.items).map((i) => ({ id: lowerId(i.id), ten: str(i.ten), ten_dvt: strOrNull(i.ten_dvt) })),
      })),
      da_co: arr(d.da_co).map((x) => ({ group_id: lowerId(x.group_id), item_id: idOrNull(x.item_id) })),
    };
  },

  async save(input: GiftWarehouseInput, id?: string | null): Promise<GiftWarehouse> {
    return toWarehouse(
      obj(await rpcRaw<unknown>("fn_gift_warehouse_save", { p_id: id || null, p_data: warehousePayload(input) }, { fallback: "Không lưu được kho" }))
    );
  },

  async addLines(warehouseId: string, lines: GiftWhLineInput[]): Promise<GiftWarehouse> {
    return toWarehouse(
      obj(
        await rpcRaw<unknown>(
          "fn_gift_warehouse_line_add",
          { p_warehouse_id: warehouseId, p_lines: lines.map(linePayload) },
          { fallback: "Không thêm được quà vào kho" }
        )
      )
    );
  },

  async updateLine(lineId: string, patch: { nguong_canh_bao?: number; is_active?: boolean; bo?: boolean }): Promise<GiftWarehouse> {
    return toWarehouse(
      obj(await rpcRaw<unknown>("fn_gift_warehouse_line_update", { p_line_id: lineId, p_data: patch }, { fallback: "Không cập nhật được dòng quà" }))
    );
  },

  /** Thao tác cả nhóm: lineId là một quà con bất kỳ của nhóm */
  async updateGroup(lineId: string, patch: GiftWhGroupPatch): Promise<GiftWarehouse> {
    return toWarehouse(
      obj(
        await rpcRaw<unknown>(
          "fn_gift_warehouse_line_update",
          { p_line_id: lineId, p_data: { nhom: true, ...patch } },
          { fallback: "Không cập nhật được nhóm quà" }
        )
      )
    );
  },

  async move(lineId: string, input: GiftWhMoveInput): Promise<GiftWhMoveResult> {
    const r = obj(
      await rpcRaw<unknown>("fn_gift_warehouse_move", { p_line_id: lineId, p_data: movePayload(input) }, { fallback: "Không ghi được phát sinh kho" })
    );
    return { move_id: lowerId(r.move_id), con_lai: num(r.con_lai), nguong_canh_bao: num(r.nguong_canh_bao), canh_bao: r.canh_bao === true };
  },

  async ledger(warehouseId: string, f: GiftWhLedgerFilter): Promise<GiftWhLedgerPage> {
    const d = obj(
      await rpcRaw<unknown>(
        "fn_gift_warehouse_ledger",
        {
          p_warehouse_id: warehouseId,
          p_line_id: f.lineId || null,
          p_loai: f.loai || null,
          p_tu: f.tu || null,
          p_den: f.den || null,
          p_page: f.page ?? 1,
          p_page_size: f.pageSize ?? 50,
        },
        { fallback: "Không tải được sổ kho" }
      )
    );
    return { total: num(d.total), rows: arr(d.rows).map(toMove) };
  },

  async searchProducts(warehouseId: string, search: string): Promise<GiftWhProduct[]> {
    return arr(
      await rpcRaw<unknown>(
        "fn_gift_warehouse_product_search",
        { p_warehouse_id: warehouseId, p_search: search.trim() || null },
        { fallback: "Không tìm được căn" }
      )
    ).map((p) => ({ id: lowerId(p.id), ma_sp: str(p.ma_sp), ten_du_an: str(p.ten_du_an), ten_toa: strOrNull(p.ten_toa) }));
  },

  async setActive(id: string, active: boolean): Promise<GiftWarehouse> {
    return toWarehouse(obj(await rpcRaw<unknown>("fn_gift_warehouse_set_active", { p_id: id, p_active: active }, { fallback: "Không đổi được trạng thái" })));
  },

  /** Tồn theo từng mức chiết khấu theo kho của chính sách (form chứng từ); excludePgcId = chứng từ đang sửa */
  async stockForPolicy(policyId: string, excludePgcId?: string | null): Promise<PolicyKhoStock[]> {
    return arr(
      await rpcRaw<unknown>(
        "fn_gift_warehouse_stock_for_policy",
        { p_policy_id: policyId, p_exclude_pgc: excludePgcId || null },
        { fallback: "Không tải được tồn kho quà của chính sách" }
      )
    ).map(toPolicyKhoStock);
  },

  /** Chứng từ đang dùng quà của kho (tab Chứng từ) */
  async documents(warehouseId: string, f: GiftWhDocumentFilter = {}): Promise<{ total: number; rows: GiftWhDocument[] }> {
    const d = obj(
      await rpcRaw<unknown>(
        "fn_gift_warehouse_documents",
        {
          p_warehouse_id: warehouseId,
          p_line_id: f.lineId || null,
          p_page: f.page ?? 1,
          p_page_size: f.pageSize ?? 50,
          p_search: f.search?.trim() || null,
          p_nhom: f.nhom || null,
        },
        { fallback: "Không tải được chứng từ đang dùng quà" }
      )
    );
    return { total: num(d.total), rows: arr(d.rows).map(toDocument) };
  },

  async remove(id: string): Promise<{ id: string }> {
    const r = obj(await rpcRaw<unknown>("fn_gift_warehouse_delete", { p_id: id }, { fallback: "Không xoá được kho" }));
    return { id: lowerId(r.id) };
  },
};

export default giftWarehouseService;
