/**
 * Dữ liệu chế độ "Tổng quan" của màn Sản phẩm (tách từ app/products.tsx, giữ nguyên logic).
 * Chỉ import hàm thuần để test nạp được.
 */
import { foldVietnamese, formatNumberVN } from './format';
import type { UnitStatus } from './productStatus';

/**
 * MaTT là uuid → nhận diện trạng thái theo TÊN (TenTT) từ danh mục.
 * So khớp sau khi bỏ dấu (foldVietnamese) để "HĐMB", "hđmb", "HDMB", "da ban"… đều nhận đúng.
 * Thứ tự quan trọng:
 *  1. Tên có "huỷ" không bao giờ là đã bán (vd "Hủy HĐMB").
 *  2. Từ khoá bán rõ ràng (đã bán, bàn giao, sổ đỏ, góp vốn, thanh lý) → đã bán.
 *  3. "đặt cọc"/"cọc" → đã cọc (kể cả "Đặt cọc – chờ ký HĐMB").
 *  4. HĐMB / hợp đồng mua bán / HĐ MB → đã bán.
 */
const SOLD_WORDS = [/\bda ban\b/, /\bban giao\b/, /\bso do\b/, /\bgop von\b/, /\bthanh ly\b/];
const CONTRACT_WORDS = [/hdmb/, /\bhop dong mua ban\b/, /\bhd\s*(mb|mua ban)\b/];

export function unitStatusFromName(name: unknown): UnitStatus {
  const t = foldVietnamese(String(name || ''));
  const cancelled = /\bhuy\b/.test(t);
  if (!cancelled && SOLD_WORDS.some((re) => re.test(t))) return 'sold';
  if (t.includes('dat coc') || /\bcoc\b/.test(t)) return 'deposit';
  if (!cancelled && CONTRACT_WORDS.some((re) => re.test(t))) return 'sold';
  if (t.includes('booking')) return 'booking';
  if (t.includes('giu cho') || t.includes('lock')) return 'locked';
  return 'available';
}

/** So sánh mã căn tự nhiên: tách số và chữ, "A-2" < "A-10", "A-2" < "A-02-a". */
export function compareUnitCode(a: unknown, b: unknown): number {
  const pa = String(a ?? '').match(/\d+|\D+/g) ?? [];
  const pb = String(b ?? '').match(/\d+|\D+/g) ?? [];
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    const x = pa[i];
    const y = pb[i];
    const nx = /^\d/.test(x);
    const ny = /^\d/.test(y);
    if (nx && ny) {
      const d = Number(x) - Number(y);
      if (d !== 0) return d;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return pa.length - pb.length;
}

export type OverviewUnit = { id: string; code: string; price: string; status: UnitStatus; column: string };
export type OverviewFloor = { id: string; name: string; floorNumber: number; units: OverviewUnit[]; totalUnits: number };

/**
 * Gom căn theo khu + tầng (giữ thứ tự tầng của dữ liệu – đã sắp theo danh mục tầng),
 * trong tầng sắp theo số căn tự nhiên; giá hiển thị dạng "2.500.000.000".
 * `statusOf` cho phép nhận trạng thái theo MÃ danh mục (mặc định: theo tên TenTT).
 */
export function buildOverviewFloors(
  dataGrid: unknown[],
  statusOf: (item: any) => UnitStatus = (item) => unitStatusFromName(item?.TenTT)
): OverviewFloor[] {
  const floorsMap: Record<string, OverviewFloor> = {};
  (Array.isArray(dataGrid) ? dataGrid : []).forEach((block: any) => {
    const raw = block?.rawBlock;
    (raw?.floor || []).forEach((floor: any) => {
      const key = `${raw.maKhu}_${floor.maTang}`;
      if (!floorsMap[key]) {
        floorsMap[key] = { id: key, name: floor.tenTang, floorNumber: Number(floor.maTang), units: [], totalUnits: 0 };
      }
      const units: OverviewUnit[] = (floor.detailFloor || []).map((item: any) => ({
        id: item.MaSP,
        code: item.KyHieu,
        price: item.GiaBan ? formatNumberVN(item.GiaBan) : '',
        status: statusOf(item),
        column: String(item.MaVT),
      }));
      floorsMap[key].units.push(...units);
    });
  });
  return Object.values(floorsMap).map((f) => {
    f.units.sort((a, b) => compareUnitCode(a.code, b.code));
    f.totalUnits = f.units.length;
    return f;
  });
}

export type SummaryKey = 'all' | 'available' | 'deposit' | 'locked' | 'sold' | 'booking';

/** Số căn theo trạng thái (thứ tự như bản cũ). */
export function overviewSummary(floors: OverviewFloor[]): { key: SummaryKey; label: string; count: number }[] {
  const all = floors.flatMap((f) => f.units);
  const count = (s: UnitStatus) => all.filter((u) => u.status === s).length;
  return [
    { key: 'all', label: 'Tổng', count: all.length },
    { key: 'available', label: 'Trống', count: count('available') },
    { key: 'deposit', label: 'Đã cọc', count: count('deposit') },
    { key: 'locked', label: 'Khoá', count: count('locked') },
    { key: 'sold', label: 'Đã bán', count: count('sold') },
    { key: 'booking', label: 'Booking', count: count('booking') },
  ];
}
