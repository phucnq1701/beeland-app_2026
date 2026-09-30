/**
 * Trạng thái căn theo MÃ danh mục bds_trang_thai + áp sự kiện realtime (SignalR "ChangeTable").
 * Bảng mã → nhóm lấy theo đặc tả nghiệp vụ web (src/services/ProductTransactionStatus.ts).
 * Chỉ import hàm thuần để test nạp được.
 */
import { groupFromCode, groupFromName, WebGroup } from './productStatus';

/** Một dòng danh mục như FilterService.getStatusSP trả về. */
export type CatalogStatus = { MaTT: string; TenTT: string; ColorWeb?: string | null; _raw?: { item_code?: string } };

/** Tìm trạng thái theo uuid (MaTT) hoặc theo mã số cũ (item_code) – API realtime cũ có thể gửi mã số. */
export function resolveCatalogStatus(value: unknown, catalog: CatalogStatus[]): CatalogStatus | null {
  if (value === null || value === undefined || value === '') return null;
  const v = String(value).trim();
  return (
    catalog.find((c) => String(c.MaTT) === v) ??
    catalog.find((c) => String(c._raw?.item_code ?? '') === v) ??
    null
  );
}

/**
 * Nhóm trạng thái của một căn: ưu tiên theo MÃ danh mục (bảng nghiệp vụ web), không có mã
 * thì theo tên; không rõ → "Khóa" (không bao giờ mặc định "Mở bán").
 */
export function unitStatusOf(item: { MaTT?: unknown; TenTT?: unknown }, catalog: CatalogStatus[]): WebGroup {
  const entry = resolveCatalogStatus(item?.MaTT, catalog);
  return groupFromCode(entry?._raw?.item_code) ?? groupFromName(entry?.TenTT ?? item?.TenTT);
}

/**
 * Áp sự kiện realtime vào dữ liệu lưới: cập nhật mã, TÊN và MÀU của đúng 1 căn
 * (trước đây chỉ đổi MaTT/MauNen nên Tổng quan – tính theo tên – và ô lưới – ưu tiên ColorTT – không đổi).
 * Giữ nguyên tham chiếu các khu/tầng/căn không đổi để memo có tác dụng.
 */
export function applyRealtimeChange(
  dataGrid: any[],
  response: any,
  catalog: CatalogStatus[]
): { grid: any[]; changedMaSP: string | null } {
  const target = response?.data ?? {};
  const entry = resolveCatalogStatus(response?.maTT, catalog);
  let changedMaSP: string | null = null;

  const grid = dataGrid.map((block) => {
    if (block?.rawBlock?.maKhu !== target.MaKhu) return block;
    let changed = false;
    const floors = (block.rawBlock.floor || []).map((floor: any) => {
      if (String(floor.maTang) !== String(target.MaTang)) return floor;
      const details = (floor.detailFloor || []).map((item: any) => {
        if (String(item.MaVT) !== String(target.MaVT)) return item;
        changed = true;
        changedMaSP = item.MaSP ?? null;
        const color = entry?.ColorWeb || null;
        return {
          ...item,
          MaTT: entry?.MaTT ?? response?.maTT,
          // Web tô ô theo MauNen trước → gán màu danh mục của trạng thái MỚI (không còn màu cũ)
          MauNen: color ?? response?.mauNen ?? item.MauNen,
          TenTT: entry?.TenTT ?? item.TenTT,
          // Màu danh mục của trạng thái mới; không có thì bỏ ColorTT để ô dùng MauNen mới
          ColorTT: color ?? '',
        };
      });
      return { ...floor, detailFloor: details };
    });
    return changed ? { ...block, rawBlock: { ...block.rawBlock, floor: floors } } : block;
  });

  return { grid, changedMaSP };
}

export { compareUnitCode } from './productOverview';
