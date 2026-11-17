/**
 * Đặt lịch ký — màn Danh sách / Chi tiết / ô chọn phiếu cọc của app, qua bộ API riêng (fn_nv_app_lich_ky_*, lõi chung: SP app bọc đúng
 * SP web fn_signing_* của beeland/src/services/sales/signing-appointment; công ty / phạm vi dự án / người thao tác ở máy chủ).
 * Form Thêm / Sửa lịch ký dùng thẳng logic form web chép (lib/web: useWebSigningForm + useWebShiftPicker — quỹ → điểm ký → thủ tục →
 * ngày → ca, nguồn Đặt cọc / Hợp đồng, hồ sơ, lưu fn_signing_appointment_upsert).
 */
import { callNv, errorMessage } from "@/services/nvApi";
import { getCustomersByIds } from "./customerLookup";
import { rpcRows } from "./DatCocService";
import { mapDeposit, mapListRow, SigningState, uid, type Deposit, type SigningRow } from "../lib/signing";

export type SigningDetail = SigningRow & {
  TaiLieu: { fileName: string; url: string; uploadedAt?: string; hoSoId?: string | null; hoSoTen?: string | null }[];
  DongSoHuuIds: string[];
  /** Dòng máy chủ gốc (fn_signing_appointment_get) — form web nạp lại từ đây */
  raw: any;
};

async function rpc<T = any>(fn: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  try {
    return await callNv<T>(fn, args);
  } catch (e) {
    throw new Error(errorMessage(e, fallback));
  }
}

export const SigningService = {
  /** Danh sách lịch ký — fn_nv_app_lich_ky_list (= fn_signing_appointment_list: công ty + phạm vi dự án / đại lý ở máy chủ). */
  list: async (filter: {
    /** null = cả cá nhân lẫn doanh nghiệp */
    isPersonal?: boolean | null;
    state?: SigningState | null;
    search?: string;
    projectId?: string | null;
    limit?: number;
  }): Promise<SigningRow[]> => {
    const res = await rpc<any>(
      "fn_nv_app_lich_ky_list",
      {
        p_project_id: uid(filter.projectId),
        p_search: String(filter.search || "").trim() || null,
        p_state: filter.state ? String(filter.state).toUpperCase() : null,
        p_is_personal: filter.isPersonal ?? null,
        p_page: 1,
        p_size: filter.limit ?? 500,
      },
      "Không tải được danh sách lịch ký"
    );
    return rpcRows(res).rows.map(mapListRow);
  },

  /** Chi tiết 1 lịch ký theo uuid hoặc seq — fn_nv_app_lich_ky_chi_tiet (= fn_signing_appointment_get). */
  get: async (idOrSeq: string | number): Promise<SigningDetail> => {
    const isUuid = !!uid(idOrSeq);
    const d = await rpc<any>(
      "fn_nv_app_lich_ky_chi_tiet",
      { p_id: isUuid ? String(idOrSeq) : null, p_seq: isUuid ? null : Number(idOrSeq) },
      "Không tải được lịch ký"
    );
    const row = Array.isArray(d) ? d[0] : d;
    if (!row) throw new Error("Không tìm thấy lịch ký");
    return {
      ...mapListRow(row),
      TaiLieu: Array.isArray(row.tai_lieu) ? row.tai_lieu : [],
      DongSoHuuIds: Array.isArray(row.dong_so_huu_ids) ? row.dong_so_huu_ids.map(String) : [],
      raw: row,
    };
  },

  /** Xoá — fn_nv_app_lich_ky_xoa (= fn_signing_appointment_delete; người thao tác lấy từ phiên). */
  remove: async (ids: number[]) => {
    await rpc("fn_nv_app_lich_ky_xoa", { p_ids: ids.map(Number) }, "Xoá lịch ký thất bại");
  },

  /** Tìm phiếu đặt cọc — fn_nv_app_lich_ky_tim_coc (= fn_signing_deposit_search, phạm vi ở máy chủ). */
  searchDeposits: async (keyword: string, projectId?: string | null): Promise<Deposit[]> => {
    const res = await rpc<any>(
      "fn_nv_app_lich_ky_tim_coc",
      { p_search: String(keyword || "").trim() || null, p_project_id: uid(projectId), p_id: null, p_limit: 30 },
      "Không tìm được phiếu đặt cọc"
    );
    return rpcRows(res).rows.map(mapDeposit);
  },

  /**
   * Phương án thanh toán để hiện nhãn ở màn chi tiết — như web SigningDrawer.loadOptions: danh mục tự cấu hình `phuong_an_tt_ky`
   * (đang áp dụng, theo thứ tự) trước, không có thì `phuong_an_tt` — fn_nv_app_danh_muc_ma (mã chữ công ty phiên).
   */
  plans: async (): Promise<{ value: any; label: string }[]> => {
    try {
      const custom = ((await callNv<any[]>("fn_nv_app_danh_muc_ma", { p_loai: "phuong_an_tt_ky" })) || [])
        .filter((r: any) => r.ap_dung !== false)
        .sort((a: any, b: any) => (Number(a.raw?.order) || 0) - (Number(b.raw?.order) || 0));
      if (custom.length)
        return custom.map((r: any) => ({ value: String(r.item_code), label: r.item_name || String(r.item_code) }));
      return ((await callNv<any[]>("fn_nv_app_danh_muc_ma", { p_loai: "phuong_an_tt" })) || [])
        .map((r: any) => r.raw || {})
        .map((it: any) => ({
          value: String(it.MaPATT ?? it.ID ?? it.Ma),
          label: it.TenPATT ?? it.Ten ?? it.TenPhuongAn ?? `#${it.ID ?? ""}`,
        }))
        .filter((o: any) => o.value != null && o.value !== "undefined");
    } catch {
      return [];
    }
  },

  /**
   * Thông tin hiển thị của các khách (đồng đứng tên) theo uuid — fn_nv_app_khach_hang_theo_id (= fn_customer_get_by_ids).
   * Khách công ty khác chỉ thấy qua chứng từ ⇒ bản giới hạn (`limited`, cccd đã che). Giữ thứ tự `ids`.
   */
  customersByIds: async (ids: string[]) => {
    const list = ids.map(uid).filter(Boolean) as string[];
    if (!list.length) return [];
    const rows = await getCustomersByIds(list);
    const map = new Map(rows.map((c: any) => [String(c.id).toLowerCase(), c]));
    return list.map((id) => map.get(id.toLowerCase())).filter(Boolean) as any[];
  },
};
