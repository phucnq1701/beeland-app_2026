// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/agencies/agency-list/mapper.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import type { AgencyInput, AgencyRaw, AgencyRow } from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown) => UUID_RE.test(String(v ?? "").trim());

const str = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v).trim();
  return s || null;
};

/** Dòng fn_dm_agency_list / fn_dm_agency_save → dòng UI */
export const toAgencyRow = (r: Partial<AgencyRaw> | null | undefined): AgencyRow => {
  const id = String(r?.id ?? "");
  return {
    ID: id,
    Id: id,
    TenCTVT: r?.ten_ct_vt ?? "",
    TenCT: r?.ten_ct ?? null,
    DiaChi: r?.dia_chi ?? null,
    DienThoai: r?.dien_thoai ?? null,
    Fax: r?.fax ?? null,
    Email: r?.email ?? null,
    MaSoThue: r?.ma_so_thue ?? null,
    GiamDoc: r?.giam_doc ?? null,
    ChucVu: r?.chuc_vu ?? null,
    SoTaiKhoan: r?.so_tai_khoan ?? null,
    TenNganHang: r?.ten_ngan_hang ?? null,
    // ap_dung: true = Hoạt động; UI State: true = Ngừng
    State: r?.ap_dung === false,
    LoaiCT: r?.loai_cong_ty ?? null,
  };
};

/** Form → jsonb của fn_dm_agency_save (tenant / is_san do máy chủ gán) */
export const toAgencyPayload = (input: AgencyInput): Record<string, unknown> => {
  const p: Record<string, unknown> = {};
  if (isUuid(input.Id)) p.id = String(input.Id).trim();
  p.ten_ct_vt = str(input.TenCTVT);
  p.ten_ct = str(input.TenCT);
  p.dia_chi = str(input.DiaChi);
  p.dien_thoai = str(input.DienThoai);
  p.fax = str(input.Fax);
  // Trường bổ sung 2026-11-04: chỉ gửi khi có trong input (vắng mặt ⇒ máy chủ giữ giá trị cũ)
  if (input.Email !== undefined) p.email = str(input.Email);
  if (input.MaSoThue !== undefined) p.ma_so_thue = str(input.MaSoThue);
  if (input.GiamDoc !== undefined) p.giam_doc = str(input.GiamDoc);
  // Trường bổ sung 2026-11-05 (tài khoản ngân hàng, chức vụ người đại diện): cùng quy tắc vắng mặt ⇒ giữ giá trị cũ
  if (input.ChucVu !== undefined) p.chuc_vu = str(input.ChucVu);
  if (input.SoTaiKhoan !== undefined) p.so_tai_khoan = str(input.SoTaiKhoan);
  if (input.TenNganHang !== undefined) p.ten_ngan_hang = str(input.TenNganHang);
  p.ap_dung = !input.State;
  p.loai_cong_ty = str(input.LoaiCT);
  return p;
};
