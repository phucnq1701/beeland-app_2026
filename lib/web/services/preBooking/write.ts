// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/preBooking/write.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * BOOKING THIỆN CHÍ — nghiệp vụ GHI (tạo mới, cập nhật, xóa mềm, khôi phục).
 * A1: shim gọi `fn_pre_booking_save` / `_delete` / `_restore` — không còn ghi thẳng `cloud_pre_bookings`.
 */
import { triggerSalesProcess } from "../SalesProcessService";
import {
  PreBookingActions,
  type PreBookingSaveInput,
  type PreBookingSaveResult,
} from "../sales/pre-booking-actions";
import {
  agencyMaSan,
  fail,
  failFrom,
  ok,
  resolveCatalogId,
  resolveProjectId,
  resolveSanId,
  sanValue,
  str,
  tenantUid,
  uid,
} from "./context";
import { loadRefs, listOut } from "./hydrate";
import { bySeq } from "./read";

/**
 * Chuyển payload form (mã cũ / uuid) thành tham số `fn_pre_booking_save` — như `toRow` cũ nhưng KHÔNG gửi trạng thái, căn,
 * phiếu giữ chỗ (máy chủ không nhận; sửa không xoá căn / phiếu đã gắn — c7). `tieu_chi` do service dựng đủ 9 khoá.
 */
const toSaveInput = async (payload: any): Promise<PreBookingSaveInput | null> => {
  const projectId = await resolveProjectId(payload.MaDA);
  if (!projectId) return null;
  const [khoangGiaId, khoangDtId, sanId] = await Promise.all([
    resolveCatalogId("khoang_gia", payload.MaKhoangGia, projectId),
    resolveCatalogId("dien_tich", payload.MaDienTich, projectId),
    resolveSanId(agencyMaSan() ?? sanValue(payload.MaSan)),
  ]);
  return {
    id: payload.ID ? Number(payload.ID) : undefined,
    khachHangId: uid(payload.MaKH) as string,
    daProjectId: projectId,
    sanId,
    khoangGiaId,
    khoangDtId,
    tienGiuCho: Number(payload.TienGiuCho) || 0,
    hanBooking: payload.HanBooking || null,
    formCode: str(payload.FormCode),
    dienGiai: str(payload.GhiChu),
    taiLieus: payload.TaiLieus ?? [],
    dongSoHuu: payload.DongDungTens ?? [],
    tieuChi: {
      MaKhu: payload.MaKhu ?? null,
      MaKhoangGia: payload.MaKhoangGia ?? null,
      MaDienTich: payload.MaDienTich ?? null,
      Tangs: payload.Tangs ?? [],
      Huongs: payload.Huongs ?? [],
      LoaiCans: payload.LoaiCans ?? [],
      Views: payload.Views ?? [],
      Vitris: payload.Vitris ?? [],
      KhoangTangs: payload.KhoangTangs ?? [],
    },
  };
};

/**
 * Tạo mới hoặc cập nhật phiếu booking qua `fn_pre_booking_save`. Máy chủ kiểm cài đặt bán hàng, số booking tối đa,
 * cấp số phiếu trong cùng giao dịch và ghi nhật ký; ở đây chỉ đọc lại phiếu để trả dữ liệu hiển thị như cũ.
 */
export const add = async (payload: any) => {
  const tenant = tenantUid();
  if (!tenant) return fail("Không xác định được công ty đăng ký");
  if (!uid(payload?.MaKH)) return fail("Chưa chọn khách hàng");

  const input = await toSaveInput(payload);
  if (!input) return fail("Không xác định được dự án");

  let saved: PreBookingSaveResult;
  try {
    saved = await PreBookingActions.save(input);
  } catch (e) {
    return failFrom(e, "Không lưu được phiếu booking");
  }

  const row: any = await bySeq(saved.seq);
  const mapped: any = row ? listOut(row, await loadRefs([row])) : { ID: saved.seq, SoPhieu: saved.soPhieu };

  /* ------------------------- Cập nhật ------------------------- */
  if (input.id) return ok(mapped);

  /* ---------------------------- Tạo --------------------------- */
  void triggerSalesProcess("prebooking", {
    entity: "PreBooking",
    id: saved.seq,
    so_phieu: saved.soPhieu,
    ma_kh: row?.khach_hang_id ?? input.khachHangId,
    ten_kh: mapped.TenKH,
    di_dong: mapped.DiDong,
    email: mapped.Email,
    ma_da: mapped.MaDA,
    ten_da: mapped.TenDA,
    ma_sp: mapped.MaSP,
    ky_hieu: mapped.KyHieu,
    tien_giu_cho: row?.tien_giu_cho ?? input.tienGiuCho,
  });

  return ok({ ...mapped, SoPhieu: saved.soPhieu });
};

/** Xóa mềm — phiếu chuyển sang mục "Đã xóa" và có thể khôi phục (máy chủ chặn khi còn Tiền thu — b6). */
export const remove = async (id: number) => {
  try {
    await PreBookingActions.remove([Number(id)]);
    return ok(true);
  } catch (e) {
    return failFrom(e, "Không xóa được phiếu booking");
  }
};

/** Khôi phục phiếu đã xóa. */
export const restore = async (id: number) => {
  try {
    await PreBookingActions.restore([Number(id)]);
    return ok(true);
  } catch (e) {
    return failFrom(e, "Không khôi phục được phiếu booking");
  }
};
