// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/PriceSheet/usePriceSheetCatalogs.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { useEffect, useState } from "react";
import { memoAsync } from "../../lib/apiCache";
import { sessionCompanyId } from "../../_shims/lib/session";
import { NhanVienService } from "../../_stubs/services/NhanVienService";
import { ProductService } from "../../_shims/services/Product";
import { CustomerService } from "../../_stubs/services/Customer";
import { normalizeSanGiaoDichList } from "../../services/SanGiaoDichCloudService";

/** Danh mục phụ của form phiếu tính giá (nhân viên KD, sàn giao dịch, quỹ danh, ngân hàng) */
export interface PriceSheetCatalogs {
  nhanVien: any[];
  sanGiaoDich: any[];
  quyDanh: any[];
  nganHang: any[];
}

const EMPTY: PriceSheetCatalogs = { nhanVien: [], sanGiaoDich: [], quyDanh: [], nganHang: [] };

/** 4 danh mục nạp song song, nhớ đệm 5 phút theo công ty — mọi form phiếu tính giá trong phiên dùng chung */
export const loadPriceSheetCatalogs = (): Promise<PriceSheetCatalogs> =>
  memoAsync(
    `pricesheet:catalogs:${sessionCompanyId() || ""}`,
    async () => {
      const [nvRes, sanRes, qdRes, nhRes]: any[] = await Promise.all([
        NhanVienService.getList({ InputSearch: "", PageIndex: 1, PageSize: 500 }),
        ProductService.getSanGiaoDichAPI(),
        CustomerService.DanhMuc.getQuyDanhList(),
        CustomerService.getNganHang(),
      ]);
      return {
        nhanVien: nvRes?.data ?? [],
        sanGiaoDich: normalizeSanGiaoDichList(sanRes),
        quyDanh: qdRes?.data ?? [],
        nganHang: nhRes?.data ?? [],
      };
    },
    5 * 60_000
  );

/**
 * Form phiếu tính giá luôn được mount ở 6 màn (Phiếu tính giá, Booking, Đặt cọc, Hợp đồng…) — chỉ nạp danh mục
 * khi form MỞ lần đầu, không nạp lúc mở màn. Đóng form không xoá danh mục (lần mở sau dùng lại).
 */
export function usePriceSheetCatalogs(open: boolean): PriceSheetCatalogs {
  const [catalogs, setCatalogs] = useState<PriceSheetCatalogs>(EMPTY);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    loadPriceSheetCatalogs()
      .then((v) => {
        if (alive) setCatalogs(v);
      })
      .catch((e) => console.error("Không tải được danh mục phiếu tính giá", e));
    return () => {
      alive = false;
    };
  }, [open]);
  return catalogs;
}
