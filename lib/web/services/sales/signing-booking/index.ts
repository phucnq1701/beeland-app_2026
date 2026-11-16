// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/sales/signing-booking/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Đặt lịch ký — quỹ → loại thủ tục → ngày → điểm ký → ca (DK3/DK6/DK8), qua RPC:
 *   fn_signing_book_options(p_ma_pgc, p_quy_id?, p_thu_tuc?, p_ngay?) và fn_signing_availability(…).
 * Ca + chỗ còn trong 1 ngày của một điểm: fn_signing_shift_slots với procedure_id của điểm (SigningShiftConfigService.slotsByDate).
 */
import { rpcRaw } from "../../_core/rpc";
import type { DoiTuongHoSo } from "../signing-shift-config";

export interface BookThuTuc {
  code: string;
  name: string;
}

export interface BookHoSo {
  id: string;
  name: string;
  note: string | null;
  doiTuong: DoiTuongHoSo;
  ghiChu: string | null;
}

/** Một điểm ký hợp lệ cho (dự án, quỹ, thủ tục) — một bộ cấu hình */
export interface BookDiem {
  configId: string;
  /** null = bộ cũ chưa gán điểm ký */
  diemKyId: string | null;
  ten: string | null;
  diaChi: string | null;
  viDo: number | null;
  kinhDo: number | null;
  dienThoai: string | null;
  huongDan: string | null;
  /** loại thủ tục của bộ — giá trị lưu vào lịch */
  procedureId: string;
  procedureName: string;
  soCa: number;
  /** theo ngày đã chọn (null khi chưa chọn ngày) */
  capacity: number | null;
  remaining: number | null;
  hoSo: BookHoSo[];
}

/** Một điểm ký (bộ hiệu lực) của (dự án, quỹ) kèm loại thủ tục đang bật của nó — chọn điểm trước, thủ tục theo điểm (DK23) */
export interface BookDiemDs {
  configId: string;
  diemKyId: string | null;
  ten: string | null;
  diaChi: string | null;
  dienThoai: string | null;
  thuTuc: BookThuTuc[];
}

export interface BookOptions {
  projectId: string | null;
  quyId: string | null;
  quyTen: string | null;
  quySuyId: string | null;
  /** GIAO_DICH | BANG_GIA | MAC_DINH */
  quyNguon: string | null;
  thuTuc: BookThuTuc[];
  /** Mọi điểm của (dự án, quỹ) — không phụ thuộc thủ tục */
  diemDs: BookDiemDs[];
  /** Điểm có thủ tục đã chọn, kèm chỗ còn / hồ sơ (rỗng khi chưa chọn thủ tục) */
  diem: BookDiem[];
}

const lower = (v: unknown) => (v ? String(v).toLowerCase() : null);
const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

export const toBookOptions = (r: any): BookOptions => ({
  projectId: lower(r?.project_id),
  quyId: lower(r?.quy_id),
  quyTen: r?.quy_ten ?? null,
  quySuyId: lower(r?.quy_suy_id),
  quyNguon: r?.quy_nguon ?? null,
  thuTuc: (r?.thu_tuc ?? []).map((t: any) => ({ code: String(t.code), name: t.name ?? String(t.code) })),
  diemDs: (r?.diem_ds ?? []).map((d: any) => ({
    configId: String(d.config_id).toLowerCase(),
    diemKyId: lower(d.diem_ky_id),
    ten: d.ten ?? null,
    diaChi: d.dia_chi ?? null,
    dienThoai: d.dien_thoai ?? null,
    thuTuc: (d.thu_tuc ?? []).map((t: any) => ({ code: String(t.code), name: t.name ?? String(t.code) })),
  })),
  diem: (r?.diem ?? []).map((d: any) => ({
    configId: String(d.config_id).toLowerCase(),
    diemKyId: lower(d.diem_ky_id),
    ten: d.ten ?? null,
    diaChi: d.dia_chi ?? null,
    viDo: n(d.vi_do),
    kinhDo: n(d.kinh_do),
    dienThoai: d.dien_thoai ?? null,
    huongDan: d.huong_dan ?? null,
    procedureId: String(d.procedure_id).toLowerCase(),
    procedureName: d.procedure_name ?? "",
    soCa: Number(d.so_ca) || 0,
    capacity: n(d.capacity),
    remaining: n(d.remaining),
    hoSo: (d.ho_so ?? []).map((h: any) => ({
      id: String(h.id).toLowerCase(),
      name: h.name ?? "",
      note: h.note ?? null,
      doiTuong: h.doi_tuong ?? "ALL",
      ghiChu: h.ghi_chu ?? null,
    })),
  })),
});

export const SigningBookingService = {
  options: async (a: { pgcId: string; quyId?: string | null; thuTuc?: string | null; ngay?: string | null }): Promise<BookOptions> =>
    toBookOptions(
      await rpcRaw("fn_signing_book_options", {
        p_ma_pgc: a.pgcId,
        p_quy_id: a.quyId ?? null,
        p_thu_tuc: a.thuTuc ?? null,
        p_ngay: a.ngay ?? null,
      })
    ),

  /** { "YYYY-MM-DD": chỗ còn } của mọi điểm hợp lệ, hoặc một bộ (configId) */
  availability: async (a: {
    pgcId: string;
    quyId?: string | null;
    thuTuc: string;
    configId?: string | null;
    from: string;
    days: number;
  }): Promise<Record<string, number>> => {
    const r = await rpcRaw<{ rows?: { ngay: string; remaining: number }[] }>("fn_signing_availability", {
      p_ma_pgc: a.pgcId,
      p_quy_id: a.quyId ?? null,
      p_thu_tuc: a.thuTuc,
      p_config_id: a.configId ?? null,
      p_tu_ngay: a.from,
      p_so_ngay: a.days,
    });
    return Object.fromEntries((r?.rows ?? []).map((x) => [x.ngay, Number(x.remaining) || 0]));
  },
};

/** Đối tượng hồ sơ ↔ Phân loại khách hàng của lịch ký (MaPhanLoaiKH), khớp 1–1 */
export const DOI_TUONG_BY_PHAN_LOAI: Record<number, Exclude<DoiTuongHoSo, "ALL">> = {
  1: "CA_NHAN", // Khách hàng cá nhân
  2: "VO_CHONG", // Khách hàng đồng sở hữu vợ chồng
  3: "DOANH_NGHIEP", // Khách hàng doanh nghiệp
};

/** Hồ sơ áp dụng cho phân loại khách: hồ sơ "Mọi khách hàng" + hồ sơ đúng phân loại đó (DK27 — không còn "cá nhân gồm vợ chồng") */
export const hoSoForPhanLoai = <T extends { doiTuong: DoiTuongHoSo }>(list: T[], phanLoai: number | null | undefined): T[] => {
  const dt = DOI_TUONG_BY_PHAN_LOAI[Number(phanLoai) || 1];
  return list.filter((h) => h.doiTuong === "ALL" || h.doiTuong === dt);
};
