/**
 * Đặt lịch ký – cùng dữ liệu / hàm máy chủ với web:
 *  - beeland/src/services/SigningAppointmentCloudService.ts (fn_signing_appointment_list/get/upsert/set_state/delete,
 *    fn_signing_deposit_search)
 *  - beeland/src/services/SigningShiftConfigService.ts (cloud_signing_procedures, cloud_signing_shifts,
 *    fn_signing_shift_slots, availabilityByDate)
 *  - beeland/src/pages/sales/giao-dich/dat-lich-ky/SigningDrawer.tsx (danh mục phương án TT, phân loại KH, đại lý)
 * Khoá theo uuid: ma_ctdk_uid (công ty), phieu_giu_cho_id, khach_hang_id, ca_lam_viec_id, loai_thu_tuc_id.
 */
import axiosApiSupabase from "./axiosApiSupabase";
import {
  getBranchId,
  getCompanyCode,
  getCompanyId,
  getEmployeeId,
  getMaNv,
  getTypeAccount,
  getValidSupabaseJwt,
} from "./cloudTenant";
import { currentUserName } from "./CustomerRulesService";
import { rpcRows } from "./DatCocService";
import { ProductService } from "./ProductService";
import { ProjectService } from "./ProjectService";
import {
  addDays,
  availabilityFrom,
  buildUpsertPayload,
  mapDeposit,
  mapListRow,
  quickDays,
  ShiftSlot,
  SigningState,
  uid,
  type Deposit,
  type SigningRow,
} from "../lib/signing";

const errMsg = (e: any, fallback: string): string =>
  e?.response?.data?.message || e?.response?.data?.hint || (e instanceof Error && e.message) || fallback;

async function requireTenant(): Promise<string> {
  if (!(await getValidSupabaseJwt())) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  const t = uid(await getCompanyId());
  if (!t) throw new Error("Không xác định được công ty (tenant)");
  return t;
}

const isAgency = async () => (await getTypeAccount()) === "AGENCY";

/** Dự án đại lý được gán (null = tài khoản hệ thống, không giới hạn) – như web filterRowsForAgency. */
async function agencyProjectIds(): Promise<Set<string> | null> {
  if (!(await isAgency())) return null;
  const res: any = await ProjectService.getProjects({}).catch(() => ({ data: [] }));
  return new Set((res?.data ?? []).map((p: any) => String(p.id)));
}

export type SigningDetail = SigningRow & {
  TaiLieu: { fileName: string; url: string; uploadedAt?: string }[];
  DongSoHuuIds: string[];
};

export type Procedure = { id: string; name: string };

export const SigningService = {
  /** Danh sách lịch ký (fn_signing_appointment_list); đại lý chỉ thấy dự án được gán. */
  list: async (filter: {
    isPersonal: boolean;
    state?: SigningState | null;
    search?: string;
    projectId?: string | null;
    limit?: number;
  }): Promise<SigningRow[]> => {
    const tenant = await requireTenant();
    const scope = await agencyProjectIds();
    if (scope && filter.projectId && !scope.has(String(filter.projectId))) return [];
    const res = await axiosApiSupabase.post("rest/v1/rpc/fn_signing_appointment_list", {
      p_ma_ctdk_uid: tenant,
      p_project_id: uid(filter.projectId),
      p_input_search: String(filter.search || "").trim() || null,
      p_state: filter.state ? String(filter.state).toUpperCase() : null,
      p_is_personal: filter.isPersonal,
      p_offset: 0,
      p_limit: filter.limit ?? 500,
    });
    const rows = rpcRows(res.data).rows.map(mapListRow);
    // Không xác định được dự án → giữ lại (như web)
    return scope ? rows.filter((r) => !r.MaDA || scope.has(String(r.MaDA))) : rows;
  },

  /** Chi tiết 1 lịch ký theo uuid hoặc seq (fn_signing_appointment_get). */
  get: async (idOrSeq: string | number): Promise<SigningDetail> => {
    const tenant = await requireTenant();
    const isUuid = !!uid(idOrSeq);
    const res = await axiosApiSupabase.post("rest/v1/rpc/fn_signing_appointment_get", {
      p_ma_ctdk_uid: tenant,
      p_id: isUuid ? String(idOrSeq) : null,
      p_seq: isUuid ? null : Number(idOrSeq),
    });
    const d = Array.isArray(res.data) ? res.data[0] : res.data;
    if (!d) throw new Error("Không tìm thấy lịch ký");
    return {
      ...mapListRow(d),
      TaiLieu: Array.isArray(d.tai_lieu) ? d.tai_lieu : [],
      DongSoHuuIds: Array.isArray(d.dong_so_huu_ids) ? d.dong_so_huu_ids.map(String) : [],
    };
  },

  /** Tạo / sửa – máy chủ kiểm tra ca, ghi dữ liệu và nhật ký trong 1 lệnh. Trả về seq. */
  upsert: async (form: any): Promise<number> => {
    const tenant = await requireTenant();
    const [employeeId, agencySanId, actorId, actorName] = await Promise.all([
      getEmployeeId(),
      SigningService.agencySanId(),
      getMaNv(),
      currentUserName(),
    ]);
    try {
      const res = await axiosApiSupabase.post("rest/v1/rpc/fn_signing_appointment_upsert", {
        p_payload: buildUpsertPayload(form, { tenantId: tenant, employeeId, agencySanId, actorId, actorName }),
      });
      const d = Array.isArray(res.data) ? res.data[0] : res.data;
      return Number(d?.seq);
    } catch (e) {
      throw new Error(errMsg(e, "Lưu lịch ký thất bại"));
    }
  },

  /** Đổi trạng thái 1 hoặc nhiều lịch ký. */
  setState: async (ids: number[], state: SigningState, note: string) => {
    await requireTenant();
    const [actorId, actorName] = await Promise.all([getMaNv(), currentUserName()]);
    try {
      await axiosApiSupabase.post("rest/v1/rpc/fn_signing_appointment_set_state", {
        p_ids: ids.map(Number).filter(Number.isFinite),
        p_state: String(state).toUpperCase(),
        p_note: note || null,
        p_actor_id: actorId,
        p_actor_name: actorName,
      });
    } catch (e) {
      throw new Error(errMsg(e, "Không cập nhật được trạng thái"));
    }
  },

  remove: async (ids: number[]) => {
    await requireTenant();
    const [actorId, actorName] = await Promise.all([getMaNv(), currentUserName()]);
    try {
      await axiosApiSupabase.post("rest/v1/rpc/fn_signing_appointment_delete", {
        p_ids: ids.map(Number),
        p_actor_id: actorId,
        p_actor_name: actorName,
      });
    } catch (e) {
      throw new Error(errMsg(e, "Xoá lịch ký thất bại"));
    }
  },

  /** Tìm phiếu đặt cọc (fn_signing_deposit_search). */
  searchDeposits: async (keyword: string, projectId?: string | null): Promise<Deposit[]> => {
    const tenant = await requireTenant();
    const res = await axiosApiSupabase.post("rest/v1/rpc/fn_signing_deposit_search", {
      p_ma_ctdk_uid: tenant,
      p_search: String(keyword || "").trim() || null,
      p_project_id: uid(projectId),
      p_id: null,
      p_limit: 30,
    });
    const list = rpcRows(res.data).rows.map(mapDeposit);
    const scope = await agencyProjectIds();
    return scope ? list.filter((d) => !d.MaDA || scope.has(String(d.MaDA))) : list;
  },

  getDeposit: async (pgcId: string | null | undefined): Promise<Deposit | null> => {
    const id = uid(pgcId);
    if (!id) return null;
    const tenant = await requireTenant();
    const res = await axiosApiSupabase.post("rest/v1/rpc/fn_signing_deposit_search", {
      p_ma_ctdk_uid: tenant,
      p_search: null,
      p_project_id: null,
      p_id: id,
      p_limit: 1,
    });
    const d = rpcRows(res.data).rows[0];
    return d ? mapDeposit(d) : null;
  },

  /** Loại thủ tục đang dùng (cloud_signing_procedures theo ma_ctdk = uuid công ty). */
  procedures: async (): Promise<Procedure[]> => {
    const tenant = await requireTenant();
    const res = await axiosApiSupabase.get("rest/v1/cloud_signing_procedures", {
      params: { select: "id,ky_hieu,name,stt,is_active", ma_ctdk: `eq.${tenant}`, order: "stt.asc" },
    });
    return (Array.isArray(res.data) ? res.data : [])
      .filter((r: any) => r.is_active !== false && r.id)
      .map((r: any) => ({ id: String(r.id), name: r.name || String(r.ky_hieu) }));
  },

  /** Ca còn lượt trong 1 ngày (fn_signing_shift_slots) – cần đủ ngày, phiếu giữ chỗ, loại thủ tục. */
  slots: async (day: string, procedureId: string | null, pgcId: string | null): Promise<ShiftSlot[]> => {
    if (!day || !procedureId || !pgcId) return [];
    const tenant = await requireTenant();
    try {
      const res = await axiosApiSupabase.post("rest/v1/rpc/fn_signing_shift_slots", {
        p_ma_ctdk: tenant,
        p_ngay: day,
        p_ma_pgc: pgcId,
        p_loai_thu_tuc_id: procedureId,
      });
      return rpcRows(res.data).rows.map((r: any) => ({
        id: String(r.shift_id),
        name: r.name || String(r.ky_hieu),
        from: r.tu_gio || "",
        to: r.den_gio || "",
        capacity: Number(r.capacity) || 0,
        used: Number(r.used) || 0,
        remaining: Number(r.remaining) || 0,
      }));
    } catch {
      return [];
    }
  },

  /** Số lượt còn trống theo ngày trong [from, from + days) – như web availabilityByDate. */
  availability: async (from: string, days: number, procedureId: string | null): Promise<Record<string, number>> => {
    if (!procedureId || !from || days <= 0) return {};
    const tenant = await requireTenant();
    const end = addDays(from, days);
    const [shifts, appts] = await Promise.all([
      axiosApiSupabase
        .get("rest/v1/cloud_signing_shifts", {
          params: { select: "id,so_khach,procedure_ids,is_active", ma_ctdk: `eq.${tenant}` },
        })
        .then((r) => (Array.isArray(r.data) ? r.data : []))
        .catch(() => []),
      axiosApiSupabase
        .get("rest/v1/cloud_signing_appointments", {
          params: {
            select: "seq,ca_lam_viec_id,ngay_book_ky,state",
            ma_ctdk_uid: `eq.${tenant}`,
            // 00:00 giờ VN = 17:00 UTC ngày hôm trước
            and: `(ngay_book_ky.gte.${addDays(from, -1)}T17:00:00Z,ngay_book_ky.lt.${addDays(end, -1)}T17:00:00Z)`,
          },
        })
        .then((r) => (Array.isArray(r.data) ? r.data : []))
        .catch(() => []),
    ]);
    return availabilityFrom(shifts, appts, procedureId, quickDays(from, days));
  },

  /**
   * Phương án thanh toán: ưu tiên danh mục tự cấu hình `phuong_an_tt_ky` (Cài đặt danh mục),
   * không có thì danh mục `phuong_an_tt` – cùng nguồn cloud_catalogs (ma_ctdk = mã công ty chữ thường).
   */
  plans: async (): Promise<{ value: any; label: string }[]> => {
    const code = (await getCompanyCode()).trim().toLowerCase();
    if (!code) return [];
    const read = async (type: string) => {
      const r = await axiosApiSupabase.get("rest/v1/cloud_catalogs", {
        params: {
          select: "item_code,item_name,ap_dung,raw,created_at",
          ma_ctdk: `eq.${code}`,
          catalog_type: `eq.${type}`,
        },
      });
      return Array.isArray(r.data) ? r.data : [];
    };
    try {
      const custom = (await read("phuong_an_tt_ky"))
        .filter((r: any) => r.ap_dung !== false)
        .sort((a: any, b: any) => (Number(a.raw?.order) || 0) - (Number(b.raw?.order) || 0));
      if (custom.length)
        return custom.map((r: any) => ({ value: String(r.item_code), label: r.item_name || String(r.item_code) }));
      return (await read("phuong_an_tt"))
        .sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)))
        .map((r: any) => r.raw || {})
        .map((it: any) => ({
          value: it.MaPATT ?? it.ID ?? it.Ma,
          label: it.TenPATT ?? it.Ten ?? it.TenPhuongAn ?? `#${it.ID ?? ""}`,
        }))
        .filter((o: any) => o.value != null);
    } catch {
      return [];
    }
  },

  /** Phân loại khách từ danh mục `phan_loai_kh` (rỗng → dùng danh sách mặc định). */
  customerTypes: async (): Promise<{ value: any; label: string }[]> => {
    const code = (await getCompanyCode()).trim().toLowerCase();
    if (!code) return [];
    try {
      const r = await axiosApiSupabase.get("rest/v1/cloud_catalogs", {
        params: {
          select: "raw,created_at",
          ma_ctdk: `eq.${code}`,
          catalog_type: "eq.phan_loai_kh",
          order: "created_at.asc",
        },
      });
      return (Array.isArray(r.data) ? r.data : [])
        .map((x: any) => x.raw || {})
        .map((it: any) => ({ value: it.ID ?? it.MaPhanLoaiKH ?? it.Ma, label: it.Name ?? it.Ten ?? `#${it.ID ?? ""}` }))
        .filter((o: any) => o.value != null);
    } catch {
      return [];
    }
  },

  /** Đại lý phụ trách (sàn giao dịch dm_companies is_san). */
  agencies: async (): Promise<{ value: string; label: string }[]> => {
    const res: any = await ProductService.getSanGiaoDichAPI().catch(() => ({ data: [] }));
    return (res?.data ?? []).map((s: any) => ({ value: String(s.ID), label: s.TenSan || "Sàn giao dịch" }));
  },

  /** Sàn của tài khoản đại lý = chi nhánh trong token (web agencySanIdSync); null với tài khoản hệ thống. */
  agencySanId: async (): Promise<string | null> => {
    if (!(await isAgency())) return null;
    return uid(await getBranchId());
  },

  /** Thông tin hiển thị của các khách (đồng đứng tên) theo uuid. */
  customersByIds: async (ids: string[]) => {
    const list = ids.map(uid).filter(Boolean) as string[];
    if (!list.length) return [];
    const res = await axiosApiSupabase.get("rest/v1/cloud_customers", {
      params: {
        select: "id,ma_so_kh,ten_kh,ten_cong_ty,cccd,dien_thoai,email,is_personal",
        id: `in.(${list.join(",")})`,
      },
    });
    const map = new Map((Array.isArray(res.data) ? res.data : []).map((c: any) => [String(c.id), c]));
    return list.map((id) => map.get(id)).filter(Boolean) as any[];
  },
};
