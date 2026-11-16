// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/preBooking/read.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * BOOKING THIỆN CHÍ — nghiệp vụ ĐỌC (danh sách, chi tiết, thống kê).
 * Mọi truy vấn lọc theo `ma_ctdk_uid` (công ty đăng ký) và `da_project_id`.
 */
import { supabase } from "../../_shims/integrations/supabase/client";
import { cleanCompanyIds } from "../../_extract/services/system/permitted-company";
import {
  TBL,
  agencyMaSan,
  bookingMaCTDK,
  fail,
  ok,
  resolveProjectId,
  resolveSanId,
  sanValue,
  str,
  tenantUid,
  uid,
} from "./context";
import { detailOut, listOut, loadRefs, mapRows } from "./hydrate";

/** Một dòng booking theo số thứ tự phiếu (seq) — trong phạm vi công ty đăng ký. */
export const bySeq = async (seq: number) => {
  const tenant = tenantUid();
  if (!tenant || !seq) return null;
  const { data } = await supabase
    .from(TBL)
    .select("*")
    .eq("ma_ctdk_uid", tenant)
    .eq("seq", seq)
    .maybeSingle();
  return data as any;
};

export const bySeqs = async (seqs: number[]) => {
  const tenant = tenantUid();
  const list = Array.from(new Set(seqs.filter(Boolean)));
  if (!tenant || !list.length) return [] as any[];
  const { data } = await supabase
    .from(TBL)
    .select("*")
    .eq("ma_ctdk_uid", tenant)
    .in("seq", list);
  return (data as any[]) || [];
};

/**
 * Danh sách booking thiện chí — `fn_pre_booking_list` (migration 20261015230200). Công ty đăng ký, phạm vi dữ liệu
 * (Theo công ty / Theo nhân viên), lọc đại lý theo sàn, tìm kiếm khách / căn, xoá mềm và phân trang đều chạy ở máy chủ;
 * FE chỉ đổi mã dự án / sàn cũ sang uuid rồi map lại đúng khuôn dòng cũ.
 */
export const getList = async (payload: any = {}) => {
  const tenant = tenantUid();
  if (!tenant) return fail("Không xác định được công ty đăng ký");

  const pageIndex = Number(payload.PageIndex) || 1;
  const pageSize = Number(payload.PageSize) || 50;
  const projectId = await resolveProjectId(payload.MaDA);
  const sanId = await resolveSanId(agencyMaSan() ?? sanValue(payload.MaSan));

  const state =
    Array.isArray(payload.State) && payload.State.length
      ? payload.State
      : typeof payload.State === "string" && payload.State
        ? payload.State
        : null;

  const { data, error } = await supabase.rpc("fn_pre_booking_list" as any, {
    p: {
      project_id: projectId,
      san_id: sanId,
      search: str(payload.InputSearch),
      state,
      form_code: payload.FormCode || null,
      tu_ngay: payload.TuNgay || null,
      den_ngay: payload.DenNgay || null,
      deleted: !!payload.Deleted,
      page: pageIndex,
      size: pageSize,
      company_ids: cleanCompanyIds(payload.CompanyIds),
    },
  } as any);
  if (error) return fail(error.message);

  const res: any = data ?? {};
  const total = Number(res.total ?? 0);
  const rows = await mapRows(Array.isArray(res.rows) ? res.rows : [], total);
  return ok(rows, { totalCount: total });
};

export const getById = async (id: number) => {
  const row = await bySeq(Number(id));
  if (!row) return fail("Không tìm thấy phiếu booking");
  const refs = await loadRefs([row]);
  return ok(detailOut(row, refs));
};

/**
 * Đếm booking đang hiệu lực của 1 khách hàng tại 1 dự án (giới hạn so_booking_max) — máy chủ đếm TOÀN tenant
 * (`fn_pre_booking_customer_count`; bảng có RLS trần công ty, đếm qua PostgREST chỉ thấy phần trong phạm vi).
 */
export const countCustomerActiveBookings = async (
  khachHangId: any,
  projectId: string | null,
  excludeSeq?: number | null
): Promise<number> => {
  const kh = uid(khachHangId);
  const da = uid(projectId);
  if (!kh || !da) return 0;
  const { data, error } = await supabase.rpc("fn_pre_booking_customer_count" as any, {
    p_customer_id: kh,
    p_project_id: da,
    p_exclude_seq: excludeSeq ? Number(excludeSeq) : null,
  } as any);
  return error ? 0 : Number(data) || 0;
};

export const countByKH = async (maKH: any) => {
  const tenant = tenantUid();
  const kh = uid(maKH);
  if (!tenant || !kh) return 0;
  const { count } = await supabase
    .from(TBL)
    .select("id", { count: "exact", head: true })
    .eq("ma_ctdk_uid", tenant)
    .eq("khach_hang_id", kh)
    .is("deleted_at", null);
  return count || 0;
};

export const getByKH = async (payload: any) => {
  const tenant = tenantUid();
  const kh = uid(payload?.MaKH);
  if (!tenant || !kh) return ok([]);

  let q = supabase
    .from(TBL)
    .select("*")
    .eq("ma_ctdk_uid", tenant)
    .eq("khach_hang_id", kh)
    .is("deleted_at", null);

  const projectId = await resolveProjectId(payload?.MaDA);
  if (projectId) q = q.eq("da_project_id", projectId);
  const sanId = await resolveSanId(agencyMaSan() ?? sanValue(payload?.MaSan));
  if (sanId) q = q.eq("san_id", sanId);

  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) return fail(error.message);
  return ok(await mapRows((data as any[]) || []));
};

export const countActiveByCustomer = async (payload: {
  MaKH: string | number;
  MaDA: any;
  excludeBookingId?: number | null;
}) => {
  const projectId = await resolveProjectId(payload.MaDA);
  const count = await countCustomerActiveBookings(
    payload.MaKH,
    projectId,
    payload.excludeBookingId ?? null
  );
  return ok({ count });
};

/** Danh sách booking con của 1 phiếu gộp. */
export const getByMPG = async (maPG: number) => {
  const { data: voucher } = await supabase
    .from("cloud_booking_merge_vouchers" as any)
    .select("id")
    .eq("ma_ctdk", tenantUid())
    .eq("seq", Number(maPG))
    .maybeSingle();
  if (!voucher) return ok([]);
  const { data: items } = await supabase
    .from("cloud_booking_merge_items" as any)
    .select("booking_id")
    .eq("voucher_id", (voucher as any).id);
  const ids = ((items as any[]) || []).map((i) => i.booking_id).filter(Boolean);
  if (!ids.length) return ok([]);
  const { data } = await supabase.from(TBL).select("*").in("id", ids);
  return ok(await mapRows((data as any[]) || []));
};

export { listOut, detailOut, loadRefs, mapRows };
