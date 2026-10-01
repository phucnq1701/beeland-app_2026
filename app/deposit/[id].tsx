import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";

import { SalesDocDetail } from "@/components/sales/SalesDocDetail";
import { formatArea, formatDate, formatVND } from "@/lib/format";
import { ScheduleRow } from "@/lib/paymentMath";
import { DatCocService } from "@/sevicesSupabase/DatCocService";
import { Receipt } from "@/sevicesSupabase/PaymentProgressService";

/**
 * Chi tiết đặt cọc – như web (ContractDetail type DATCOC): đầu phiếu từ dòng danh sách fn_deposit_list,
 * lịch thanh toán + phiếu thu theo phiếu giữ chỗ (DatCocService.getDepositDetail → PaymentProgressService).
 */
export default function DepositDetailScreen() {
  const { data: dataParam } = useLocalSearchParams<{ id: string; data?: string }>();
  const row = useMemo(() => {
    try {
      return dataParam ? JSON.parse(String(dataParam)) : {};
    } catch {
      return {};
    }
  }, [dataParam]);

  const [header, setHeader] = useState<any>(row);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [receiptsTotal, setReceiptsTotal] = useState(0);
  const [receiptsError, setReceiptsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      try {
        const res: any = await DatCocService.getDepositDetail({ row });
        setHeader({ ...row, ...(res?.data || {}) });
        setSchedule(res?.lichTT || []);
        setReceipts(res?.phieuThu || []);
        setReceiptsTotal(Number(res?.tongDaThu) || 0);
        setReceiptsError(!!res?.receiptsError);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [row]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const h = header || {};
  return (
    <SalesDocDetail
      title="Đặt cọc"
      docNo={h.SoPhieu || ""}
      status={h.TenTT}
      statusColor={h.MauNen}
      customer={h.KhachHang || h.TenKH || ""}
      subtitle={[h.MaSanPham, h.TenDA].filter(Boolean).join(" · ")}
      value={h.TongGiaTriHDMB ?? h.TongGiaGomVAT}
      paid={h.DaThu}
      deposit={h.TienCoc ?? null}
      info={[
        ["Ngày đặt cọc", h.NgayDatCoc ? formatDate(h.NgayDatCoc) : null],
        ["Số phiếu giữ chỗ", h.SoPhieuGC],
        ["Điện thoại", h.DiDong],
        ["Email", h.Email],
        ["CCCD", h.SoCMND],
        ["Địa chỉ", h.DiaChi],
        ["Loại căn", h.LoaiCanHo],
        ["Hướng", h.Huong],
        ["Diện tích", h.DienTich != null ? formatArea(h.DienTich) : null],
        ["Đơn giá", h.DonGiaTT != null ? formatVND(h.DonGiaTT) : null],
        ["Phí bảo trì", h.PhiBaoTri != null ? formatVND(h.PhiBaoTri) : null],
        ["Sàn giao dịch", h.SanGD],
        ["Nhân viên kinh doanh", h.TenNVKD],
        ["Chính sách", h.TenChinhSach],
      ]}
      schedule={schedule}
      receipts={receipts}
      receiptsTotal={receiptsTotal}
      receiptsError={receiptsError}
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void load(true)}
    />
  );
}
