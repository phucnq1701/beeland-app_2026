import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Camera, FileSearch, Image as ImageIcon, QrCode, Upload } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";

import {
  AppHeader,
  Badge,
  BadgeTone,
  BottomActionBar,
  BottomSheet,
  Button,
  Card,
  CountdownPill,
  EmptyState,
  ErrorState,
  KeyValueRow,
  MoneyText,
  ProgressSteps,
  Screen,
  SheetOption,
  SkeletonDetail,
  StatusBadge,
  Text,
  useToast,
} from "@/components/ui";
import { BookingDocuments } from "@/components/booking/BookingDocuments";
import { BookingGifts, BookingPrice } from "@/components/booking/BookingPriceAndGifts";
import { CollapsibleSection } from "@/components/booking/CollapsibleSection";
import { BOOKING_STEPS, getBookingProgress } from "@/lib/bookingProgress";
import { formatDateTime, formatNumberVN, formatVND, formatVNDShort, maskPhone } from "@/lib/format";
import { colors, elevation, radius, space } from "@/theme";
import { BookingService } from "@/sevicesSupabase/BookingService";
import {
  PriceServices,
  ActivePriceListItem,
} from "@/sevicesSupabase/PriceServices";

type Section = "policy" | "price" | "gift" | "docs";

/** Dự phòng khi trạng thái không có color_code từ catalog. */
const STATE_TONE: Record<string, BadgeTone> = {
  PENDING: "warning",
  APPROVED: "success",
  CANCELLED: "danger",
  EXPIRED: "danger",
};
const STATE_LABEL: Record<string, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  CANCELLED: "Huỷ booking",
  EXPIRED: "Hết hạn",
};

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();

  const [data, setData] = useState<any>(null);
  // Giá đang hiệu lực theo bảng giá (RPC get_active_price_for_product);
  // null → fallback về data.price như cũ
  const [activePrice, setActivePrice] = useState<ActivePriceListItem | null>(null);
  // Tiền booking chuẩn = "Tiền booking" trong Cài đặt bán hàng – cùng nguồn với màn QR.
  const [standardAmount, setStandardAmount] = useState<number | null>(null);
  const [amountMissing, setAmountMissing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const [openSection, setOpenSection] = useState<Record<Section, boolean>>({
    policy: false,
    price: false,
    gift: false,
    docs: false,
  });
  const [uploadSheet, setUploadSheet] = useState(false);
  // Nguồn ảnh đã chọn trong sheet; chỉ mở camera/thư viện sau khi sheet đóng hẳn (onClosed).
  const pendingPick = useRef<"camera" | "library" | null>(null);
  const [images, setImages] = useState<any[]>([]);
  const [imagesFetched, setImagesFetched] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [imagesError, setImagesError] = useState<string | null>(null);

  const returningFromPayment = useRef(false);

  const loadData = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setLoadError(null);
    // Giữ dữ liệu cũ trong lúc tải lại (kéo làm mới, quay về từ QR) để màn không chớp trắng.
    try {
      const res = await BookingService.getBookingEditDetail(String(id ?? ""));
      if (version === requestVersion.current) setData(res?.data ?? null);
      const projectId = res?.data?.project?.id;
      if (projectId) {
        void BookingService.resolveBookingAmount(projectId, res?.data?.ngayGiuCho ?? res?.data?.ngayNhap ?? null)
          .then((r) => {
            if (version !== requestVersion.current) return;
            setStandardAmount(r?.amount ?? null);
            setAmountMissing(r?.amount == null);
          })
          .catch(() => {
            if (version === requestVersion.current) setAmountMissing(false);
          });
      }
      const product = res?.data?.product;
      if (product) {
        // Không chặn UI chính: giá bảng giá về sau thì thay thế giá sản phẩm
        void PriceServices.getActivePriceForProduct({
          productId: product.id,
          maSP: product.ma_sp ?? product.ky_hieu,
        }).then((r) => {
          if (version === requestVersion.current) setActivePrice(r.data);
        });
      }
    } catch (error) {
      if (version === requestVersion.current) {
        setLoadError(error instanceof Error && error.message.includes("đăng nhập")
          ? error.message
          : "Không tải được chi tiết booking. Vui lòng thử lại.");
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // Đổi sang booking khác → xoá dữ liệu cũ
    setData(null);
    setActivePrice(null);
    setStandardAmount(null);
    setAmountMissing(false);
    setImages([]);
    setImagesFetched(false);
    void loadData();
    return () => { requestVersion.current += 1; };
  }, [loadData]);

  // Quay lại từ màn thanh toán → nạp lại trạng thái booking (webhook có thể đã cập nhật)
  useFocusEffect(
    useCallback(() => {
      if (!returningFromPayment.current) return;
      returningFromPayment.current = false;
      void loadData();
    }, [loadData])
  );

  const loadImages = async () => {
    try {
      setLoadingImages(true);
      setImagesError(null);
      setImages([]);
      const res = await BookingService.getListImageGC({
        // Giống web: UUID vòng đời, fallback UUID booking nếu chưa liên kết.
        MaPGC: data?.maPGC || data?.id,
      });
      setImages(res?.data ?? []);
      setImagesFetched(true);
    } catch (error) {
      console.log("load images error", error);
      setImagesError("Không tải được hình ảnh giao dịch. Vui lòng thử lại.");
    } finally {
      setLoadingImages(false);
    }
  };

  const toggleSection = (key: Section) => {
    const next = !openSection[key];
    setOpenSection((s) => ({ ...s, [key]: next }));
    if (key === "docs" && next && !imagesFetched && !loadingImages) void loadImages();
  };

  const showDocuments = () => {
    setOpenSection((s) => ({ ...s, docs: true }));
    if (!imagesFetched && !loadingImages) void loadImages();
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      // Lỗi chặn → giữ Alert
      Alert.alert("Thông báo", "Cần cấp quyền truy cập camera");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled) void handleUploadComplete(result.assets);
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      // Lỗi chặn → giữ Alert
      Alert.alert("Thông báo", "Cần cấp quyền truy cập thư viện ảnh");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.8,
      // iOS: ảnh HEIC mặc định được giữ nguyên định dạng (kể cả khi quality < 1) và không
      // hiển thị được ở ô chứng từ / web. "compatible" để iOS chuyển sang JPEG khi chọn.
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (!result.canceled) void handleUploadComplete(result.assets);
  };

  /**
   * Giống web FormImage: tải ảnh lên nơi lưu tài liệu của công ty rồi lưu
   * vào booking (MaPGC = UUID vòng đời, cùng khóa khối "Chứng từ" dùng để đọc).
   */
  const handleUploadComplete = async (assets: ImagePicker.ImagePickerAsset[]) => {
    if (!assets?.length || isUploading) return;
    const maPGC = data?.maPGC || data?.id;
    if (!maPGC) {
      toast.show({ type: "error", message: "Không xác định được phiếu booking để lưu chứng từ" });
      return;
    }
    setIsUploading(true);
    try {
      const links: string[] = [];
      for (const asset of assets) {
        const link = await BookingService.uploadBookingImage({
          uri: asset.uri,
          name: asset.fileName ?? undefined,
          type: asset.mimeType ?? undefined,
        });
        links.push(link);
      }
      await BookingService.addBookingImages({ MaPGC: String(maPGC), Images: links });
      setOpenSection((s) => ({ ...s, docs: true }));
      await loadImages();
      toast.show({
        type: "success",
        message: links.length > 1 ? `Đã tải lên ${links.length} chứng từ` : "Đã tải lên chứng từ",
      });
    } catch (error) {
      console.log("Upload error:", error);
      toast.show({
        type: "error",
        message: error instanceof Error && error.message ? error.message : "Tải ảnh lên thất bại",
        action: { label: "Thử lại", onPress: () => setUploadSheet(true) },
      });
    } finally {
      setIsUploading(false);
    }
  };

  const header = <AppHeader variant="soft" title={data?.soPhieu ?? "Chi tiết booking"} />;

  if (loading && !data) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Screen header={header} scroll={false} padded={false}>
          <SkeletonDetail />
        </Screen>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Screen header={header}>
          {loadError ? (
            <ErrorState description={loadError} onRetry={() => void loadData()} />
          ) : (
            <EmptyState
              icon={FileSearch}
              title="Không tìm thấy booking"
              actionLabel="Về danh sách"
              onAction={() => router.replace("/bookings")}
            />
          )}
        </Screen>
      </>
    );
  }

  const isActiveBooking =
    (data?.state === "PENDING" || String(data?.maTT ?? data?.state) === "1") &&
    !["APPROVED", "CANCELLED", "EXPIRED"].includes(data?.state) &&
    (!data?.giaiDoan || data.giaiDoan === "GIUCHO");

  const progress = getBookingProgress(
    {
      giaiDoan: data.giaiDoan,
      daThu: data.daThu,
      tienGiuCho: standardAmount ?? data.tienGiuCho,
      state: data.state,
      hetHanLuc: data.hetHanLuc,
    },
    Date.now()
  );
  // Hết hạn giữ chỗ thì không thu tiền được nữa (màn QR cũng không cho tạo mã).
  const canCollect = isActiveBooking && !progress.paid && !progress.expired;
  // Chỉ booking đã huỷ mới khoá tải chứng từ; mọi trạng thái khác đều được tải lên.
  const canUploadDocs = !progress.cancelled;

  // Ưu tiên giá theo bảng giá hiệu lực; không có thì dùng data.price như cũ
  const priceData: Record<string, any> | null = activePrice
    ? {
        ...activePrice,
        unit_price_vat:
          activePrice.unit_price_vat ??
          (Number(activePrice.area) > 0 && activePrice.total_after_vat != null
            ? Number(activePrice.total_after_vat) / Number(activePrice.area)
            : null),
      }
    : data?.price ?? null;

  const productCode = data?.product?.ky_hieu ?? data?.product?.ma_sp ?? null;
  const statusLabel = data?.tenTT || STATE_LABEL[data?.state] || "Chưa xác định";
  const pricingConfigName =
    data?.pricingConfig?.name ?? data?.pricingConfig?.ten_cau_hinh ?? data?.pricingConfig?.ten_cs ?? data?.maCSTong;

  const goToPayment = () => {
    returningFromPayment.current = true;
    router.push({
      pathname: "/booking/qr-payment",
      params: { bookingId: String(data?.id ?? data?.soPhieu ?? "") },
    });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        header={header}
        padded={false}
        refreshing={loading}
        onRefresh={() => void loadData()}
        footer={
          <BottomActionBar>
            {canUploadDocs ? (
              <Button
                variant="secondary"
                icon={Upload}
                title="Chứng từ"
                loading={isUploading}
                onPress={() => setUploadSheet(true)}
                style={canCollect ? styles.pill : [styles.flex, styles.pill]}
              />
            ) : (
              <Button variant="secondary" icon={ImageIcon} title="Xem chứng từ" onPress={showDocuments} style={[styles.flex, styles.pill]} />
            )}
            {canCollect ? (
              <Button title="Thu tiền QR" icon={QrCode} onPress={goToPayment} style={[styles.flex, styles.pill]} />
            ) : null}
          </BottomActionBar>
        }
      >
        <View style={styles.body}>
          {/* Chỉ gắn onExpire khi còn hạn: sau khi tải lại, booking đã hết hạn sẽ không gọi lại → tránh vòng lặp tải. */}
          {isActiveBooking && !progress.paid ? (
            <CountdownPill
              expiresAt={data.hetHanLuc}
              onExpire={progress.expired ? undefined : () => void loadData()}
            />
          ) : null}

          <View style={styles.hero}>
            <Text variant="caption" color={colors.showcase.textMuted}>
              {progress.paid ? "Tiền booking đã thu" : "Tiền booking cần thu"}
            </Text>
            {standardAmount != null ? (
              <MoneyText value={standardAmount} variant="display" color="onInverse" />
            ) : (
              <Text variant="display" color="onInverse">
                —
              </Text>
            )}
            {amountMissing ? (
              <Text variant="caption" color={colors.showcase.accent}>
                Dự án chưa cài “Tiền booking” trong Cài đặt bán hàng.
              </Text>
            ) : null}
            <View style={styles.heroMeta}>
              <Text variant="caption" color={colors.showcase.textMuted} numberOfLines={1} style={styles.flex}>
                {[productCode, data?.project?.ten_da].filter(Boolean).join(" · ") || "—"}
              </Text>
              <Text variant="caption" color={colors.showcase.textMuted}>
                Giá HĐ {formatVNDShort(data.tongGia)}
              </Text>
            </View>
          </View>

          <Card style={styles.card}>
            <View style={styles.progressHead}>
              <Text variant="subhead">Tiến độ</Text>
              {data?.colorCode ? (
                <StatusBadge label={statusLabel} color={data.colorCode} />
              ) : (
                <Badge label={statusLabel} tone={STATE_TONE[data?.state] ?? "neutral"} />
              )}
            </View>
            <ProgressSteps steps={BOOKING_STEPS} current={progress.current} cancelled={progress.cancelled} />
          </Card>

          <Card style={styles.card}>
            <KeyValueRow label="Khách hàng" value={data?.customer?.tenKH || "—"} />
            <KeyValueRow label="Mã khách hàng" value={data?.customer?.maSoKH || "—"} />
            <KeyValueRow label="Điện thoại" value={maskPhone(data?.customer?.dienThoai) || "—"} />
            <KeyValueRow label="Sàn giao dịch" value={data?.san?.tenCongTy || "—"} />
            <KeyValueRow label="Nhân viên" value={data?.nhanVien || "—"} />
            <KeyValueRow label="Đã thu" value={formatVND(data?.daThu)} />
            <KeyValueRow label="Ngày booking" value={formatDateTime(data?.ngayGiuCho ?? data?.ngayNhap)} last />
          </Card>

          <CollapsibleSection title="Chính sách & thời gian" open={openSection.policy} onToggle={() => toggleSection("policy")}>
            <KeyValueRow label="Bảng giá" value={data?.priceList?.name || "—"} />
            <KeyValueRow label="Chính sách bán hàng" value={data?.policy?.ten_cs || "—"} />
            <KeyValueRow label="Cấu hình tính giá" value={pricingConfigName || "—"} />
            <KeyValueRow label="Tiến độ thanh toán" value={data?.paymentSchedule?.name || "—"} />
            <KeyValueRow label="Booking ưu tiên" value={data?.uuTien == null ? "—" : data.uuTien ? "Có" : "Không"} />
            <KeyValueRow label="Hết hạn lúc" value={formatDateTime(data?.hetHanLuc)} />
            <KeyValueRow
              label="Thời gian giữ chỗ"
              value={data?.thoiGianBooking != null ? `${formatNumberVN(data.thoiGianBooking)} phút` : "—"}
              last
            />
          </CollapsibleSection>

          <CollapsibleSection title="Giá theo bảng giá" open={openSection.price} onToggle={() => toggleSection("price")}>
            <BookingPrice
              priceData={priceData}
              priceListName={data?.priceList?.name}
              fromProduct={!activePrice && data?.priceSource === "bds_products"}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="Quà tặng / Khuyến mãi"
            count={data?.promotions?.length}
            open={openSection.gift}
            onToggle={() => toggleSection("gift")}
          >
            <BookingGifts promotions={data?.promotions} />
          </CollapsibleSection>

          <CollapsibleSection
            title="Chứng từ"
            count={imagesFetched ? images.length : undefined}
            open={openSection.docs}
            onToggle={() => toggleSection("docs")}
          >
            <BookingDocuments images={images} loading={loadingImages} error={imagesError} onRetry={() => void loadImages()} />
          </CollapsibleSection>
        </View>
      </Screen>

      <BottomSheet
        visible={uploadSheet}
        onClose={() => setUploadSheet(false)}
        onClosed={() => {
          const pick = pendingPick.current;
          pendingPick.current = null;
          if (pick === "camera") void pickFromCamera();
          else if (pick === "library") void pickFromLibrary();
        }}
        title="Tải chứng từ"
      >
        <SheetOption
          icon={Camera}
          label="Chụp ảnh"
          onPress={() => {
            pendingPick.current = "camera";
            setUploadSheet(false);
          }}
        />
        <SheetOption
          icon={ImageIcon}
          label="Chọn từ thư viện"
          onPress={() => {
            pendingPick.current = "library";
            setUploadSheet(false);
          }}
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.md },
  hero: {
    backgroundColor: colors.showcase.bg,
    borderRadius: radius.x3,
    paddingHorizontal: space.xl,
    paddingVertical: space.xl,
    gap: space.xs,
    ...elevation.soft,
  },
  card: { borderWidth: 0, borderRadius: radius.xxl, paddingHorizontal: space.lg + 2, ...elevation.soft },
  pill: { borderRadius: radius.full },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.xs },
  progressHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.md,
    gap: space.sm,
  },
});
