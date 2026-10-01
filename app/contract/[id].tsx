import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";

import { SalesDocDetail } from "@/components/sales/SalesDocDetail";
import { formatArea, formatDate, formatVND } from "@/lib/format";
import { ScheduleRow } from "@/lib/paymentMath";
import { HopDongService } from "@/sevicesSupabase/HopDongService";
import { Receipt } from "@/sevicesSupabase/PaymentProgressService";

/**
 * Chi tiết hợp đồng mua bán – như web ContractDetail: đầu phiếu từ dòng fn_contract_list,
 * lịch thanh toán (fn_contract_payment_schedule) + phiếu thu (fn_cash_vouchers_by_pgc) theo phiếu giữ chỗ.
 * Tab "Tài liệu" cũ hiển thị dữ liệu mẫu (DEMO_DOCUMENTS) → bỏ.
 */
export default function ContractDetailScreen() {
  const { id, data: dataParam } = useLocalSearchParams<{ id: string; data?: string }>();
  const row = useMemo(() => {
    try {
      return dataParam ? JSON.parse(String(dataParam)) : {};
    } catch {
      return {};
    }
  }, [dataParam]);

  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [scheduleError, setScheduleError] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [receiptsTotal, setReceiptsTotal] = useState(0);
  const [receiptsError, setReceiptsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      const key = { PhieuGiuChoId: row.PhieuGiuChoId, MaPGC: row.MaHD ?? row.ID ?? id };
      try {
        const [ltt, lst]: any[] = await Promise.all([HopDongService.getDetailLTT(key), HopDongService.getDetailLST(key)]);
        setSchedule(ltt?.data || []);
        setScheduleError(!!ltt?.error);
        setReceipts(lst?.data || []);
        setReceiptsTotal(Number(lst?.total) || 0);
        setReceiptsError(!!lst?.error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [row, id]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const h = row || {};
  return (
    <SalesDocDetail
      title="Hợp đồng"
      docNo={h.SoHDMB || ""}
      status={h.TenTT}
      statusColor={h.MauNen}
      customer={h.TenKH || ""}
      subtitle={[h.KyHieu, h.TenDA].filter(Boolean).join(" · ")}
      value={h.TongGiaTriHDMB}
      paid={h.DaThu}
      info={[
        ["Ngày ký", h.NgayKy ? formatDate(h.NgayKy) : null],
        ["Số phiếu đặt cọc", h.SoPhieuDatCoc],
        ["Điện thoại", h.DiDong],
        ["Email", h.Email],
        ["CCCD", h.SoCMND],
        ["Diện tích", h.DienTich != null ? formatArea(h.DienTich) : null],
        ["Đơn giá", h.DonGiaTT != null ? formatVND(h.DonGiaTT) : null],
        ["Phí bảo trì", h.PhiBaoTri != null ? formatVND(h.PhiBaoTri) : null],
        ["Sàn giao dịch", h.SanGD],
        ["Nhân viên kinh doanh", h.TenNVKD],
        ["Chính sách", h.TenChinhSach],
        ["Lịch thanh toán", h.TenLichThanhToan],
      ]}
      schedule={schedule}
      scheduleError={scheduleError}
      receipts={receipts}
      receiptsTotal={receiptsTotal}
      receiptsError={receiptsError}
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void load(true)}
    />
  );
}
