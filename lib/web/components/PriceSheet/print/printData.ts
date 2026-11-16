// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/PriceSheet/print/printData.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
/* eslint-disable @typescript-eslint/no-explicit-any -- nhận state chưa có kiểu của PriceSheetForm */
/**
 * Dữ liệu in phiếu tính giá — chụp lúc bấm "Lưu phiếu tính giá", đúng con số đang hiện trên form.
 *
 * Mẫu in chỉ đọc khối này (snapshot.printData), KHÔNG tính lại: số tiền đã làm tròn giống hệt
 * `Format_Currency` (panel "Sản phẩm sau CSBH", lịch thanh toán) và `Math.round` (bảng chiết khấu),
 * ngày đến hạn giống ô ngày trong tab Lịch thanh toán.
 */
import dayjs from "dayjs";
import {
  enabledRoundsWithResults,
  hasOptionalScheduleAmount,
  scheduleBaseKind,
  scheduleDueDates,
} from "../../Products/ContractForm/helpers";
import { giaoDichKey, type GiaoDichKey } from "../../../lib/tdttGiaoDich";

/** 2: lịch có thời hạn / loại ngày / giao dịch / tiền cọc / vốn tự có / vay NH của đợt; thêm tên mẫu tiến độ + chương trình HTLS */
export const PRINT_DATA_VERSION = 2;

export interface PrintDiscount {
  /** khoá dòng chiết khấu trên form (ID vòng cấu hình) */
  key: string | null;
  /** mã chiết khấu của chi tiết CSBH */
  maCK: string | number | null;
  name: string;
  /** đã làm tròn như cột "Tổng CK" trên form */
  amount: number;
  /** v2 — dòng chính sách "Không trừ vào giá HĐ" (CK = 0, phiếu in hiện tên mức đã chọn thay cho số tiền) */
  khongTruGiaHD?: boolean;
  /** v2 — tên các mức đã tick ở ô "Chi tiết CK" (nối "; ") */
  chiTiet?: string;
}

export interface PrintScheduleRow {
  dot: number | string;
  name: string;
  /**
   * Số tiền thanh toán của đợt = Tương ứng + VAT + PBT của chính đợt (mỗi cột làm tròn như màn hình) — chủ dự án chốt
   * 04/11; không lấy cột "Tổng cộng" vì công thức Tổng cộng của mẫu tiến độ có thể cấu hình khác (vd. cộng dồn đợt trước).
   */
  amount: number;
  /** YYYY-MM-DD — đúng ngày hiển thị trên form; null nếu không có */
  dueDate: string | null;
  /** v2 — thời hạn của đợt (số ngày, hoặc số tháng khi theoThang) — số điền vào câu "Thời hạn thanh toán" */
  soNgay?: number;
  theoThang?: boolean;
  /** v2 — đợt "Đợt liền trước" (Ngày TT = ngày đến hạn đợt ngay trên + thời hạn) */
  lienKe?: boolean;
  /** v2 — đợt bỏ chọn loại ngày (Ngày TT để trống theo mẫu tiến độ) */
  khongLoaiNgay?: boolean;
  /** v2 — Tiền cọc của đợt (cột Tiền cọc tab Lịch thanh toán, làm tròn) */
  tienCoc?: number;
  /** v2 — TT% của đợt */
  tyLeTT?: number;
  /** v2 — giao dịch của đợt (Bàn giao / Sổ đỏ ⇒ mẫu không in ngày dự kiến) */
  giaoDich?: GiaoDichKey | null;
  /** v2 — % Vốn tự có / % Vay NH của đợt (mẫu tiến độ cao tầng) */
  tyLeVonTuCo?: number;
  tyLeVayNH?: number;
  /** v2 — cột "Vốn tự có" trên form (làm tròn); null = ô đang trống (đợt không có công thức) */
  vonTuCo?: number | null;
  /** v2 — cột "Vay NH" trên form (làm tròn); null = ô đang trống */
  vayNH?: number | null;
  /** Mẫu Chuyển nhượng — Loại tiến độ của đợt (HDMB | HDCN | null) */
  loaiTienDo?: string | null;
  /** Mẫu Chuyển nhượng — chữ 2 cột diễn giải của mẫu tiến độ, in đúng vào cột Tỷ lệ / Thời hạn */
  dienGiaiTyLeTT?: string;
  dienGiaiThoiHanTT?: string;
}

export interface PriceSheetPrintData {
  version: number;
  /** Ngày tính (YYYY-MM-DD) */
  ngayTinh: string | null;
  customer: {
    isBusiness: boolean;
    name: string;
    idNumber: string;
    address: string;
    phone: string;
  };
  apartment: {
    projectName: string;
    code: string;
    tower: string;
    floor: string;
    area: number;
    bedrooms: string;
    handoverStandard: string;
  };
  promotions: { name: string; amount: number }[];
  discounts: PrintDiscount[];
  totals: {
    /** Chưa VAT (sau CK) */
    chuaVAT: number;
    vat: number;
    /** Gồm VAT (sau CK) — chưa KPBT */
    gomVAT: number;
    /** Phí / kinh phí bảo trì (sau CK) */
    kpbt: number;
    /** Tổng (sau CK) — gồm VAT + KPBT */
    tongHD: number;
  };
  schedule: PrintScheduleRow[];
  /** Dòng "Tổng" cột Tổng cộng của tab Lịch thanh toán (làm tròn tổng chưa làm tròn) */
  scheduleTotal: number;
  /** v2 — tên mẫu tiến độ thanh toán của phiếu */
  scheduleName?: string;
  /** v2 — ô "Chương trình HTLS" của phiếu (VD "24 tháng") */
  htlsProgram?: string;
}

/** Làm tròn đúng như `Format_Currency` (parseFloat(...).toFixed(0)). */
export const screenRound = (v: unknown): number => {
  const n = Number.parseFloat(String(v ?? ""));
  if (!Number.isFinite(n)) return 0;
  const r = Number(n.toFixed(0));
  return Object.is(r, -0) ? 0 : r;
};

/** Làm tròn đúng như cột "Tổng CK" của bảng chiết khấu (Math.round). */
export const tableRound = (v: unknown): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const r = Math.round(n);
  return Object.is(r, -0) ? 0 : r;
};

const str = (v: unknown) => (v == null ? "" : String(v).trim());

/** Ngày đến hạn đúng như ô ngày của tab Lịch thanh toán. */
export function scheduleDueDate(row: any, ngayKy: unknown): string | null {
  if (row?.ngayTT) {
    const d = dayjs(row.ngayTT);
    return d.isValid() ? d.format("YYYY-MM-DD") : null;
  }
  if (!ngayKy) return null;
  const base = dayjs(ngayKy as any);
  if (!base.isValid()) return null;
  const unit = row?.theoThang || Number(row?.maLoaiNgay) === 2 ? "month" : "day";
  return base.add(Number(row?.soNgay) || 0, unit).format("YYYY-MM-DD");
}

/** Mã căn dạng "C4-0808" ⇒ tòa "C4", tầng "08". */
export function parseApartmentCode(code: string): { tower: string; floor: string } | null {
  const m = /^\s*([^-\s]+)\s*-\s*(\d{2})(\d{2,})\s*$/.exec(code || "");
  return m ? { tower: m[1], floor: m[2] } : null;
}

/** Số phòng ngủ ⇒ "1 PN" (giữ nguyên nếu dữ liệu đã là chữ, vd. "Studio"). */
export function formatBedrooms(v: unknown): string {
  const s = str(v);
  if (!s) return "";
  if (/^\d+$/.test(s)) return `${Number(s)} PN`;
  const m = /^(\d+)\s*PN$/i.exec(s);
  return m ? `${Number(m[1])} PN` : s;
}

export interface BuildPrintDataInput {
  formData: any;
  product: any;
  calculations: any;
  policyRounds: any[];
  paymentSchedule: any[];
  /** Ngày TT đang hiện trên form theo thứ tự dòng (dueDatesOf của form) — thiếu ⇒ tính như form */
  dueDates?: (string | null)[];
  selectedPromotion: any[];
  handoverStandard: string;
  htlsProgram?: string;
  scheduleName?: string;
}

const dayOf = (v: unknown) => (v && dayjs(v as any).isValid() ? dayjs(v as any).format("YYYY-MM-DD") : null);

/**
 * Dòng tab Lịch thanh toán (form đang mở, hoặc khôi phục từ lịch đã lưu của phiếu bằng restoreScheduleFromRes)
 * ⇒ dòng in. `dues` = Ngày TT từng dòng đúng như ô ngày của form.
 */
/**
 * TT% của đợt để in: mẫu tiến độ vay ngân hàng thường để trống TT% (0) và chỉ nhập Vốn tự có% / Vay NH% ⇒ hiểu
 * TT% = Vốn tự có% + Vay NH% (chủ dự án chốt 04/11). Có nhập TT% thì dùng đúng TT%.
 */
export const effectiveTyLeTT = (row: any): number =>
  Number(row?.tyLeTT) || (Number(row?.tyLeVonTuCo) || 0) + (Number(row?.tyLeVayNH) || 0);

export function toPrintSchedule(rows: any[], dues: (string | null)[]): PrintScheduleRow[] {
  return (rows || []).map((row: any, i: number) => ({
    dot: row?.dot ?? i + 1,
    name: str(row?.kieuThanhToan) || `Đợt ${i + 1}`,
    amount: screenRound(row?.soTien) + screenRound(row?.tienVAT) + screenRound(row?.tienBaoTri),
    dueDate: dayOf(dues[i]),
    soNgay: Number(row?.soNgay) || 0,
    theoThang: !!row?.theoThang || Number(row?.maLoaiNgay) === 2,
    lienKe: scheduleBaseKind(row?.maLoaiNgay, "") === "dot_truoc",
    khongLoaiNgay: scheduleBaseKind(row?.maLoaiNgay, "") === "none",
    tienCoc: screenRound(row?.tienCoc),
    tyLeTT: effectiveTyLeTT(row),
    giaoDich: giaoDichKey(row?.giaoDich),
    tyLeVonTuCo: Number(row?.tyLeVonTuCo) || 0,
    tyLeVayNH: Number(row?.tyLeVayNH) || 0,
    // Ô Vốn tự có / Vay NH trên form để trống khi đợt không có công thức và bằng 0
    vonTuCo: hasOptionalScheduleAmount(row?.vonTuCo, row?.vonTuCoFormula) ? screenRound(row?.vonTuCo) : null,
    vayNH: hasOptionalScheduleAmount(row?.vayNH, row?.vayNHFormula) ? screenRound(row?.vayNH) : null,
    loaiTienDo: row?.loaiTienDo ?? null,
    dienGiaiTyLeTT: str(row?.dienGiaiTyLeTT),
    dienGiaiThoiHanTT: str(row?.dienGiaiThoiHanTT),
  }));
}

export function buildPriceSheetPrintData(input: BuildPrintDataInput): PriceSheetPrintData {
  const fd = input.formData || {};
  const product = input.product || {};
  const calc = input.calculations || {};
  const isBusiness = fd.customerType === "business";

  const code = str(product.KyHieu || fd.maSanPham);
  const parsed = parseApartmentCode(code);

  const rows: any[] = input.paymentSchedule || [];
  // Ngày đang hiện trên form; không truyền ⇒ tính như form: Ngày tính + thời hạn, "Đợt liền trước" theo đợt trên
  const dues =
    input.dueDates ??
    scheduleDueDates(rows, (r: any) => {
      if (!fd.ngayKy || !dayjs(fd.ngayKy).isValid()) return null;
      const unit = r?.theoThang || Number(r?.maLoaiNgay) === 2 ? "month" : "day";
      return dayjs(fd.ngayKy).add(Number(r?.soNgay) || 0, unit).format("YYYY-MM-DDT00:00:00") + "+07:00";
    });
  const schedule = toPrintSchedule(rows, dues);

  return {
    version: PRINT_DATA_VERSION,
    ngayTinh: fd.ngayKy && dayjs(fd.ngayKy).isValid() ? dayjs(fd.ngayKy).format("YYYY-MM-DD") : null,
    customer: isBusiness
      ? {
          isBusiness: true,
          name: str(fd.TenCongTy || fd.TenKH),
          idNumber: str(fd.MaSoThueCT),
          address: str(fd.DiaChiCT || fd.DiaChi),
          phone: str(fd.DienThoaiCT || fd.DiDong),
        }
      : {
          isBusiness: false,
          name: str(fd.TenKH),
          idNumber: str(fd.SoCMND),
          address: str(fd.ThuongTru || fd.DiaChi),
          phone: str(fd.DiDong),
        },
    apartment: {
      projectName: str(fd.duAn || product.TenDA || product.project_name),
      code,
      tower: parsed?.tower ?? str(product.TenPK || product.TenKhu),
      floor: parsed?.floor ?? str(product.TenTang ?? product.Tang),
      area: Number(fd.dienTichThongThuy) || Number(product.DienTichThongThuy) || 0,
      bedrooms: formatBedrooms(product.SoPN ?? product.TenLoaiPN),
      handoverStandard: str(input.handoverStandard),
    },
    promotions: (input.selectedPromotion || []).map((g: any) => ({
      name: str(g?.TenQuaTang),
      amount: screenRound(g?.GiaTri),
    })),
    discounts: enabledRoundsWithResults(input.policyRounds || [], calc.roundResults).map(
      ({ round, result }, i) => ({
        key: round?.key != null ? String(round.key) : null,
        maCK: (round as any)?.maCK ?? null,
        name: str((round as any)?.name) || `Chiết khấu ${i + 1}`,
        amount: tableRound(result?.tongCK ?? 0),
        khongTruGiaHD: !!(round as any)?.khongTruGiaHD,
        chiTiet: ((round as any)?.luaChonDaChon || [])
          .map((p: any) => str(p?.Ten))
          .filter(Boolean)
          .join("; "),
      })
    ),
    totals: {
      chuaVAT: screenRound(calc.giaTriSauCK ?? calc.tongChuaVAT),
      vat: screenRound(calc.tienVAT),
      gomVAT: screenRound(calc.tongGomVAT ?? 0),
      kpbt: screenRound(calc.phiBaoTri),
      tongHD: screenRound(calc.tongGiaTriHD),
    },
    schedule,
    scheduleTotal: screenRound(
      (input.paymentSchedule || []).reduce((s: number, r: any) => s + (Number(r?.tongGiaTri) || 0), 0)
    ),
    scheduleName: str(input.scheduleName),
    htlsProgram: str(input.htlsProgram),
  };
}
