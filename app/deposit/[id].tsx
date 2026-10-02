import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { CalendarCheck, QrCode } from "lucide-react-native";

import { SalesDocDetail } from "@/components/sales/SalesDocDetail";
import { BottomActionBar, Button } from "@/components/ui";
import { canCreateDepositQr } from "@/lib/depositQr";
import { radius } from "@/theme";
import { formatArea, formatDate, formatVND } from "@/lib/format";
import { ScheduleRow } from "@/lib/paymentMath";
import { DatCocService } from "@/sevicesSupabase/DatCocService";
import { Receipt } from "@/sevicesSupabase/PaymentProgressService";

/**
 * Chi tiết đặt cọc – như web (ContractDetail type DATCOC): đầu phiếu từ dòng danh sách fn_deposit_list,
 * lịch thanh toán + phiếu thu theo phiếu giữ chỗ (DatCocService.getDepositDetail → PaymentProgressService).
 */
export default function DepositDetailScreen() {
  const router = useRouter();
  const returningFromPayment = useRef(false);
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

  // Quay lại từ màn QR → nạp lại (webhook có thể đã tạo phiếu thu và duyệt đặt cọc)
  useFocusEffect(
    useCallback(() => {
      if (!returningFromPayment.current) return;
      returningFromPayment.current = false;
      void load(true);
    }, [load])
  );

  const h = header || {};
  // Như web: chỉ phiếu đặt cọc chờ duyệt (còn tiền cọc phải thu) mới có QR thanh toán
  const canCollect = !loading && canCreateDepositQr(h);
  // Lịch ký khoá theo uuid PHIẾU GIỮ CHỖ (pgc_id), không phải id phiếu cọc (web openSigningForDeposit)
  const pgcId = String(h.PhieuGiuChoId ?? "");
  const goToSigning = () =>
    router.push({
      pathname: "/signing/form",
      // Loại khách (cá nhân / doanh nghiệp) form tự lấy theo khách của phiếu
      params: { pgcId },
    });
  const goToPayment = () => {
    returningFromPayment.current = true;
    router.push({ pathname: "/deposit/qr-payment", params: { data: JSON.stringify(h) } });
  };
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
      footer={
        loading ? undefined : (
          <BottomActionBar>
            {/* Như web (menu dòng đặt cọc "Đặt lịch ký"): luôn cho đặt lịch ký, mở form đã điền sẵn phiếu */}
            {pgcId ? (
              <Button
                variant={canCollect ? "secondary" : "primary"}
                title="Đặt lịch ký"
                icon={CalendarCheck}
                onPress={goToSigning}
                style={canCollect ? styles.pillFixed : styles.pill}
              />
            ) : null}
            {canCollect ? <Button title="Thu tiền cọc QR" icon={QrCode} onPress={goToPayment} style={styles.pill} /> : null}
          </BottomActionBar>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  pill: { flex: 1, borderRadius: radius.full },
  pillFixed: { borderRadius: radius.full },
});
