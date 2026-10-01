/**
 * Dữ liệu chế độ "Tổng quan" của màn Sản phẩm (tách từ app/products.tsx, giữ nguyên logic).
 * Chỉ import hàm thuần để test nạp được.
 */
import { formatNumberVN } from './format';
import { GROUP_META, groupFromName, WebGroup } from './productStatus';

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

/**
 * Màu trạng thái lưu trong dữ liệu: chuỗi hex ("#22C55E") hoặc số nguyên ARGB (hệ thống cũ).
 * Không đọc được → null.
 */
export function colorFromData(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.startsWith('#')) return s;
  if (/^-?\d+$/.test(s)) return `#${(Number(s) >>> 0).toString(16).padStart(6, '0').slice(-6)}`;
  return null;
}

export type OverviewUnit = {
  id: string;
  code: string;
  price: string;
  status: WebGroup;
  column: string;
  /** Màu trạng thái như web: MauNen (sản phẩm) → màu danh mục. */
  color: string | null;
  /** Tên trạng thái trong danh mục (nhãn hiển thị như web). */
  statusName: string;
};
export type OverviewFloor = { id: string; name: string; floorNumber: number; units: OverviewUnit[]; totalUnits: number };

/**
 * Gom căn theo khu + tầng (giữ thứ tự tầng của dữ liệu – đã sắp theo danh mục tầng),
 * trong tầng sắp theo số căn tự nhiên; giá hiển thị dạng "2.500.000.000".
 * `statusOf` cho phép nhận trạng thái theo MÃ danh mục (mặc định: theo tên TenTT).
 */
export function buildOverviewFloors(
  dataGrid: unknown[],
  statusOf: (item: any) => WebGroup = (item) => groupFromName(item?.TenTT)
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
        color: colorFromData(item.MauNen) ?? colorFromData(item.ColorTT),
        statusName: String(item.TenTT || ''),
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

export type SummaryKey = 'all' | WebGroup;

/** Số căn theo 4 nhóm của sơ đồ web (+ tổng). */
export function overviewSummary(floors: OverviewFloor[]): { key: SummaryKey; label: string; count: number }[] {
  const all = floors.flatMap((f) => f.units);
  const count = (g: WebGroup) => all.filter((u) => u.status === g).length;
  const groups: WebGroup[] = ['available', 'hold', 'sold', 'blocked'];
  return [
    { key: 'all', label: 'Tổng', count: all.length },
    ...groups.map((g) => ({ key: g, label: GROUP_META[g].label, count: count(g) })),
  ];
}
