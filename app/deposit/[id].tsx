import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Animated,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  Landmark,
  Calendar,
  User,
  Phone,
  Mail,
  MapPin,
  Hash,
  CreditCard,
  CircleDot,
  FileText,
  Ruler,
  BadgeDollarSign,
  MessageSquare,
  UserCheck,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import {
  DEMO_DEPOSIT_DETAILS,
  DEMO_DEPOSITS,
  DepositDetail,
  DepositPaymentHistory,
} from "@/mocks/deposits";

function formatCurrency(value: number): string {
  if (!value && value !== 0) return "0 đ";
  return new Intl.NumberFormat("vi-VN").format(value) + " đ";
}

function formatCurrencyShort(value: number): string {
  if (!value && value !== 0) return "0";
  if (value >= 1000000000) {
    const bil = value / 1000000000;
    return bil % 1 === 0 ? `${bil} tỷ` : `${bil.toFixed(1)} tỷ`;
  }
  if (value >= 1000000) {
    const mil = value / 1000000;
    return mil % 1 === 0 ? `${mil} tr` : `${mil.toFixed(1)} tr`;
  }
  return new Intl.NumberFormat("vi-VN").format(value) + " đ";
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return dateStr;
  }
}

function buildFallbackDetail(id: string, dataParam?: string): DepositDetail {
  if (DEMO_DEPOSIT_DETAILS[id]) return DEMO_DEPOSIT_DETAILS[id];

  const deposit = DEMO_DEPOSITS.find((d) => d.maDC === id);
  const base = deposit || DEMO_DEPOSITS[0];

  let parsed: Record<string, any> = {};
  if (dataParam) {
    try {
      parsed = JSON.parse(dataParam);
    } catch {
      console.log("[DepositDetail] Failed to parse data param");
    }
  }

  return {
    ...parsed,
    maDC: parsed.maDC || base.maDC,
    soPhieu: parsed.soPhieu || base.soPhieu,
    ngayDatCoc: parsed.ngayDatCoc || base.ngayDatCoc,
    tenKH: parsed.tenKH || base.tenKH,
    maSP: parsed.maSP || base.maSP,
    soTienCoc: parsed.soTienCoc || base.soTienCoc,
    trangThai: parsed.trangThai || base.trangThai,
    tenDA: parsed.tenDA || base.tenDA,
    colorTT: parsed.colorTT || base.colorTT,
    soCMND: parsed?.SoCMND,
    diDong: parsed?.DiDong ?? parsed?.DiDong2,
    email: parsed?.email ?? "email@example.com",
    diaChi: parsed?.DiaChi ?? "",
    loaiSP: "Căn hộ",
    dienTich: `${parsed?.DienTichTT} m2`,
    donGia: parsed?.DonGiaTT,
    ghiChu: "",
    nguoiTao: parsed?.NguoiNhap,
    ngayTao: parsed.ngayDatCoc || base.ngayDatCoc,
    lichSuDongTien: [
      {
        ngayThu: parsed.ngayDatCoc || base.ngayDatCoc,
        soTien: Math.round((parsed.soTienCoc || base.soTienCoc) * 0.5),
        ghiChu: "Đặt cọc lần 1",
        hinhThuc: "Chuyển khoản",
      },
    ],
    tongDaDong: Math.round((parsed.soTienCoc || base.soTienCoc) * 0.5),
    tongConLai: Math.round((parsed.soTienCoc || base.soTienCoc) * 0.5),
  };
}

export default function DepositDetailScreen() {
  const { id, data: dataParam } = useLocalSearchParams<{
    id: string;
    data?: string;
  }>();
  const router = useRouter();

  const [detail, setDetail] = useState<DepositDetail | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    const d = buildFallbackDetail(id || "", dataParam);

    setDetail(d);
  }, [id, dataParam]);

  useEffect(() => {
    if (detail) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [detail, fadeAnim, slideAnim]);

  if (!detail) return null;

  const progressPercent =
    detail.TienCoc > 0
      ? Math.round((detail.TienCoc / detail.TongGiaTriHDMB) * 100)
      : 0;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Chi tiết đặt cọc",
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
          headerTitleStyle: { fontWeight: "700" as const, fontSize: 18 },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ padding: 4 }}
            >
              <ChevronLeft color={Colors.white} size={24} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        >
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: `${detail.colorTT}15` },
                ]}
              >
                <Landmark color={detail.colorTT} size={22} />
              </View>
              <View style={styles.infoHeaderText}>
                <Text style={styles.depositNumber}>{detail.soPhieu}</Text>
                <Text style={styles.projectName}>{detail.tenDA}</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: `${detail.colorTT}18` },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: detail.colorTT },
                  ]}
                />
                <Text style={[styles.statusText, { color: detail.colorTT }]}>
                  {detail.trangThai}
                </Text>
              </View>
            </View>

            <View style={styles.metaGrid}>
              <View style={styles.metaItem}>
                <User color={Colors.textTertiary} size={13} />
                <View>
                  <Text style={styles.metaLabel}>Khách hàng</Text>
                  <Text style={styles.metaValue}>{detail.tenKH}</Text>
                </View>
              </View>
              <View style={styles.metaItem}>
                <Hash color={Colors.textTertiary} size={13} />
                <View>
                  <Text style={styles.metaLabel}>Mã SP</Text>
                  <Text style={[styles.metaValue, { color: Colors.primary }]}>
                    {detail.maSP}
                  </Text>
                </View>
              </View>
              <View style={styles.metaItem}>
                <Calendar color={Colors.textTertiary} size={13} />
                <View>
                  <Text style={styles.metaLabel}>Ngày đặt cọc</Text>
                  <Text style={styles.metaValue}>
                    {formatDate(detail.ngayDatCoc)}
                  </Text>
                </View>
              </View>
              <View style={styles.metaItem}>
                <Phone color={Colors.textTertiary} size={13} />
                <View>
                  <Text style={styles.metaLabel}>Điện thoại</Text>
                  <Text style={styles.metaValue}>{detail.diDong}</Text>
                </View>
              </View>
            </View>

            <View style={styles.extraInfo}>
              <View style={styles.extraRow}>
                <Mail color={Colors.textTertiary} size={12} />
                <Text style={styles.extraText}>{detail.email}</Text>
              </View>
              <View style={styles.extraRow}>
                <MapPin color={Colors.textTertiary} size={12} />
                <Text style={styles.extraText}>{detail.diaChi}</Text>
              </View>
              <View style={styles.extraRow}>
                <FileText color={Colors.textTertiary} size={12} />
                <Text style={styles.extraText}>CMND/CCCD: {detail.soCMND}</Text>
              </View>
            </View>
          </View>

          <View style={styles.productCard}>
            <Text style={styles.sectionTitle}>Thông tin sản phẩm</Text>
            <View style={styles.productGrid}>
              <View style={styles.productItem}>
                <Ruler color={Colors.accent.blue} size={14} />
                <Text style={styles.productLabel}>Diện tích</Text>
                <Text style={styles.productValue}>{detail.dienTich}</Text>
              </View>
              <View style={styles.productItem}>
                <Landmark color={Colors.accent.purple} size={14} />
                <Text style={styles.productLabel}>Loại SP</Text>
                <Text style={styles.productValue}>{detail.loaiSP}</Text>
              </View>
              <View style={styles.productItem}>
                <BadgeDollarSign color={Colors.accent.green} size={14} />
                <Text style={styles.productLabel}>Đơn giá</Text>
                <Text style={styles.productValue}>
                  {detail.donGia > 0
                    ? formatCurrencyShort(detail.donGia) + "/m²"
                    : "—"}
                </Text>
              </View>
            </View>
            {detail.ghiChu ? (
              <View style={styles.noteRow}>
                <MessageSquare color={Colors.textTertiary} size={12} />
                <Text style={styles.noteText}>{detail.ghiChu}</Text>
              </View>
            ) : null}
            <View style={styles.creatorRow}>
              <UserCheck color={Colors.textTertiary} size={12} />
              <Text style={styles.creatorText}>
                Tạo bởi: {detail.nguoiTao} • {formatDate(detail.ngayTao)}
              </Text>
            </View>
          </View>

          <View style={styles.overviewCard}>
            <Text style={styles.sectionTitle}>Tổng quan thanh toán</Text>
            <View style={styles.progressBarWrap}>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${progressPercent}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressPercent}>{progressPercent}%</Text>
            </View>

            <View style={styles.overviewStats}>
              <View style={styles.statItem}>
                <View
                  style={[
                    styles.statIcon,
                    { backgroundColor: "rgba(59,130,246,0.1)" },
                  ]}
                >
                  <CreditCard color="#3B82F6" size={16} />
                </View>
                <View>
                  <Text style={styles.statLabel}>Tiền cọc</Text>
                  <Text style={[styles.statValue, { color: "#3B82F6" }]}>
                    {formatCurrencyShort(detail.TienCoc)}
                  </Text>
                </View>
              </View>
              <View style={styles.statItem}>
                <View
                  style={[
                    styles.statIcon,
                    { backgroundColor: "rgba(16,185,129,0.1)" },
                  ]}
                >
                  <BadgeDollarSign color="#10B981" size={16} />
                </View>
                <View>
                  <Text style={styles.statLabel}>Đã đóng</Text>
                  <Text style={[styles.statValue, { color: "#10B981" }]}>
                    {formatCurrencyShort(detail.TienCoc)}
                  </Text>
                </View>
              </View>
              <View style={styles.statItem}>
                <View
                  style={[
                    styles.statIcon,
                    { backgroundColor: "rgba(239,68,68,0.1)" },
                  ]}
                >
                  <CreditCard color="#EF4444" size={16} />
                </View>
                <View>
                  <Text style={styles.statLabel}>Còn lại</Text>
                  <Text style={[styles.statValue, { color: "#EF4444" }]}>
                    {formatCurrencyShort(
                      detail.TongGiaTriHDMB - detail?.TienCoc
                    )}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.valueRow}>
              <Text style={styles.valueLabel}>Tổng tiền đặt cọc</Text>
              <Text style={styles.valueAmount}>
                {formatCurrency(detail.TienCoc)}
              </Text>
            </View>
          </View>

          <View style={styles.historyCard}>
            <Text style={styles.sectionTitle}>Lịch sử đóng tiền</Text>

            {detail.lichSuDongTien.length === 0 ? (
              <View style={styles.emptyHistory}>
                <CreditCard color={Colors.textTertiary} size={32} />
                <Text style={styles.emptyHistoryText}>
                  Chưa có lịch sử đóng tiền
                </Text>
              </View>
            ) : (
              detail.lichSuDongTien.map(
                (item: DepositPaymentHistory, idx: number) => {
                  const isLast = idx === detail.lichSuDongTien.length - 1;
                  return (
                    <View key={idx}>
                      <View style={styles.historyRow}>
                        <View style={styles.historyLeft}>
                          <View style={styles.historyDot}>
                            <CircleDot color="#10B981" size={18} />
                          </View>
                          {!isLast && <View style={styles.historyLine} />}
                        </View>
                        <View style={styles.historyContent}>
                          <View style={styles.historyTopRow}>
                            <View style={styles.historyDateWrap}>
                              <Calendar color={Colors.textTertiary} size={13} />
                              <Text style={styles.historyDate}>
                                {formatDate(item.ngayThu)}
                              </Text>
                            </View>
                            <Text style={styles.historyAmount}>
                              +{formatCurrencyShort(item.soTien)}
                            </Text>
                          </View>
                          {item.ghiChu ? (
                            <Text style={styles.historyNote}>
                              {item.ghiChu}
                            </Text>
                          ) : null}
                          {item.hinhThuc ? (
                            <View style={styles.paymentMethodBadge}>
                              <CreditCard
                                color={Colors.accent.blue}
                                size={10}
                              />
                              <Text style={styles.paymentMethodText}>
                                {item.hinhThuc}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      {!isLast && <View style={{ height: 4 }} />}
                    </View>
                  );
                }
              )
            )}
          </View>

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F3F7",
  },
  scrollContent: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
      web: { boxShadow: "0 3px 12px rgba(0,0,0,0.07)" },
    }),
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  infoHeaderText: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  depositNumber: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  projectName: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 2,
    fontWeight: "500" as const,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700" as const,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "47%",
    backgroundColor: "#F7F8FA",
    borderRadius: 10,
    padding: 10,
  },
  metaLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: "500" as const,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  extraInfo: {
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.04)",
  },
  extraRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  extraText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  productCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
      web: { boxShadow: "0 3px 12px rgba(0,0,0,0.07)" },
    }),
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 14,
  },
  productGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  productItem: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    gap: 4,
  },
  productLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: "500" as const,
  },
  productValue: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 8,
    backgroundColor: "rgba(245,158,11,0.06)",
    borderRadius: 8,
    padding: 10,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  creatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  creatorText: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: "500" as const,
  },
  overviewCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
      web: { boxShadow: "0 3px 12px rgba(0,0,0,0.07)" },
    }),
  },
  progressBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  progressBarBg: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EDEEF2",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: Colors.primary,
    minWidth: 40,
    textAlign: "right" as const,
  },
  overviewStats: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  statItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F7F8FA",
    borderRadius: 10,
    padding: 10,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: "500" as const,
  },
  statValue: {
    fontSize: 13,
    fontWeight: "700" as const,
    letterSpacing: -0.3,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(232,111,37,0.06)",
    borderRadius: 10,
    padding: 12,
  },
  valueLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  valueAmount: {
    fontSize: 17,
    fontWeight: "800" as const,
    color: Colors.primary,
    letterSpacing: -0.3,
  },
  historyCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
      web: { boxShadow: "0 3px 12px rgba(0,0,0,0.07)" },
    }),
  },
  emptyHistory: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyHistoryText: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: "500" as const,
  },
  historyRow: {
    flexDirection: "row",
  },
  historyLeft: {
    alignItems: "center",
    width: 36,
  },
  historyDot: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  historyLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#E5E7EB",
    marginTop: 2,
  },
  historyContent: {
    flex: 1,
    marginLeft: 10,
    paddingBottom: 16,
  },
  historyTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  historyDateWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  historyDate: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: "800" as const,
    color: "#10B981",
    letterSpacing: -0.3,
  },
  historyNote: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: "500" as const,
    marginBottom: 4,
  },
  paymentMethodBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(59,130,246,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  paymentMethodText: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: Colors.accent.blue,
  },
});
