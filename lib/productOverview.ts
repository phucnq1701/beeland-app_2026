/**
 * Dữ liệu chế độ "Tổng quan" của màn Sản phẩm (tách từ app/products.tsx, giữ nguyên logic).
 * Chỉ import hàm thuần để test nạp được.
 */
import { foldVietnamese, formatNumberVN } from './format';
import type { UnitStatus } from './productStatus';

/**
 * MaTT là uuid → nhận diện trạng thái theo TÊN (TenTT) từ danh mục.
 * So khớp sau khi bỏ dấu (foldVietnamese) để "HĐMB", "hđmb", "HDMB", "da ban"… đều nhận đúng.
 */
export function unitStatusFromName(name: unknown): UnitStatus {
  const t = foldVietnamese(String(name || ''));
  if (
    t.includes('da ban') ||
    t.includes('hdmb') ||
    t.includes('hop dong mua ban') ||
    t.includes('ban giao') ||
    t.includes('so do') ||
    t.includes('gop von') ||
    t.includes('thanh ly')
  )
    return 'sold';
  if (t.includes('dat coc')) return 'deposit';
  if (t.includes('booking')) return 'booking';
  if (t.includes('giu cho') || t.includes('lock')) return 'locked';
  return 'available';
}

export type OverviewUnit = { id: string; code: string; price: string; status: UnitStatus; column: string };
export type OverviewFloor = { id: string; name: string; floorNumber: number; units: OverviewUnit[]; totalUnits: number };

/** Gom căn theo khu + tầng, sắp theo vị trí (chuỗi), giá hiển thị dạng "2.500.000.000". */
export function buildOverviewFloors(dataGrid: unknown[]): OverviewFloor[] {
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
        status: unitStatusFromName(item?.TenTT),
        column: String(item.MaVT),
      }));
      floorsMap[key].units.push(...units);
    });
  });
  return Object.values(floorsMap).map((f) => {
    f.units.sort((a, b) => String(a.column).localeCompare(String(b.column)));
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
