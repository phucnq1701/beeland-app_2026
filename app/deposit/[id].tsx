import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { CalendarCheck, QrCode } from "lucide-react-native";

import { SalesDocDetail } from "@/components/sales/SalesDocDetail";
import { BottomActionBar, Button } from "@/components/ui";
import { canOfferDepositQr } from "@/lib/depositQr";
import { radius } from "@/theme";
import { formatDate } from "@/lib/format";
import { DatCocService } from "@/services/DatCocService";
import { Receipt } from "@/services/PaymentProgressService";

/**
 * Chi tiết đặt cọc — chỉ việc của khâu cọc (sếp 2026-11-17: module nào chỉ hiện thứ của module đó, app làm nhanh luồng chính):
 * tiền cọc / đã nộp / còn phải nộp (giá căn để tham khảo), thông tin cọc, phiếu thu; thao tác Thu tiền cọc QR + Đặt lịch ký.
 * Không hiện lịch thanh toán / thông số căn (xem ở Hợp đồng / Sản phẩm). Dữ liệu: DatCocService.getDepositDetail.
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
  // Như web: quyền PAYMENT_QR + phiếu chờ duyệt còn tiền cọc phải thu, không đang chờ duyệt đổi căn / hoàn cọc
  const canCollect = !loading && canOfferDepositQr(h);
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
      moneyFocus="deposit"
      info={[
        ["Ngày đặt cọc", h.NgayDatCoc ? formatDate(h.NgayDatCoc) : null],
        ["Điện thoại", h.DiDong],
        ["CCCD", h.SoCMND],
        ["Chính sách", h.TenChinhSach],
        ["Nhân viên kinh doanh", h.TenNVKD],
        ["Sàn giao dịch", h.SanGD],
      ]}
      receipts={receipts}
      receiptsTotal={receiptsTotal}
      receiptsError={receiptsError}
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void load(true)}
      footer={
        loading || (!canCollect && !pgcId) ? undefined : (
          <BottomActionBar>
            {/* Như web (menu dòng đặt cọc "Đặt lịch ký"): mọi tài khoản (sếp 2026-11-17), mở form đã điền sẵn phiếu */}
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
