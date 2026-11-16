// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/preBooking/vouchers.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * BOOKING THIỆN CHÍ — lịch sử, đổi tên, phiếu gộp và phiếu hoàn.
 *
 * Mọi bảng chứng từ phụ (`cloud_pre_booking_renames`, `..._logs`,
 * `cloud_booking_merge_*`, `cloud_booking_refund_vouchers`) chỉ lưu
 * KHÓA UUID: công ty đăng ký, dự án, sàn, khách hàng và nhân viên.
 * Lịch sử thu tiền đọc phiếu thu (`receipts.ts`).
 */
import { supabase } from "../../_shims/integrations/supabase/client";
import { stateFor } from "../bookingStateResolver";
import { CustomerCloudService } from "../CustomerCloudService";
import { writeAudit, diffFields } from "../CloudAuditService";
import {
  TBL,
  applyDeletedFilter,
  agencySanUid,
  currentEmployeeId,
  employeeNames,
  fail,
  ok,
  resolveProjectId,
  resolveSanId,
  softDeletePatchUid,
  str,
  tenantUid,
  uid,
  writeLog,
} from "./context";
import { loadRefs, listOut } from "./hydrate";
import { bySeq } from "./read";
import { cleanCompanyIds } from "../../_extract/services/system/permitted-company";
import { mapBookingRefundRow } from "./refundRows";
import { PreBookingReceiptService, type PreBookingReceipt } from "./receipts";
import { RENAME_COLS, mapActionLogRow, mapRenameHistoryRow } from "./historyRows";
import { rpcRaw } from "../_core/rpc";
import { normalizeCoOwnerIds } from "./coOwners";
import { resolveCoOwnerUids } from "./coOwnerRefs";
import { getHostForm } from "../../lib/hostForm";

/** Tên người tạo cho danh sách chứng từ (JOIN theo UUID nhân viên). */
const withCreatorNames = async (rows: any[]) => {
  const map = await employeeNames(
    rows.flatMap((r) => [r.created_by_id, r.nguoi_duyet_id, r.deleted_by_id])
  );
  return map;
};

/* ------------------------------------------------------------------ */
/* Lịch sử                                                             */
/* ------------------------------------------------------------------ */

/**
 * Lịch sử thu tiền = PHIẾU THU của booking (`fn_pre_booking_receipt_list`, loại 36 + 47, gồm phiếu booking con đã gộp).
 * Ưu tiên `BookingUID`; thiếu thì tra uuid theo `MaBooking` (seq). Không thấy booking ⇒ []. Lỗi RPC ⇒ ném.
 */
export const lsThuTien = async (payload: {
  BookingUID?: string | null;
  MaBooking?: number | null;
}): Promise<PreBookingReceipt[]> => {
  let id = uid(payload?.BookingUID);
  if (!id) {
    const row = await bySeq(Number(payload?.MaBooking));
    id = uid(row?.id);
  }
  if (!id) return [];
  return PreBookingReceiptService.listReceipts(id);
};

/**
 * Lịch sử đổi tên của 1 booking — `fn_pre_booking_rename_history` (migration 20261101303600): thông tin khách cũ / mới là BẢN CHỤP lúc lập
 * yêu cầu (khách ngoài phạm vi người xem đã che ở máy chủ). Lỗi RPC ⇒ ném (drawer báo lỗi).
 */
export const lsDoiTen = async (payload: any) => {
  const seq = Number(payload?.MaBooking);
  if (!Number.isFinite(seq) || seq <= 0) return ok([]);
  const rows = await rpcRaw<any[]>(
    "fn_pre_booking_rename_history",
    { p_booking_seq: seq },
    { fallback: "Không tải được lịch sử đổi tên" }
  );
  return ok((Array.isArray(rows) ? rows : []).map((r) => mapRenameHistoryRow(r, seq)));
};

export const lsThaoTac = async (payload: any) => {
  const row = await bySeq(Number(payload?.MaBooking));
  if (!row) return ok([]);
  const { data } = await supabase
    .from("cloud_pre_booking_logs" as any)
    .select("*")
    .eq("booking_id", row.id)
    .order("created_at", { ascending: false });
  const rows = (data as any[]) || [];
  const names = await withCreatorNames(rows);
  return ok(rows.map((r) => mapActionLogRow(r, names)));
};


/* ------------------------------------------------------------------ */
/* Đổi tên booking                                                     */
/* ------------------------------------------------------------------ */

export const rename = async (payload: any) => {
  const row = await bySeq(Number(payload?.MaBooking));
  if (!row) return fail("Không tìm thấy phiếu booking");
  const refs = await loadRefs([row]);
  const view = listOut(row, refs);

  let tenMoi = str(payload?.TenKHMoi);
  let khMoiId = uid(payload?.MaKHMoi);
  if (payload?.MaKHMoi) {
    try {
      const cc: any = await CustomerCloudService.getCustomerByRef(
        payload.MaKHMoi
      );
      if (cc) {
        tenMoi = tenMoi ?? str(cc.TenKH);
        khMoiId = khMoiId ?? uid(cc.ID) ?? uid(cc.id);
      }
    } catch {
      /* ignore */
    }
  }
  if (!tenMoi) return fail("Không xác định được khách hàng mới");
  if (!khMoiId) return fail("Khách hàng mới chưa có trong danh mục khách hàng");

  // Người đồng đứng tên chỉ ghi khi form gửi danh sách (không gửi ⇒ giữ hành vi cũ: duyệt không đổi đồng đứng tên)
  const dsh = Array.isArray(payload?.DongSoHuuMoi)
    ? await resolveCoOwnerUids(payload.DongSoHuuMoi, khMoiId)
    : null;
  if (dsh && !dsh.ok) return fail(dsh.message);

  const body: any = {
    ma_ctdk: tenantUid(),
    booking_id: row.id,
    ma_kh_cu: uid(payload?.MaKHCu) ?? uid(row.khach_hang_id),
    ma_kh_moi: khMoiId,
    dien_giai: str(payload?.DienGiai),
    tai_lieus: payload?.TaiLieus ?? [],
    created_by_id: currentEmployeeId(),
  };
  if (dsh?.ok) body.dong_so_huu_moi = dsh.ids;

  if (payload?.ID) {
    const { data: before } = await supabase
      .from("cloud_pre_booking_renames" as any)
      .select(RENAME_COLS)
      .eq("ma_ctdk", tenantUid())
      .eq("seq", Number(payload.ID))
      .maybeSingle();
    // Yêu cầu lập trước tính năng (chưa có danh sách lúc lập) ⇒ chụp danh sách hiện tại để bỏ duyệt trả lại được
    if (dsh?.ok && !Array.isArray((before as { dong_so_huu_cu?: unknown } | null)?.dong_so_huu_cu))
      body.dong_so_huu_cu = normalizeCoOwnerIds(row.dong_so_huu);
    const { error } = await supabase
      .from("cloud_pre_booking_renames" as any)
      .update({ ...body, created_by_id: undefined, updated_by_id: currentEmployeeId() })
      .eq("ma_ctdk", tenantUid())
      .eq("seq", Number(payload.ID));

    if (error) return fail(error.message);
    await writeAudit({
      module: "RENAME",
      action: "UPDATE",
      entityId: payload.ID,
      entityCode: row.so_phieu,
      entityName: tenMoi ?? view.TenKH,
      maDA: view.MaDA,
      reason: payload?.DienGiai ?? null,
      changes: diffFields(before || {}, body, {
        ma_kh_moi: "Khách hàng mới",
        ten_kh_moi: "Tên khách hàng mới",
        dien_giai: "Lý do đổi tên",
        tai_lieus: "Tài liệu",
      }),
    });
    return ok(true);
  }

  // Danh sách lúc lập (bỏ duyệt trả lại); sửa yêu cầu không ghi đè
  if (dsh?.ok) body.dong_so_huu_cu = normalizeCoOwnerIds(row.dong_so_huu);
  const { data, error } = await supabase
    .from("cloud_pre_booking_renames" as any)
    .insert(body)
    .select("seq")
    .single();
  if (error) return fail(error.message);
  await supabase
    .from(TBL)
    .update({ ls_doi_ten_id: (data as any).seq })
    .eq("id", row.id);
  await writeLog(row.id, "RENAME", `Yêu cầu đổi tên: ${view.TenKH || "—"} → ${tenMoi ?? "—"}`);
  await writeAudit({
    module: "RENAME",
    action: "CREATE",
    entityId: (data as any).seq,
    entityCode: row.so_phieu,
    entityName: tenMoi,
    maDA: view.MaDA,
    reason: payload?.DienGiai ?? null,
    changes: [
      { field: "ten_kh", label: "Khách hàng", from: view.TenKH, to: tenMoi },
    ],
    snapshot: { MaBooking: row.seq, TaiLieus: payload?.TaiLieus ?? [] },
  });
  return ok({ ID: (data as any).seq });
};

/* ------------------------------------------------------------------ */
/* Phiếu gộp                                                           */
/* ------------------------------------------------------------------ */

const mergeOut = (r: any, names: Record<string, string> = {}) => ({
  ID: Number(r.seq),
  MaPhieuGop: Number(r.seq),
  SoPhieu: r.so_phieu ?? `PG${r.seq}`,
  KyHieu: r.so_phieu ?? `PG${r.seq}`,
  NgayLap: r.ngay_lap,
  MaDA: r.da_project_id,
  TenDA: r.ten_da,
  MaKH: r.khach_hang_id,
  TenKH: r.ten_kh,
  DiDong: r.di_dong,
  TongTien: Number(r.tong_tien) || 0,
  SoLuongBookingCon: Number(r.sl_booking_con) || 0,
  DienGiai: r.dien_giai,
  GhiChu: r.dien_giai,
  State: r.state,
  NguoiTao: names[String(r.created_by_id ?? "")] ?? null,
  CreatedAt: r.created_at,
  IsDeleted: r.deleted_at ? 1 : 0,
  DeletedAt: r.deleted_at ?? null,
  DeletedBy: names[String(r.deleted_by_id ?? "")] ?? null,
  // Công ty của CHỨNG TỪ (không phải công ty của khách)
  CompanyIdChungTu: r.company_id ?? null,
  TenCtyChungTu: r.ten_cong_ty ?? "",
});

/** Ghép phiếu gộp với booking đích (mã phiếu, dự án, khách hàng, tiền). */
const enrichMergeRows = async (rows: any[]) => {
  if (!rows?.length) return [];
  const ids = Array.from(
    new Set(rows.map((r) => r.booking_dich_id).filter(Boolean))
  );
  const bkMap = new Map<string, any>();
  let refs = await loadRefs([]);
  if (ids.length) {
    const { data } = await supabase.from(TBL).select("*").in("id", ids as any);
    const bookings = (data as any[]) || [];
    refs = await loadRefs(bookings);
    bookings.forEach((b) => bkMap.set(b.id, b));
  }
  const names = await withCreatorNames(rows);
  return rows.map((r) => {
    const b = r.booking_dich_id ? bkMap.get(r.booking_dich_id) : null;
    const view = b ? listOut(b, refs) : null;
    const base = mergeOut(r, names);
    return {
      ...base,
      SoPhieu: view?.SoPhieu ?? base.SoPhieu,
      SoPhieuGop: r.so_phieu ?? `PG${r.seq}`,
      MaBooking: b ? Number(b.seq) : null,
      KyHieu: view?.KyHieu ?? base.KyHieu,
      MaDA: view?.MaDA ?? base.MaDA ?? null,
      TenDA: view?.TenDA ?? r.ten_da ?? null,
      MaKH: view?.MaKH ?? r.khach_hang_id ?? null,
      MaSoKH: view?.MaSoKH ?? null,
      TenKH: view?.TenKH ?? r.ten_kh ?? null,
      DiDong: view?.DiDong ?? r.di_dong ?? null,
      Email: view?.Email ?? null,
      SoCMND: view?.SoCMND ?? null,
      TienGiuCho: view?.TienGiuCho ?? 0,
      TienThu: view?.TienThu ?? 0,
    };
  });
};

/**
 * Lập / sửa phiếu gộp — `fn_booking_merge_save` (migration 20261016000300): MỘT giao dịch ở máy chủ kiểm quyền Thêm / Sửa,
 * khoá phiếu (sửa: chỉ phiếu chờ duyệt) + booking đích + booking con theo thứ tự, kiểm phạm vi từng booking, cùng khách / dự án /
 * đã duyệt, ghi phiếu + dòng con, bỏ neo booking con bị bỏ ra, neo booking con mới và booking đích; bước nào lỗi thì không bước
 * nào được ghi. FE chỉ dựng chữ hiển thị (dự án / khách / di động) như cũ rồi ghi nhật ký + audit sau khi RPC thành công.
 */
export const phieuGop = async (payload: any) => {
  const parent = await bySeq(Number(payload?.MaBookingGop));
  if (!parent) return fail("Không tìm thấy booking gốc");
  const childSeqs = Array.from(
    new Set(((payload?.ListMaBooking ?? []) as any[]).map(Number).filter((n) => Number.isFinite(n) && n > 0))
  );
  const refs = await loadRefs([parent]);
  const parentView = listOut(parent, refs);
  const editSeq = payload?.ID ? Number(payload.ID) : null;

  const [childState, removedState] = await Promise.all([
    stateFor("MERGE_CREATE", "MERGING"),
    stateFor("MERGE_REJECT", "APPROVED"),
  ]);
  const { data, error } = await supabase.rpc("fn_booking_merge_save" as any, {
    p: {
      id: editSeq,
      host_form: editSeq ? null : getHostForm(),
      booking_dich_seq: Number(parent.seq),
      child_seqs: childSeqs,
      ghi_chu: payload?.GhiChu ?? null,
      ten_da: parentView.TenDA ?? null,
      ten_kh: parentView.TenKH ?? null,
      di_dong: parentView.DiDong ?? null,
      child_state: childState,
      removed_state: removedState,
    },
  } as any);
  if (error) return fail(error.message);
  const res: any = data || {};
  const seq = Number(res.seq);
  const soPhieu = res.so_phieu ?? `PG${seq}`;
  const nChildren = Number(res.children) || 0;

  await writeLog(parent.id, "MERGE", `${editSeq ? "Sửa" : "Tạo"} phiếu gộp ${nChildren} booking`);
  await writeAudit({
    module: "MERGE",
    action: editSeq ? "UPDATE" : "CREATE",
    entityId: seq,
    entityCode: soPhieu,
    entityName: parentView.TenKH,
    maDA: parentView.MaDA,
    reason: payload?.GhiChu ?? null,
    changes: [
      {
        field: "sl_booking_con",
        label: "Số booking con",
        from: null,
        to: nChildren,
      },
      {
        field: "tong_tien",
        label: "Tổng tiền",
        from: Number(parent.tien_giu_cho) || 0,
        to: Number(res.tong_tien) || 0,
      },
    ],
    snapshot: {
      BookingDich: parent.so_phieu,
      BookingCon: Array.isArray(res.children_so_phieu) ? res.children_so_phieu : [],
      ...(Number(res.removed) ? { BookingBoRa: Number(res.removed) } : {}),
    },
  });
  return ok({ ID: seq });
};

/**
 * Danh sách phiếu gộp — `fn_booking_merge_voucher_list` (migration 20261016000100): công ty đăng ký từ JWT,
 * 3 lớp phạm vi dữ liệu, ép sàn của đại lý, lọc + tìm kiếm + phân trang ở máy chủ. Không gửi tenant / form.
 */
export const phieuGopGetList = async (payload: any = {}) => {
  const pageIndex = Number(payload.PageIndex) || 1;
  const pageSize = Number(payload.PageSize) || 50;
  const daGop =
    payload.MaDA != null && payload.MaDA !== ""
      ? await resolveProjectId(payload.MaDA)
      : null;
  const sanGop = await resolveSanId(payload.MaSan);
  const { data, error } = await supabase.rpc("fn_booking_merge_voucher_list" as any, {
    p: {
      project_id: daGop,
      san_id: sanGop,
      search: str(payload.InputSearch),
      tu_ngay: payload.TuNgay || null,
      den_ngay: payload.DenNgay || null,
      deleted: !!payload.Deleted,
      page: pageIndex,
      size: pageSize,
      company_ids: cleanCompanyIds(payload.CompanyIds),
    },
  } as any);
  if (error) return fail(error.message);
  const total = Number((data as any)?.total) || 0;
  const rows = await enrichMergeRows(((data as any)?.rows as any[]) || []);
  return ok(
    rows.map((r) => ({ ...r, TotalRow: total })),
    { totalCount: total }
  );
};

export const lsGopBooking = async (payload: any) => {
  const row = await bySeq(Number(payload?.MaBooking));
  if (!row) return ok([]);
  const { data: items } = await supabase
    .from("cloud_booking_merge_items" as any)
    .select("voucher_id")
    .eq("booking_id", row.id);
  const ids = new Set<string>(((items as any[]) || []).map((i) => i.voucher_id));
  const { data: own } = await supabase
    .from("cloud_booking_merge_vouchers" as any)
    .select("*")
    .eq("ma_ctdk", tenantUid())
    .eq("booking_dich_id", row.id);
  ((own as any[]) || []).forEach((v) => ids.add(v.id));
  if (!ids.size) return ok([]);
  const { data } = await supabase
    .from("cloud_booking_merge_vouchers" as any)
    .select("*")
    .in("id", Array.from(ids))
    .order("created_at", { ascending: false });
  return ok(await enrichMergeRows((data as any[]) || []));
};

/** Cảnh báo khi máy chủ bỏ qua booking con (không còn neo vào phiếu / ngoài phạm vi của người thao tác). */
const skippedWarning = (applied: any): Record<string, any> => {
  const skipped = Number(applied?.skipped) || 0;
  return skipped > 0
    ? {
        warning: `${skipped} booking con không được cập nhật (không còn gắn với phiếu hoặc ngoài phạm vi của bạn)`,
      }
    : {};
};

/**
 * Đổi trạng thái phiếu gộp — `fn_booking_merge_change_state` (migration 20261016000200): MỘT giao dịch ở máy chủ khoá phiếu,
 * kiểm phạm vi + quyền Sửa, dồn booking con, cập nhật booking đích (tiền thu chỉ cộng 1 lần, từ chối / hủy duyệt trả lại đúng
 * phần đã cộng) rồi mới đổi trạng thái phiếu; bước nào lỗi thì không bước nào được ghi.
 */
export const phieuGopChangeState = async (payload: any) => {
  const seq = Number(payload?.MaPhieuGop ?? payload?.ID);
  const state = payload?.State;
  const { data: voucher } = await supabase
    .from("cloud_booking_merge_vouchers" as any)
    .select("*")
    .eq("ma_ctdk", tenantUid())
    .eq("seq", seq)
    .maybeSingle();
  if (!voucher) return fail("Không tìm thấy phiếu gộp");
  const v: any = voucher;

  const childState =
    state === "APPROVED"
      ? await stateFor("MERGE_APPROVE", "MERGED")
      : state === "REJECTED"
      ? await stateFor("MERGE_REJECT", "APPROVED")
      : state === "UNAPPROVED"
      ? await stateFor("MERGE_CREATE", "MERGING")
      : null;
  const { data: applied, error } = await supabase.rpc("fn_booking_merge_change_state" as any, {
    p_voucher_id: v.id,
    p_state: state,
    p_child_state: childState,
  } as any);
  if (error) return fail(error.message);
  const res: any = applied || {};
  const stateFrom = res.state_from ?? v.state;
  const nextState = res.state_to ?? (state === "UNAPPROVED" ? "PENDING" : state);

  if (v.booking_dich_id)
    await writeLog(v.booking_dich_id, "MERGE_STATE", `Phiếu gộp: ${state}`);
  await writeAudit({
    module: "MERGE",
    action:
      state === "APPROVED"
        ? "APPROVE"
        : state === "REJECTED"
        ? "REJECT"
        : state === "UNAPPROVED"
        ? "UNAPPROVE"
        : state === "CANCELED"
        ? "CANCEL"
        : "STATE",
    entityId: v.seq,
    entityCode: v.so_phieu,
    entityName: v.ten_kh,
    maDA: v.da_project_id,
    reason: payload?.GhiChu ?? payload?.LyDo ?? null,
    stateFrom,
    stateTo: nextState,
    changes: [
      { field: "state", label: "Trạng thái", from: stateFrom, to: nextState },
    ],
  });
  return ok(true, skippedWarning(res));
};

/**
 * Xoá mềm phiếu gộp — `fn_booking_merge_delete`: một giao dịch trả booking con về trạng thái trước gộp + bỏ neo, gỡ chờ duyệt
 * gộp ở booking đích và xoá mềm phiếu (quyền Xoá).
 */
export const phieuGopDelete = async (id: number) => {
  const { data: voucher } = await supabase
    .from("cloud_booking_merge_vouchers" as any)
    .select("*")
    .eq("ma_ctdk", tenantUid())
    .eq("seq", Number(id))
    .maybeSingle();
  if (!voucher) return fail("Không tìm thấy phiếu gộp");
  const v: any = voucher;
  const { data: applied, error } = await supabase.rpc("fn_booking_merge_delete" as any, {
    p_voucher_id: v.id,
    p_child_state: await stateFor("MERGE_REJECT", "APPROVED"),
  } as any);
  if (error) return fail(error.message);
  await writeAudit({
    module: "MERGE",
    action: "DELETE",
    entityId: v.seq,
    entityCode: v.so_phieu,
    entityName: v.ten_kh,
    maDA: v.da_project_id,
    stateFrom: (applied as any)?.state_from ?? v.state,
    snapshot: v,
  });
  return ok(true, skippedWarning(applied));
};

export const phieuGopRestore = async (id: number) => {
  const { error } = await supabase
    .from("cloud_booking_merge_vouchers" as any)
    .update({ deleted_at: null, deleted_by_id: null } as any)
    .eq("ma_ctdk", tenantUid())
    .eq("seq", Number(id));
  if (error) return fail(error.message);
  return ok(true);
};

/* ------------------------------------------------------------------ */
/* Phiếu hoàn                                                          */
/* ------------------------------------------------------------------ */

const refundOut = (
  r: any,
  bookingView?: any,
  names: Record<string, string> = {}
) => {
  const raw = r.raw || {};
  return {
    ID: Number(r.seq),
    MaPhieuHoan: Number(r.seq),
    SoPhieu: r.so_phieu ?? `PH${r.seq}`,
    MaBooking: bookingView ? Number(bookingView.ID) : null,
    KyHieu: bookingView?.KyHieu ?? bookingView?.SoPhieu ?? r.so_phieu,
    MaDA: bookingView?.MaDA ?? r.da_project_id,
    TenDA: bookingView?.TenDA ?? r.ten_da,
    MaKH: bookingView?.MaKH ?? r.khach_hang_id,
    TenKH: bookingView?.TenKH ?? r.ten_kh,
    DiDong: bookingView?.DiDong ?? r.di_dong,
    Email: bookingView?.Email ?? null,
    SoCMND: bookingView?.SoCMND ?? null,
    TienGiuCho: bookingView?.TienGiuCho ?? 0,
    SoTien: Number(r.so_tien) || 0,
    NgayHoan: r.ngay_hoan,
    MaLyDo: r.ma_ly_do,
    LyDo: r.ly_do,
    MaHinhThuc: raw.MaHinhThuc ?? null,
    SoTaiKhoan: raw.SoTaiKhoan ?? null,
    NganHang: raw.NganHang ?? null,
    GhiChu: raw.GhiChu ?? null,
    State: r.state,
    NguoiTao: names[String(r.created_by_id ?? "")] ?? null,
    CreatedAt: r.created_at,
    IsDeleted: r.deleted_at ? 1 : 0,
    DeletedAt: r.deleted_at ?? null,
    DeletedBy: names[String(r.deleted_by_id ?? "")] ?? null,
    CompanyIdChungTu: r.company_id ?? null,
    TenCtyChungTu: r.ten_cong_ty ?? "",
    SoPhieuChi: r.so_phieu_chi ?? null,
    TrangThaiPhieuChi: r.trang_thai_phieu_chi ?? null,
  };
};


export const phieuHoan = async (payload: any) => {
  const row = await bySeq(Number(payload?.MaBooking));
  if (!row) return fail("Không tìm thấy phiếu booking");
  const refs = await loadRefs([row]);
  const view = listOut(row, refs);

  const body: any = {
    ma_ctdk: tenantUid(),
    san_id: row.san_id ?? null,
    booking_id: row.id,
    da_project_id: row.da_project_id ?? null,
    ten_da: view.TenDA,
    khach_hang_id: row.khach_hang_id ?? null,
    ten_kh: view.TenKH,
    di_dong: view.DiDong,
    so_tien: Number(payload?.SoTien) || 0,
    ngay_hoan: payload?.NgayHoan || new Date().toISOString(),
    ma_ly_do: payload?.MaLyDo ?? null,
    ly_do: payload?.LyDo ?? null,
    raw: {
      MaHinhThuc: payload?.MaHinhThuc ?? null,
      SoTaiKhoan: payload?.SoTaiKhoan ?? null,
      NganHang: payload?.NganHang ?? null,
      GhiChu: payload?.GhiChu ?? null,
    },
    created_by_id: currentEmployeeId(),
  };


  if (payload?.ID) {
    const { data: before } = await supabase
      .from("cloud_booking_refund_vouchers" as any)
      .select("*")
      .eq("ma_ctdk", tenantUid())
      .eq("seq", Number(payload.ID))
      .maybeSingle();
    const { error } = await supabase
      .from("cloud_booking_refund_vouchers" as any)
      .update(body)
      .eq("ma_ctdk", tenantUid())
      .eq("seq", Number(payload.ID));
    if (error) return fail(error.message);
    await writeAudit({
      module: "REFUND",
      action: "UPDATE",
      entityId: payload.ID,
      entityCode: (before as any)?.so_phieu ?? null,
      entityName: view.TenKH,
      maDA: view.MaDA,
      reason: payload?.LyDo ?? payload?.GhiChu ?? null,
      changes: diffFields(before || {}, body, {
        so_tien: "Số tiền hoàn",
        ngay_hoan: "Ngày hoàn",
        ly_do: "Lý do hoàn",
        raw: "Thông tin thanh toán",
      }),
    });
    return ok(true);
  }

  // Tạo phiếu + đánh số PH<seq> + chuyển booking sang "Chờ hoàn tiền" trong MỘT giao dịch ở máy chủ
  // (`fn_booking_refund_voucher_create`): booking ngoài phạm vi ⇒ 42501, không còn phiếu mồ côi.
  const refundCreateState = await stateFor("REFUND_CREATE", "WAITING_REFUND");
  const { data: created, error } = await supabase.rpc("fn_booking_refund_voucher_create" as any, {
    p_booking_id: row.id,
    p: {
      host_form: getHostForm(),
      ten_da: body.ten_da ?? null,
      ten_kh: body.ten_kh ?? null,
      di_dong: body.di_dong ?? null,
      so_tien: body.so_tien,
      ngay_hoan: body.ngay_hoan,
      ma_ly_do: body.ma_ly_do,
      ly_do: body.ly_do,
      raw: body.raw,
    },
    p_booking_state: refundCreateState,
  } as any);
  if (error) return fail(error.message);
  const data: any = { seq: Number((created as any)?.seq), id: (created as any)?.id };
  await writeLog(
    row.id,
    "REFUND",
    "Tạo phiếu hoàn booking",
    row.state,
    refundCreateState
  );
  await writeAudit({
    module: "REFUND",
    action: "CREATE",
    entityId: (data as any).seq,
    entityCode: `PH${(data as any).seq}`,
    entityName: view.TenKH,
    maDA: view.MaDA,
    reason: payload?.LyDo ?? payload?.GhiChu ?? null,
    stateFrom: row.state,
    stateTo: refundCreateState,
    changes: [
      { field: "so_tien", label: "Số tiền hoàn", from: null, to: body.so_tien },
    ],
    snapshot: { MaBooking: row.seq, SoPhieuBooking: row.so_phieu },
  });
  return ok({ ID: (data as any).seq, SoPhieuChi: (created as any)?.so_phieu_chi ?? null });
};

export const lsHoanBooking = async (payload: any) => {
  const row = await bySeq(Number(payload?.MaBooking));
  if (!row) return ok([]);
  const refs = await loadRefs([row]);
  const view = listOut(row, refs);
  const { data } = await supabase
    .from("cloud_booking_refund_vouchers" as any)
    .select("*")
    .eq("booking_id", row.id)
    .order("created_at", { ascending: false });
  const rowsHoan = (data as any[]) || [];
  const namesHoan = await withCreatorNames(rowsHoan);
  return ok(rowsHoan.map((r) => refundOut(r, view, namesHoan)));

};

/**
 * Danh sách Hoàn booking — `fn_booking_refund_list` (migration 20261016000100): MỘT lời gọi trả cả hai nguồn
 * (khối `BOOKING` = phiếu hoàn của booking giữ chỗ, rồi khối `VOUCHER` = phiếu hoàn booking thiện chí), đã áp 3 lớp
 * phạm vi + ép sàn đại lý + phân trang ở máy chủ. Mỗi dòng giữ đúng dạng cũ của từng nguồn.
 */
export const phieuHoanGetList = async (payload: any = {}) => {
  const pageIndex = Number(payload.PageIndex) || 1;
  const pageSize = Number(payload.PageSize) || 50;
  const daHoan =
    payload.MaDA != null && payload.MaDA !== ""
      ? await resolveProjectId(payload.MaDA)
      : null;
  const sanHoan = await resolveSanId(payload.MaSan);
  const { data, error } = await supabase.rpc("fn_booking_refund_list" as any, {
    p: {
      project_id: daHoan,
      san_id: sanHoan,
      search: str(payload.InputSearch),
      tu_ngay: payload.TuNgay || null,
      den_ngay: payload.DenNgay || null,
      deleted: !!payload.Deleted,
      page: pageIndex,
      size: pageSize,
      company_ids: cleanCompanyIds(payload.CompanyIds),
    },
  } as any);
  if (error) return fail(error.message);

  const all = (((data as any)?.rows as any[]) || []);
  const rows = all.filter((r) => r?.__src !== "BOOKING");
  const bookingIds = rows.map((r) => r.booking_id).filter(Boolean);
  const views: Record<string, any> = {};
  if (bookingIds.length) {
    const { data: bs } = await supabase
      .from(TBL)
      .select("*")
      .in("id", bookingIds);
    const bookings = (bs as any[]) || [];
    const refs = await loadRefs(bookings);
    bookings.forEach((b) => (views[b.id] = listOut(b, refs)));
  }
  const total = Number((data as any)?.total) || 0;
  const namesList = await withCreatorNames(rows);
  return ok(
    all.map((r) =>
      r?.__src === "BOOKING"
        ? { ...mapBookingRefundRow(r), TotalRow: total }
        : {
            ...refundOut(r, views[r.booking_id], namesList),
            TotalRow: total,
          }
    ),
    { totalCount: total }
  );
};

/**
 * Đổi trạng thái phiếu hoàn — `fn_booking_refund_voucher_change_state`: phiếu + trạng thái booking (và gỡ `ma_phieu_hoan` khi
 * từ chối / hủy) trong MỘT giao dịch; booking ngoài phạm vi ⇒ lỗi, phiếu không đổi.
 */
export const phieuHoanChangeState = async (payload: any) => {
  const seq = Number(payload?.MaPhieuHoan ?? payload?.ID);
  const state = payload?.State;
  const { data: voucher } = await supabase
    .from("cloud_booking_refund_vouchers" as any)
    .select("*")
    .eq("ma_ctdk", tenantUid())
    .eq("seq", seq)
    .maybeSingle();
  if (!voucher) return fail("Không tìm thấy phiếu hoàn");
  const v: any = voucher;

  let bookingState: string | null = null;
  if (v.booking_id) {
    const waitingRefund = await stateFor("REFUND_CREATE", "WAITING_REFUND");
    const map: Record<string, string> = {
      APPROVED: await stateFor("REFUND_APPROVE", "REFUND_APPROVED"),
      REFUNDED: await stateFor("REFUND_PAYOUT", "REFUNDED"),
      REJECTED: await stateFor("APPROVE", "APPROVED"),
      CANCELED: await stateFor("APPROVE", "APPROVED"),
      UNAPPROVED: waitingRefund,
      PENDING: waitingRefund,
    };
    bookingState = map[state] ?? null;
  }
  const { data: changed, error } = await supabase.rpc(
    "fn_booking_refund_voucher_change_state" as any,
    { p_voucher_id: v.id, p_state: state, p_booking_state: bookingState } as any
  );
  if (error) return fail(error.message);
  const stateFrom = (changed as any)?.state_from ?? v.state;
  const nextState = (changed as any)?.state_to ?? (state === "UNAPPROVED" ? "PENDING" : state);

  if (v.booking_id)
    await writeLog(v.booking_id, "REFUND_STATE", `Phiếu hoàn: ${state}`);
  await writeAudit({
    module: "REFUND",
    action:
      state === "APPROVED"
        ? "APPROVE"
        : state === "REJECTED"
        ? "REJECT"
        : state === "UNAPPROVED"
        ? "UNAPPROVE"
        : state === "CANCELED"
        ? "CANCEL"
        : "STATE",
    entityId: v.seq,
    entityCode: v.so_phieu,
    entityName: v.ten_kh,
    maDA: v.da_project_id,
    reason: payload?.GhiChu ?? payload?.LyDo ?? null,
    stateFrom,
    stateTo: nextState,
    changes: [
      { field: "state", label: "Trạng thái", from: stateFrom, to: nextState },
    ],
  });
  return ok(true);
};

/** Xoá mềm phiếu hoàn — `fn_booking_refund_voucher_delete`: trả booking về "Đã duyệt" + xoá mềm phiếu trong 1 giao dịch. */
export const phieuHoanDelete = async (id: number) => {
  const { data: voucher } = await supabase
    .from("cloud_booking_refund_vouchers" as any)
    .select("*")
    .eq("ma_ctdk", tenantUid())
    .eq("seq", Number(id))
    .maybeSingle();
  if (!voucher) return fail("Không tìm thấy phiếu hoàn");
  const v: any = voucher;
  const { data: deleted, error } = await supabase.rpc("fn_booking_refund_voucher_delete" as any, {
    p_voucher_id: v.id,
    p_booking_state: await stateFor("APPROVE", "APPROVED"),
  } as any);
  if (error) return fail(error.message);
  await writeAudit({
    module: "REFUND",
    action: "DELETE",
    entityId: v.seq,
    entityCode: v.so_phieu,
    entityName: v.ten_kh,
    maDA: v.da_project_id,
    stateFrom: (deleted as any)?.state_from ?? v.state,
    snapshot: v,
  });
  return ok(true);
};

/**
 * Khôi phục phiếu hoàn đã xoá. Máy chủ (trigger `trg_zz_refund_one_active`, migration 20261016000500) chặn khi booking
 * đã có phiếu hoàn khác còn hiệu lực ⇒ lỗi 23505 trả nguyên thông điệp; 0 dòng (ngoài phạm vi / không còn) ⇒ báo lỗi.
 */
export const phieuHoanRestore = async (id: number) => {
  const { data, error } = await supabase
    .from("cloud_booking_refund_vouchers" as any)
    .update({ deleted_at: null, deleted_by_id: null } as any)
    .eq("ma_ctdk", tenantUid())
    .eq("seq", Number(id))
    .select("id");
  if (error) return fail(error.message);
  if (!Array.isArray(data) || data.length === 0) {
    return fail("Không khôi phục được phiếu hoàn (ngoài phạm vi của bạn hoặc không còn tồn tại)");
  }
  return ok(true);
};

void resolveProjectId;
void resolveSanId;
void tenantUid;
void uid;
