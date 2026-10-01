/**
 * Tính tiền tiến độ thanh toán – CHÉP TỪ WEB (web là chuẩn):
 *  - allocatePaidToSchedule: beeland/src/pages/Contracts/form/ContractDetail.tsx
 *  - mapScheduleRpcRow:      beeland/src/services/ContractScheduleService.ts (fn_contract_payment_schedule)
 *  - pgcVoucherTotal:        beeland/src/components/Sales/PgcCashVouchersTab.tsx (cộng so_tien_pgc)
 *  - sumReceiptLines:        beeland/src/services/AccountingCloudService.ts (sumReceiptsByPgc – phần cộng)
 *  - buildInstallments:      AccountingCloudService.listInstallmentsFromLifecycle (bỏ tiền lãi – app không hiển thị)
 *  - agingOf / toProgressRow: beeland/src/pages/Reports/DebtProgressReport.tsx
 * tests/payment-math.test.cjs so trực tiếp allocatePaidToSchedule + agingOf với code web.
 * Không import gì để test nạp trực tiếp được.
 */

const n = (v: any) => Number(v || 0) || 0;

/* ---------------- Lịch thanh toán của 1 phiếu ---------------- */

export type ScheduleRow = {
  DotTT: number;
  DotTTText: string;
  NgayTT: string | null;
  TyLeTT: number;
  PhaiThu: number;
  DaThu: number;
  ConLai: number;
  PhaiThuPBT: number;
  PhiBT: number;
  DaThuPBT: number;
  ConNoPBT: number;
  DienGiai: string;
};

/** Một dòng fn_contract_payment_schedule → dòng lịch (đã có Đã thu / Còn lại từng đợt). */
export function mapScheduleRpcRow(r: any): ScheduleRow {
  return {
    DotTT: n(r?.dot_tt),
    DotTTText: r?.dot_tt_text || `Đợt ${n(r?.dot_tt)}`,
    NgayTT: r?.ngay_tt ?? null,
    TyLeTT: n(r?.ty_le_tt),
    PhaiThu: n(r?.phai_thu),
    DaThu: n(r?.da_thu),
    ConLai: n(r?.con_lai),
    PhaiThuPBT: n(r?.phai_thu_pbt),
    PhiBT: n(r?.phai_thu_pbt),
    DaThuPBT: n(r?.da_thu_pbt),
    ConNoPBT: n(r?.con_lai_pbt),
    DienGiai: r?.dien_giai || '',
  };
}

/**
 * Phân bổ tổng đã thu vào từng đợt (dự phòng khi hàm máy chủ chưa có lịch): hết "Phải thu" đợt 1
 * mới sang đợt 2…; hết phần gốc mới phân bổ tiếp "Phải thu PBT". Y hệt web.
 */
export function allocatePaidToSchedule(rows: any[], totalPaid: any) {
  const list = Array.isArray(rows) ? [...rows] : [];
  if (!list.length) return list;

  const byOrder = list
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const da = Number(a.r?.DotTT ?? a.r?.Dot ?? a.i + 1);
      const db = Number(b.r?.DotTT ?? b.r?.Dot ?? b.i + 1);
      if (da !== db) return da - db;
      return a.i - b.i;
    });

  let remain = Math.max(0, Math.round(Number(totalPaid) || 0));
  const result = list.map((r) => ({ ...r, DaThu: 0, DaThuPBT: 0 }));

  byOrder.forEach(({ i }) => {
    const need = Math.max(0, Math.round(Number(list[i]?.PhaiThu) || 0));
    const pay = Math.min(remain, need);
    result[i].DaThu = pay;
    remain -= pay;
  });

  byOrder.forEach(({ i }) => {
    const need = Math.max(0, Math.round(Number(list[i]?.PhaiThuPBT) || 0));
    const pay = Math.min(remain, need);
    result[i].DaThuPBT = pay;
    remain -= pay;
  });

  return result;
}

/** Tổng đã thu của 1 phiếu = cộng phần thuộc phiếu đó (so_tien_pgc) của các phiếu thu. */
export function pgcVoucherTotal(rows: any[]): number {
  return (rows || []).reduce((s, r) => s + (Number(r?.so_tien_pgc) || 0), 0);
}

/* ---------------- Đã thu theo phiếu (báo cáo tiến độ) ---------------- */

const fold = (s: string) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Loại phiếu thu là phí bảo trì (web: tên loại khớp /bao tri|pbt/). */
export const isPbtLoaiName = (name: unknown) => /bao tri|pbt/.test(fold(String(name ?? '')));

export type PaidSum = { daThu: number; daThuPBT: number };

/**
 * Cộng dòng chi tiết phiếu thu theo phiếu: khoá = uuid dòng, uuid phiếu giữ chỗ gốc (alias từ
 * hợp đồng/cọc), số chứng từ của cả hai. Loại "phí bảo trì" cộng riêng.
 */
export function sumReceiptLines(
  lines: { pgc_id?: any; ma_loai?: any; so_tien?: any }[],
  ctx: { alias: Record<string, string>; code: Record<string, string>; pbtLoai: Set<string> }
): Map<string, PaidSum> {
  const map = new Map<string, PaidSum>();
  (lines || []).forEach((d) => {
    const id = d?.pgc_id ? String(d.pgc_id) : '';
    if (!id) return;
    const money = Math.round(Number(d?.so_tien) || 0);
    if (!money) return;
    const pbt = d?.ma_loai ? ctx.pbtLoai.has(String(d.ma_loai)) : false;
    const alias = ctx.alias[id] || '';
    const keys = [id, alias, ctx.code[id] || '', ctx.code[alias] || ''];
    [...new Set(keys.filter(Boolean))].forEach((key) => {
      const cur = map.get(key) || { daThu: 0, daThuPBT: 0 };
      if (pbt) cur.daThuPBT += money;
      else cur.daThu += money;
      map.set(key, cur);
    });
  });
  return map;
}

/** Phiếu đã huỷ / thanh lý / từ chối không tính công nợ (web isDropped). */
export const isDroppedStatus = (tt: string) => /hủy|huy|thanh lý|thanh ly|từ chối|tu choi/i.test(tt || '');

/* ---------------- Tiến độ theo đợt ---------------- */

const DAY = 86400000;
const vnStart = (ymd: string) => new Date(`${ymd}T00:00:00.000+07:00`).getTime();
const vnEnd = (ymd: string) => new Date(`${ymd}T23:59:59.999+07:00`).getTime();

/** Số ngày quá hạn của 1 đợt (web calcOverdue – phần số ngày): còn nợ > 0 và đã qua ngày đến hạn. */
function overdueDays(dueDate: any, conNo: number, now: number): number {
  if (!dueDate || !(conNo > 0)) return 0;
  const due = new Date(dueDate).getTime();
  if (!Number.isFinite(due)) return 0;
  const days = Math.floor((now - due) / DAY);
  return days > 0 ? days : 0;
}

/**
 * Dòng tiến độ từng đợt dựng từ các phiếu (đã thu phân bổ luỹ tiến theo đợt, phí bảo trì riêng).
 * from/to (YYYY-MM-DD, giờ VN) lọc theo ngày thanh toán của đợt. Sắp theo ngày thanh toán tăng dần.
 */
export function buildInstallments(parents: any[], opts: { now: number; from?: string | null; to?: string | null }) {
  const from = opts.from ? vnStart(opts.from) : null;
  const to = opts.to ? vnEnd(opts.to) : null;
  const rows: any[] = [];

  (parents || []).forEach((p: any) => {
    const list = Array.isArray(p.LichThanhToan) ? p.LichThanhToan : [];
    if (!list.length) return;
    const sorted = [...list].sort((a: any, b: any) => (Number(a?.DotTT) || 0) - (Number(b?.DotTT) || 0));
    let remainPaid = Math.round(Number(p.DaThu) || 0);
    let remainPBT = Math.round(Number(p.DaThuPBT) || 0);

    sorted.forEach((it: any, idx: number) => {
      const soTien = Math.round(Number(it?.SoTien) || 0);
      const phiBT = Math.round(Number(it?.PhiBT) || 0);
      const daThu = Math.min(remainPaid, soTien);
      remainPaid -= daThu;
      const daThuPBT = Math.min(remainPBT, phiBT);
      remainPBT -= daThuPBT;

      const ngayTT = it?.NgayTT || it?.NgayDenHan || null;
      if (ngayTT) {
        const t = new Date(ngayTT).getTime();
        if (from && t < from) return;
        if (to && t > to) return;
      }

      const conNo = Math.max(soTien - daThu, 0);
      const conNoPBT = Math.max(phiBT - daThuPBT, 0);
      rows.push({
        ...p,
        key: `${p.MaPGC}-${it?.DotTT ?? idx}`,
        DotTT: it?.DotTT ?? idx + 1,
        DotTTText: it?.DotTTText || `Đợt ${idx + 1}`,
        NgayTT: ngayTT,
        NgayGiaHan: it?.NgayGiaHan || null,
        SoTien: soTien,
        DaThu: daThu,
        ConNo: conNo,
        PhiBT: phiBT,
        DaThuPBT: daThuPBT,
        ConNoPBT: conNoPBT,
        SoNgayQuaHan: overdueDays(it?.NgayGiaHan || ngayTT, conNo + conNoPBT, opts.now),
        LichThanhToan: undefined,
      });
    });
  });

  return rows.sort((a, b) => {
    const ta = a.NgayTT ? new Date(a.NgayTT).getTime() : 0;
    const tb = b.NgayTT ? new Date(b.NgayTT).getTime() : 0;
    return ta - tb;
  });
}

export type ProgressRow = {
  key: string;
  maPGC: string | null;
  tenDA: string;
  kyHieu: string;
  soHD: string;
  hoTenKH: string;
  dotTT: string;
  ngayDenHan: string | null;
  phaiThu: number;
  daThu: number;
  conLai: number;
  soNgayQuaHan: number;
  trangThai: string;
  /** Thông tin phiếu cha – để mở chi tiết cọc / hợp đồng từ báo cáo. */
  giaiDoan: string;
  tongGiaTri: number;
  /** Đã thu của cả phiếu (DaThu của dòng là phần phân bổ cho đợt). */
  daThuHD: number;
  diDong: string;
};

/** Dòng tiến độ → dòng báo cáo (web DebtProgressReport, nhóm TIENDO). */
export function toProgressRow(r: any, i = 0): ProgressRow {
  return {
    key: String(r.key ?? r.MaCongNo ?? r.ma_cong_no ?? `${r.MaPGC || r.SoHDMB || ''}-${i}`),
    maPGC: r.MaPGC ?? null,
    tenDA: r.TenDA || r.ten_da || '',
    kyHieu: r.KyHieu || r.ky_hieu || '',
    soHD: r.SoHD || r.SoHDMB || r.so_hdmb || r.MaPGC || '',
    hoTenKH: r.HoTenKH || r.ho_ten_kh || '',
    dotTT: r.TenDot || r.DotTTText || (r.DotTT != null ? `Đợt ${r.DotTT}` : '') || r.TenTT || '',
    ngayDenHan: r.NgayGiaHan || r.NgayTT || r.NgayDenHan || r.ngay_den_han || null,
    phaiThu: n(r.SoTien) + n(r.PhiBT),
    daThu: n(r.DaThu) + n(r.DaThuPBT),
    conLai: n(r.ConNo) + n(r.ConNoPBT),
    soNgayQuaHan: n(r.SoNgayQuaHan ?? r.so_ngay_qua_han),
    trangThai: r.TenTT || r.TrangThai || r.trang_thai || '',
    giaiDoan: r.GiaiDoan || '',
    tongGiaTri: n(r.TongGiaTriHD),
    daThuHD: n(r.DaThuHD),
    diDong: r.DiDong || '',
  };
}

export type Aging = 'done' | 'current' | 'd30' | 'd60' | 'd90' | 'd90p';

export const AGING_LABEL: Record<Aging, string> = {
  done: 'Đã tất toán',
  current: 'Trong hạn',
  d30: 'Quá hạn ≤ 30 ngày',
  d60: 'Quá hạn 31 - 60 ngày',
  d90: 'Quá hạn 61 - 90 ngày',
  d90p: 'Quá hạn > 90 ngày',
};

const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
/** Như dayjs(v): "YYYY-MM-DD" là ngày theo giờ máy, không phải UTC. */
const parseLocal = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(v);
};

/** Tình trạng một đợt (web agingOf): đã tất toán / trong hạn / quá hạn theo số ngày. */
export function agingOf(r: { conLai: number; soNgayQuaHan: number; ngayDenHan: string | null }): Aging {
  if (r.conLai <= 0) return 'done';
  const overdue =
    r.soNgayQuaHan > 0
      ? r.soNgayQuaHan
      : r.ngayDenHan
        ? Math.round((startOfLocalDay(new Date()) - startOfLocalDay(parseLocal(r.ngayDenHan))) / DAY)
        : 0;
  if (overdue <= 0) return 'current';
  if (overdue <= 30) return 'd30';
  if (overdue <= 60) return 'd60';
  if (overdue <= 90) return 'd90';
  return 'd90p';
}
