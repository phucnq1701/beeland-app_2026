// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/sales/signing-appointment/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * SigningAppointmentCloudService — nghiệp vụ **Đặt lịch ký** lưu trên Cloud.
 *
 * Toàn bộ dữ liệu khoá theo **uuid**:
 *  - `ma_ctdk_uid`      : công ty đăng ký (tenant)
 *  - `phieu_giu_cho_id` : phiếu giữ chỗ / đặt cọc
 *  - `khach_hang_id`    : khách hàng chính, `dong_so_huu_ids` : đồng đứng tên
 *  - `ca_lam_viec_id`   : ca làm việc, `loai_thu_tuc_id` : loại thủ tục
 *  - `la_chuyen_khoan`  : true = chuyển khoản, false = tiền mặt
 *  - `co_bao_lanh`      : true = có bảo lãnh, false = không bảo lãnh
 *
 * Tên/điện thoại/CCCD hiển thị luôn lấy theo uuid khách hàng, không lưu bản chụp.
 *
 * Đọc / ghi qua RPC (migration 20261014181500_signing_rpc): công ty, người nhập, người thao tác lấy từ JWT ở máy chủ;
 * phạm vi dự án `_da_project_scope()`; thêm/sửa = ADD/EDIT, đổi trạng thái = APPROVE, xoá = DELETE (form
 * `/sales/signing-appointments`). Các hàm ghi trả lại dòng để lưới cập nhật tại chỗ.
 */
import { agencyMaSan, sanValue } from "../../PreBookingCloudService";
import { supabase } from "../../../_shims/integrations/supabase/client";
import { clearCustomerIdentityLockCache } from "../../CustomerIdentityLockService";
import { sessionCompanyId } from "../../../_shims/lib/session";
import { cleanCompanyIds } from "../../../_extract/services/system/permitted-company";
import { vnDayEnd, vnDayStart } from "../../../utils/vnDate";
import { toVNStore, fromVNStore, num, bool, uid, code, listRowOut, depositOut } from "./mapper";
import { getHostForm } from "../../../lib/hostForm";
import { rpcError } from "../../_core/rpc";

/** Hợp đồng chọn làm nguồn lịch ký (fn_signing_contract_search) */
export type SigningContractOption = {
  id: string;
  so_hd: string | null;
  loai_hd: "HDMB" | "HDGV";
  phieu_giu_cho_id: string | null;
  khach_hang: string | null;
  ma_can: string | null;
  project_id: string | null;
};

const TBL = "cloud_signing_appointments";

const ok = (data: any): any => {
  clearCustomerIdentityLockCache();
  return { status: 2000, data };
};
const fail = (message: string): any => ({ status: 5000, message, data: null });

const tenant = () => uid(sessionCompanyId());

const toRow = (p: any) => {
  const isPersonal = p?.IsPersonal !== false;
  const san = agencyMaSan() ?? sanValue(p?.MaSan);
  return {
    project_id: uid(p?.MaDA),
    phieu_giu_cho_id: uid(p?.MaPGC),
    san_pham_id: uid(p?.MaSP ?? p?.MaSanPham),
    khach_hang_id: uid(p?.MaKH),
    san_id: uid(san),
    is_personal: isPersonal,
    ngay_book_ky: toVNStore(p?.NgayBookKy),
    ma_phan_loai_kh: num(p?.MaPhanLoaiKH),
    // Giao dịch có lịch thanh toán ⇒ ô khoá, không gửi phương án chọn tay (DK29)
    ma_phuong_an_tt: p?.MaLichTT ? null : code(p?.MaPhuongAnTT),
    la_chuyen_khoan: bool(p?.LaChuyenKhoan),
    co_bao_lanh: bool(p?.CoBaoLanh),
    ca_lam_viec_id: uid(p?.MaCa),
    loai_thu_tuc_id: uid(p?.LoaiThuTuc),
    dong_so_huu_ids: (Array.isArray(p?.DongSoHuuIds) ? p.DongSoHuuIds : [])
      .map((v: any) => uid(v))
      .filter(Boolean),
    ghi_chu: p?.GhiChu ?? null,
    /** Ảnh / tài liệu đính kèm của lịch ký */
    tai_lieu: Array.isArray(p?.TaiLieu) ? p.TaiLieu : [],
    /** Nguồn lịch (luồng ký TTĐC): DAT_COC | HOP_DONG; null ⇒ máy chủ tự suy theo trạng thái phiếu */
    nguon: p?.Nguon === "DAT_COC" || p?.Nguon === "HOP_DONG" ? p.Nguon : null,
    hop_dong_id: uid(p?.HopDongId),
  };
};

export const SigningAppointmentCloudService = {
  /** Tìm phiếu đặt cọc (hàm máy chủ: PGC + đặt cọc + khách hàng + sản phẩm). */
  searchDeposits: async (kw = "", projectId?: string | null) => {
    const ctdk = tenant();
    if (!ctdk) return [];
    const { data } = await supabase.rpc("fn_signing_deposit_search" as any, {
      p_search: String(kw || "").trim() || null,
      p_project_id: uid(projectId),
      p_id: null,
      p_limit: 30,
    });
    return ((data as any[]) || []).map(depositOut);
  },

  /** Tìm HĐMB / HĐ góp vốn để lập lịch ký nguồn Hợp đồng (`fn_signing_contract_search`, phạm vi như tìm phiếu cọc). */
  searchContracts: async (kw = "", projectId?: string | null): Promise<SigningContractOption[]> => {
    const { data, error } = await supabase.rpc("fn_signing_contract_search" as any, {
      p_search: String(kw || "").trim() || null,
      p_project_id: uid(projectId),
      p_limit: 50,
    } as any);
    if (error) throw rpcError(error, "Không thể tìm hợp đồng");
    return ((Array.isArray(data) ? data : []) as any[]).map((r) => ({
      id: r.id,
      so_hd: r.so_hd ?? null,
      loai_hd: r.loai_hd === "HDGV" ? "HDGV" : "HDMB",
      phieu_giu_cho_id: r.phieu_giu_cho_id ?? null,
      khach_hang: r.khach_hang ?? null,
      ma_can: r.ma_can ?? null,
      project_id: r.project_id ?? null,
    }));
  },

  /** Lấy 1 phiếu đặt cọc theo uuid (để hiện số phiếu khi mở form từ lưới). */
  getDepositById: async (pgcId?: string | null) => {
    const ctdk = tenant();
    const id = uid(pgcId);
    if (!ctdk || !id) return null;
    const { data } = await supabase.rpc("fn_signing_deposit_search" as any, {
      p_search: null,
      p_project_id: null,
      p_id: id,
      p_limit: 1,
    });
    const d = ((data as any[]) || [])[0];
    return d ? depositOut(d) : null;
  },




  /**
   * Danh sách lịch ký — `fn_signing_appointment_list` (công ty + phạm vi dự án từ JWT ở máy chủ, tìm kiếm trên máy chủ).
   */
  getList: async (payload: any = {}) => {
    if (!tenant()) return fail("Không xác định được công ty (tenant)");
    const pageSize = Number(payload?.PageSize ?? payload?.limit ?? 200) || 200;
    const pageIndex = Math.max(Number(payload?.PageIndex ?? 1) || 1, 1);
    const { data, error } = await supabase.rpc("fn_signing_appointment_list" as any, {
      p_project_id: uid(payload?.MaDA),
      p_search: String(payload?.InputSearch || "").trim() || null,
      p_state: payload?.State ? String(payload.State).toUpperCase() : null,
      p_is_personal: typeof payload?.IsPersonal === "boolean" ? payload.IsPersonal : null,
      p_page: pageIndex,
      p_size: pageSize,
      p_company_ids: cleanCompanyIds(payload?.CompanyIds),
      p_san_ids: cleanCompanyIds(payload?.SanIds),
      p_tu_ngay: vnDayStart(payload?.TuNgay),
      p_den_ngay: vnDayEnd(payload?.DenNgay),
      p_nguon: payload?.Nguon === "DAT_COC" || payload?.Nguon === "HOP_DONG" ? payload.Nguon : null,
    } as any);
    if (error) return fail(error.message);
    const res: any = data ?? {};
    return { ...ok((Array.isArray(res.rows) ? res.rows : []).map(listRowOut)), total: Number(res.total ?? 0) };
  },

  /** Chi tiết 1 lịch ký theo id (seq) — dùng khi mở form sửa. */
  getById: async (id: number | string) => {
    const ctdk = tenant();
    if (!ctdk) return fail("Không xác định được công ty (tenant)");
    const isUuid = typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id);
    const { data, error } = await supabase.rpc("fn_signing_appointment_get" as any, {
      p_id: isUuid ? id : null,
      p_seq: isUuid ? null : Number(id),
    } as any);
    if (error) return fail(error.message);
    const d: any = data;
    if (!d) return fail("Không tìm thấy lịch ký");
    const isPersonal = !!d.is_personal;
    return ok({
      ID: Number(d.seq),
      UID: d.id ?? null,
      State: d.state,
      IsPersonal: isPersonal,
      NgayBookKy: fromVNStore(d.ngay_book_ky),
      MaDA: d.project_id,
      TenDA: d.ten_da ?? null,
      MaSP: d.san_pham_id ?? null,
      MaSanPham: d.san_pham_id ?? null,
      MaCan: d.ma_can ?? null,
      KyHieu: d.ma_can ?? null,
      MaPGC: d.phieu_giu_cho_id ?? null,
      SoPhieu: d.so_phieu ?? null,
      MaKH: d.khach_hang_id ?? null,
      TenKH: isPersonal ? d.ten_kh ?? null : null,
      TenCongTy: isPersonal ? null : d.ten_kh ?? null,
      DiDong: d.dien_thoai ?? null,
      DienThoai: d.dien_thoai ?? null,
      Email: d.email ?? null,
      SoCMND: isPersonal ? d.cccd ?? null : null,
      SoCCCD: isPersonal ? d.cccd ?? null : null,
      SoDKKD: isPersonal ? null : d.cccd ?? null,
      MaSan: d.san_id ?? null,
      TenSan: d.ten_san ?? null,
      MaPhanLoaiKH: d.ma_phan_loai_kh,
      MaPhuongAnTT: code(d.ma_phuong_an_tt),
      MaLichTT: d.lich_tt_id ?? null,
      TenLichTT: d.ten_lich_tt ?? null,
      LaChuyenKhoan: d.la_chuyen_khoan,
      CoBaoLanh: d.co_bao_lanh,
      MaCa: d.ca_lam_viec_id ?? null,
      TenCa: d.ten_ca ?? null,
      LoaiThuTuc: d.loai_thu_tuc_id ?? null,
      TenLoaiThuTuc: d.ten_loai_thu_tuc ?? null,
      /** Mã loại thủ tục (chọn theo mã, gộp các điểm ký) + bộ cấu hình của ca (= điểm ký) */
      MaLoaiThuTuc: d.ma_loai_thu_tuc ?? null,
      MaCauHinh: d.config_id ?? null,
      QuyCauHinh: d.config_quy_id ?? null,
      DiemKy: d.diem_ky_id ?? null,
      TenDiemKy: d.ten_diem_ky ?? null,
      DiaChiDiemKy: d.dia_chi_diem_ky ?? null,
      ViDoDiemKy: d.vi_do_diem_ky ?? null,
      KinhDoDiemKy: d.kinh_do_diem_ky ?? null,
      DienThoaiDiemKy: d.dien_thoai_diem_ky ?? null,
      HuongDanDiemKy: d.huong_dan_diem_ky ?? null,
      GhiChu: d.ghi_chu ?? null,
      TaiLieu: Array.isArray(d.tai_lieu) ? d.tai_lieu : [],
      DongSoHuuIds: Array.isArray(d.dong_so_huu_ids) ? d.dong_so_huu_ids : [],
      DongSoHuu: Array.isArray(d.dong_so_huu) ? d.dong_so_huu : [],
      NgayTao: d.created_at,
      CreatedAt: d.created_at,
    });
  },

  /** Tạo / sửa lịch ký — kiểm quyền, phạm vi, ca, ghi dữ liệu và nhật ký đều chạy dưới máy chủ (1 lệnh); trả dòng đã lưu. */
  upcert: async (payload: any) => {
    if (!tenant()) return fail("Không xác định được công ty (tenant)");
    const { data, error } = await supabase.rpc("fn_signing_appointment_upsert" as any, {
      p_payload: { ...toRow(payload), seq: payload?.ID ? Number(payload.ID) : null, ...(payload?.ID ? {} : { host_form: getHostForm() }) },
    } as any);
    if (error) return fail(error.message);
    const d: any = data ?? {};
    return ok({ ID: Number(d.seq), row: d.row ? listRowOut(d.row) : null });
  },

  /** Đổi trạng thái 1 hoặc nhiều lịch ký trong 1 lệnh (quyền APPROVE) — trả các dòng mới. */
  changeState: async (payload: any) => {
    if (!tenant()) return fail("Không xác định được công ty (tenant)");
    const ids = (Array.isArray(payload?.IDs) ? payload.IDs : [payload?.ID])
      .map((v: any) => Number(v))
      .filter((v: number) => Number.isFinite(v));
    const { data, error } = await supabase.rpc("fn_signing_appointment_set_state" as any, {
      p_ids: ids,
      p_state: String(payload?.State || "PENDING").toUpperCase(),
      p_note: payload?.GhiChu ?? null,
    } as any);
    if (error) return fail(error.message);
    const rows: any[] = Array.isArray((data as any)?.rows) ? (data as any).rows : [];
    return ok(rows.map(listRowOut));
  },

  delete: async (id: number | number[]) => {
    if (!tenant()) return fail("Không xác định được công ty (tenant)");
    const { error } = await supabase.rpc("fn_signing_appointment_delete" as any, {
      p_ids: (Array.isArray(id) ? id : [id]).map(Number),
    } as any);
    if (error) return fail(error.message);
    return ok(true);
  },
};

export default SigningAppointmentCloudService;
