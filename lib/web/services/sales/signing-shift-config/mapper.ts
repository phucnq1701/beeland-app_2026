// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/sales/signing-shift-config/mapper.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import type { ConfigRow, DoiTuongHoSo, HoSoRef, ProcedureType, SigningConfig, SigningConfigRaw, WorkShift } from "./types";

const DOI_TUONG = new Set<DoiTuongHoSo>(["ALL", "CA_NHAN", "VO_CHONG", "DOANH_NGHIEP"]);
const lower = (v: unknown) => (v ? String(v).toLowerCase() : null);

const toHoSo = (list: unknown): HoSoRef[] =>
  (Array.isArray(list) ? list : [])
    .filter((h: any) => h?.id)
    .map((h: any) => ({
      id: String(h.id).toLowerCase(),
      doiTuong: DOI_TUONG.has(h.doi_tuong) ? h.doi_tuong : "ALL",
      ghiChu: h.ghi_chu ?? null,
    }));

/** `fn_signing_config_*` → cấu hình màn hình: `procedure_ids` (uuid) đổi sang mã thủ tục cùng bộ, bỏ id lạ */
export const toConfig = (raw: SigningConfigRaw | null): SigningConfig => {
  const procedures: ProcedureType[] = (raw?.procedures ?? []).map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    order: Number(p.order) || 0,
    active: p.active !== false,
    hoSo: toHoSo(p.ho_so),
  }));
  const codeById = new Map(procedures.map((p) => [String(p.id).toLowerCase(), p.code]));
  const shifts: WorkShift[] = (raw?.shifts ?? []).map((s) => {
    const ids = s.procedure_ids ?? [];
    return {
      id: s.id,
      code: s.code,
      name: s.name,
      from: s.from ?? "",
      to: s.to ?? "",
      procedures: ids.map((i) => codeById.get(String(i).toLowerCase())).filter((c): c is string => !!c),
      procedureIds: ids,
      capacity: Number(s.capacity) || 0,
      order: Number(s.order) || 0,
      active: s.active !== false,
    };
  });
  return {
    projectId: raw?.project_id ?? null,
    isCustom: !!raw?.is_custom,
    configId: lower(raw?.config_id),
    quyId: lower(raw?.quy_id),
    diemKyId: lower(raw?.diem_ky_id),
    isActive: raw?.is_active !== false,
    procedures,
    shifts,
  };
};

/** Payload `fn_signing_config_save`: khớp theo mã, không gửi id (máy chủ giữ id cũ, cấp id cho dòng mới) */
export const toSavePayload = (procedures: ProcedureType[], shifts: WorkShift[]) => ({
  p_procedures: procedures.map((p) => ({
    code: p.code,
    name: p.name.trim(),
    order: p.order,
    active: p.active,
    ...(p.hoSo
      ? { ho_so: p.hoSo.map((h) => ({ id: h.id, doi_tuong: h.doiTuong, ghi_chu: h.ghiChu?.trim() || null })) }
      : {}),
  })),
  p_shifts: shifts.map((s) => ({
    code: s.code,
    name: s.name.trim(),
    from: s.from,
    to: s.to,
    procedures: s.procedures,
    capacity: s.capacity,
    order: s.order,
    active: s.active,
  })),
});

/** Dòng `fn_signing_config_list` */
export const toConfigRow = (r: any): ConfigRow => ({
  id: String(r.id).toLowerCase(),
  projectId: lower(r.project_id),
  tenDA: r.ten_da ?? null,
  quyId: lower(r.quy_id),
  quyTen: r.quy_ten ?? null,
  diemKyId: lower(r.diem_ky_id),
  diemKyTen: r.diem_ky_ten ?? null,
  diemKyDiaChi: r.diem_ky_dia_chi ?? null,
  diemKyActive: r.diem_ky_active ?? null,
  isActive: r.is_active !== false,
  soThuTuc: Number(r.so_thu_tuc) || 0,
  soThuTucBat: Number(r.so_thu_tuc_bat) || 0,
  soCa: Number(r.so_ca) || 0,
  soCaBat: Number(r.so_ca_bat) || 0,
  tongCho: Number(r.tong_cho) || 0,
  nguoiSua: r.nguoi_sua_ten ?? null,
  updatedAt: r.updated_at ?? null,
});
