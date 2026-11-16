// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/products/price-sheet/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { rpcRaw } from "../../_core/rpc";
import { cleanCompanyIds } from "../../../_extract/services/system/permitted-company";

/**
 * Phiếu tính giá (bảng price_sheets / price_sheet_versions) — chỉ đọc/ghi qua hàm máy chủ
 * (migration 20261014130000_price_sheet_rpc). Công ty + nhân viên lấy từ JWT; phạm vi = dự án được gán;
 * lưu = 1 RPC (máy chủ suy căn / dự án / khách / sàn / tiền từ payload, ghi phiên bản + giá gốc căn).
 * Quyền lưu: ADD/EDIT Phiếu tính giá hoặc EDIT ở màn chủ (truyền `hostForm` khi lưu từ tab nhúng).
 */
export interface PriceSheetOpenStep {
  step_run_id: string;
  ten_buoc: string | null;
  nhan_hien_thi: string | null;
  loai: "approval" | "execution";
  han_xu_ly: string | null;
  /** Phòng ban của người được giao (nhiều phòng ban ngăn bởi ", ") */
  bo_phan: string | null;
  nguoi_xu_ly: string | null;
}

export interface CloudPriceSheet {
  id: string;
  sheet_code: string;
  so_phieu?: string | null;
  product_code: string;
  product_name: string | null;
  product_type: string | null;
  area: number | null;
  unit_price: number;
  base_price: number;
  vat_rate: number;
  maintenance_rate: number;
  status: string;
  /** Ngày hết hạn phiếu 'YYYY-MM-DD' (null = không thời hạn) */
  ngay_het_han?: string | null;
  /** Chỉ phiếu đã duyệt: còn hạn so với hôm nay (giờ VN); null khi chưa duyệt */
  con_han?: boolean | number | null;
  created_at: string;
  da_project_id?: string | null;
  san_pham_id?: string | null;
  khach_hang_id?: string | null;
  pgc_id?: string | null;
  policy_name?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  reject_reason?: string | null;
  folder_id?: string | null;
  deleted_at?: string | null;
  wf_submission_id?: string | null;
  /** Phiếu Đang duyệt theo quy trình: các cấp đang mở (tên bước, bộ phận, người xử lý, hạn) */
  wf_dang_duyet?: PriceSheetOpenStep[] | null;
  /** Chỉ có ở bản đầy đủ (get / lưu) */
  payload?: any;
  snapshot?: any;
  /** Trường hiển thị máy chủ trả kèm */
  project_name?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  created_by?: string | null;
  ten_chinh_sach?: string | null;
  ten_lich_tt?: string | null;
  /** Công ty bán hàng chọn trên form (tt_hop_dong.CongTyBanHangId); tên hiện tại trong danh mục, rơi về tên chép */
  ctbh_id?: string | null;
  ctbh_ten?: string | null;
  /** Bí danh cũ UI còn dùng */
  project_id?: string | null;
  projects?: { name: string } | null;
  pricing_policies?: { name: string } | null;
  [k: string]: any;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uid = (v: any): string | null => {
  const s = String(v ?? "").trim();
  return UUID_RE.test(s) ? s : null;
};

/** Lỗi PostgREST → Error mang thông điệp nghiệp vụ của máy chủ (thiếu quyền, ngoài phạm vi…) */
const call = <T = any>(fn: string, args: Record<string, any>, fallback: string): Promise<T> =>
  rpcRaw<T>(fn, args, { fallback });

/** Bổ sung bí danh cũ mà UI còn đọc (projects / pricing_policies / project_id) */
export const withNames = (r: any): CloudPriceSheet => ({
  ...r,
  project_id: r?.da_project_id ?? null,
  projects: r?.project_name ? { name: r.project_name } : null,
  pricing_policies: r?.ten_chinh_sach ? { name: r.ten_chinh_sach } : null,
  // Công ty của CHỨNG TỪ (cột company_id lưu lúc nhập), không phải công ty của khách
  CompanyIdChungTu: r?.company_id ?? null,
  TenCtyChungTu: r?.ten_cong_ty ?? "",
  // Công ty bán hàng chọn trên form (tt_hop_dong.CongTyBanHangId) — khác công ty người nhập
  CtbhId: r?.ctbh_id ?? null,
  TenCtyBanHang: r?.ctbh_ten ?? null,
});

export interface PriceSheetListParams {
  /** uuid dự án (da_projects.id) */
  daProjectId?: string | null;
  /** Tìm theo mã phiếu / số phiếu / mã căn / tên sản phẩm (máy chủ escape) */
  keyword?: string | null;
  status?: string | null;
  /** Lọc hạn phiếu (chỉ phiếu đã duyệt); bỏ trống / "all" = không lọc */
  han?: "con_han" | "het_han" | "all" | null;
  productType?: string | null;
  folderId?: string | null;
  /** uuid nhân viên tạo, "__none__" = chưa có người tạo */
  creatorId?: string | null;
  pageIndex?: number;
  pageSize?: number;
  /** true = chỉ lấy phiếu đã xóa mềm */
  deleted?: boolean;
  /** uuid công ty được chọn ở ô lọc Công ty (đối chiếu công ty lưu trên phiếu lúc nhập) */
  companyIds?: string[] | string | null;
  /** Nhóm công ty; bỏ trống ⇒ máy chủ lấy theo loại công ty của tài khoản */
  companyGroup?: PriceSheetCompanyGroup | null;
}

/** Ô lọc Nhóm công ty: đại lý = sàn của phiếu là đại lý; CĐT / CTBH = loại công ty lưu trên phiếu (trừ phiếu đại lý) */
export const PRICE_SHEET_COMPANY_GROUPS = [
  { value: "all", label: "Tất cả" },
  { value: "chu_dau_tu", label: "Chủ đầu tư" },
  { value: "cty_ban_hang", label: "Công ty bán hàng" },
  { value: "dai_ly", label: "Đại lý" },
] as const;

export type PriceSheetCompanyGroup = (typeof PRICE_SHEET_COMPANY_GROUPS)[number]["value"];

const isCompanyGroup = (v: unknown): v is PriceSheetCompanyGroup =>
  PRICE_SHEET_COMPANY_GROUPS.some((g) => g.value === v);

export interface PriceSheetListResult {
  rows: CloudPriceSheet[];
  total: number;
  /** Đếm theo trạng thái trên toàn bộ tập đã lọc */
  stats: { draft: number; sent: number; approved: number; rejected: number };
  /** Lựa chọn "Người tạo" (trên tập đã lọc, trừ bộ lọc người tạo) */
  creators: { id: string; name: string }[];
  /** Nhóm công ty máy chủ đã áp dụng (mặc định theo tài khoản khi không gửi) */
  companyGroup: PriceSheetCompanyGroup;
}

export const PRICE_SHEET_PAGE_SIZES = [50, 100, 200, 500, 1000];

const allOrNull = (v?: string | null) => (v && v !== "all" ? v : null);

export const priceSheetService = {
  /** Danh sách phiếu tính giá (lọc, phân trang, thống kê ở máy chủ). */
  async list(params: PriceSheetListParams = {}): Promise<PriceSheetListResult> {
    const companyIds = cleanCompanyIds(([] as any[]).concat(params.companyIds ?? []));
    const res =
      (await call(
        "fn_price_sheet_list",
        {
          p: {
            project_id: uid(params.daProjectId),
            keyword: String(params.keyword || "").trim() || null,
            status: allOrNull(params.status),
            han: params.han === "con_han" || params.han === "het_han" ? params.han : null,
            product_type: allOrNull(params.productType),
            folder_id: allOrNull(params.folderId),
            // Bộ lọc đã nhớ từ bản cũ lưu tên người tạo ⇒ bỏ qua (chỉ nhận uuid / "__none__")
            creator_id: params.creatorId === "__none__" ? "__none__" : uid(params.creatorId),
            deleted: !!params.deleted,
            company_ids: companyIds,
            company_group: isCompanyGroup(params.companyGroup) ? params.companyGroup : null,
            page_index: Number(params.pageIndex) > 0 ? Number(params.pageIndex) : 1,
            page_size: Number(params.pageSize) > 0 ? Number(params.pageSize) : 20,
          },
        },
        "Không thể tải danh sách phiếu tính giá"
      )) || {};
    return {
      rows: (res.rows || []).map(withNames),
      total: Number(res.total ?? 0),
      stats: { draft: 0, sent: 0, approved: 0, rejected: 0, ...(res.stats || {}) },
      creators: Array.isArray(res.creators) ? res.creators : [],
      // SP cũ chưa có nhóm ⇒ coi như Tất cả
      companyGroup: isCompanyGroup(res.company_group) ? res.company_group : "all",
    };
  },

  /** Phiếu tính giá gắn với 1 phiếu giữ chỗ (cột pgc_id hoặc dòng giá gốc của chứng từ) */
  async listByPgc(pgcId: any): Promise<CloudPriceSheet[]> {
    const id = uid(pgcId);
    if (!id) return [];
    const rows = await call("fn_price_sheet_by_pgc", { p_pgc_id: id }, "Không tải được phiếu tính giá");
    return (Array.isArray(rows) ? rows : []).map((r: any) =>
      withNames({ ...r, base_price: r?.gia_tri_hd_sau_ck ?? r?.gia_tri_hd ?? r?.base_price ?? null })
    );
  },

  /** Bản đầy đủ (payload / snapshot) — mở form sửa, in, chi tiết */
  async get(id: string): Promise<CloudPriceSheet | null> {
    if (!uid(id)) return null;
    const row = await call("fn_price_sheet_get", { p_id: id }, "Không tải được phiếu tính giá");
    return row ? withNames(row) : null;
  },

  /**
   * Tạo mới (không id) / cập nhật phiếu — 1 lời gọi; máy chủ ghi phiên bản + giá gốc căn.
   * `hostForm` = đường dẫn màn chủ khi lưu từ tab nhúng (Booking / Đặt cọc / Hợp đồng…).
   */
  async upsert(row: any, hostForm?: string | null): Promise<CloudPriceSheet> {
    const { created_at, ...rest } = row || {};
    const saved = await call(
      "fn_price_sheet_save",
      { p_row: rest, p_host_form: hostForm || null },
      "Không thể lưu phiếu tính giá"
    );
    return withNames(saved);
  },

  /**
   * Sao chép phiếu thành phiếu nháp mới (giữ căn, khách, chính sách, liên kết phiếu giữ chỗ).
   * Không gửi id / số phiếu ⇒ máy chủ sinh mã mới; trạng thái, thư mục không chép.
   */
  async duplicate(id: string, hostForm?: string | null): Promise<CloudPriceSheet> {
    const src = await this.get(id);
    if (!src) throw new Error("Không tìm thấy phiếu tính giá cần sao chép");
    const payload = src.payload ? { ...src.payload } : src.payload;
    if (payload?.TTHopDong) payload.TTHopDong = { ...payload.TTHopDong, SoPhieu: "" };
    return this.upsert(
      {
        sheet_code: "",
        so_phieu: null,
        product_code: src.product_code,
        product_name: src.product_name,
        product_type: src.product_type,
        area: src.area,
        unit_price: src.unit_price,
        base_price: src.base_price,
        vat_rate: src.vat_rate,
        maintenance_rate: src.maintenance_rate,
        policy_name: src.policy_name ?? null,
        notes: src.notes ?? null,
        giai_doan: src.giai_doan ?? null,
        pgc_id: src.pgc_id ?? null,
        san_pham_id: src.san_pham_id ?? null,
        da_project_id: src.da_project_id ?? null,
        payload,
        snapshot: src.snapshot,
      },
      hostForm
    );
  },

  /** Duyệt / từ chối (cần quyền Duyệt); trả các dòng đã cập nhật */
  async setStatus(ids: string[], status: "approved" | "rejected", extra?: { reason?: string }): Promise<CloudPriceSheet[]> {
    if (!ids.length) return [];
    const rows = await call(
      "fn_price_sheet_set_status",
      { p_ids: ids, p_status: status, p_reason: extra?.reason ?? null },
      "Không thể cập nhật trạng thái phiếu"
    );
    return (Array.isArray(rows) ? rows : []).map(withNames);
  },

  /** Phiếu đã duyệt (dự án có quy trình phê duyệt) ⇒ mở phiên bản mới: phiếu về Nháp để sửa rồi gửi duyệt lại */
  async openNewVersion(id: string, reason: string): Promise<CloudPriceSheet> {
    const row = await call("fn_price_sheet_mo_phien_ban", { p_id: id, p_ly_do: reason }, "Không thể mở phiên bản mới");
    return withNames(row);
  },

  /** Xóa mềm 1 hoặc nhiều phiếu */
  async remove(ids: string[]) {
    if (!ids.length) return;
    await call("fn_price_sheet_delete", { p_ids: ids }, "Không thể xóa phiếu tính giá");
  },

  /** Hoàn lại phiếu đã xóa mềm */
  async restoreDeleted(ids: string[]) {
    if (!ids.length) return;
    await call("fn_price_sheet_restore", { p_ids: ids }, "Không thể hoàn lại phiếu tính giá");
  },

  /** Xóa vĩnh viễn (chỉ phiếu đã xóa mềm; phiếu đang được chứng từ dùng bị chặn) */
  async purge(ids: string[]) {
    if (!ids.length) return;
    await call("fn_price_sheet_purge", { p_ids: ids }, "Không thể xóa vĩnh viễn");
  },

  /** Khôi phục phiếu về dữ liệu của 1 phiên bản cũ (máy chủ ghi thêm 1 phiên bản mới) */
  async restore(version: PriceSheetVersion): Promise<CloudPriceSheet> {
    const row = await call(
      "fn_price_sheet_restore_version",
      { p_version_id: version.id },
      "Không thể khôi phục phiên bản"
    );
    return withNames(row);
  },
};

/** Một phiên bản (lần thay đổi) của phiếu tính giá — máy chủ ghi khi lưu / khôi phục. */
export interface PriceSheetVersion {
  id: string;
  price_sheet_id: string;
  version: number;
  sheet_code: string | null;
  payload: any;
  snapshot: any;
  summary: any;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

export type PriceSheetApprovalAction =
  | "created" | "approved" | "rejected" | "deleted" | "restored"
  | "submitted" | "returned" | "recalled" | "reopened";

/** Một sự kiện trong lịch sử phê duyệt của phiếu; actor_name null = không ghi nhận được người thực hiện. */
export interface PriceSheetApprovalEvent {
  action: PriceSheetApprovalAction;
  actor_name: string | null;
  at: string;
  note: string | null;
}

export const priceSheetVersionService = {
  /** Danh sách phiên bản của 1 phiếu (mới nhất trước). */
  async list(priceSheetId: string): Promise<PriceSheetVersion[]> {
    if (!uid(priceSheetId)) return [];
    const rows = await call("fn_price_sheet_versions", { p_sheet_id: priceSheetId }, "Không tải được lịch sử phiên bản");
    return Array.isArray(rows) ? rows : [];
  },

  /** Lịch sử tạo mới, duyệt, từ chối, xóa, hoàn lại của 1 phiếu (cũ nhất trước). */
  async approvalHistory(priceSheetId: string): Promise<PriceSheetApprovalEvent[]> {
    if (!uid(priceSheetId)) return [];
    const rows = await call("fn_price_sheet_approval_history", { p_sheet_id: priceSheetId }, "Không tải được lịch sử phê duyệt");
    return Array.isArray(rows) ? rows : [];
  },
};
