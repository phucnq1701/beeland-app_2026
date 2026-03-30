import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  FileText,
  Calendar,
  DollarSign,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertCircle,
  CreditCard,
  Layers,
  CircleDot,
  Paperclip,
  File,
  Image,
  FileSpreadsheet,
  Download,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import { CustomerService } from "@/sevices/CustomerService";

interface PaymentHistory {
  ngayThu: string;
  soTien: number;
  ghiChu: string;
}

interface Installment {
  dot: string;
  phaiThu: number;
  daThu: number;
  conNo: number;
  trangThai: "paid" | "partial" | "unpaid";
}

interface ContractDocument {
  id: string;
  name: string;
  type: "pdf" | "doc" | "xls" | "jpg" | "png";
  size: string;
  date: string;
  category: string;
}

interface ContractDetail {
  maHD: string;
  soHopDong: string;
  ngayKy: string;
  tenKH: string;
  maSP: string;
  tongGiaTri: number;
  trangThai: string;
  tenDA: string;
  colorTT: string;
  lichSuThu: PaymentHistory[];
  tienDoDot: Installment[];
  tongPhaiThu: number;
  tongDaThu: number;
  tongConNo: number;
  taiLieu: ContractDocument[];
}

const DEMO_DOCUMENTS: ContractDocument[] = [
  {
    id: "tl1",
    name: "Hợp đồng mua bán",
    type: "pdf",
    size: "4.2 MB",
    date: "2025-03-10",
    category: "Hợp đồng",
  },
  {
    id: "tl2",
    name: "Phụ lục hợp đồng số 01",
    type: "pdf",
    size: "1.8 MB",
    date: "2025-03-15",
    category: "Hợp đồng",
  },
  {
    id: "tl3",
    name: "Biên bản xác nhận đặt cọc",
    type: "pdf",
    size: "980 KB",
    date: "2025-02-28",
    category: "Thanh toán",
  },
  {
    id: "tl4",
    name: "Phiếu thu đợt 1",
    type: "pdf",
    size: "520 KB",
    date: "2025-03-15",
    category: "Thanh toán",
  },
  {
    id: "tl5",
    name: "Phiếu thu đợt 2",
    type: "pdf",
    size: "510 KB",
    date: "2025-05-20",
    category: "Thanh toán",
  },
  {
    id: "tl6",
    name: "Bản vẽ mặt bằng căn hộ",
    type: "jpg",
    size: "3.5 MB",
    date: "2025-03-10",
    category: "Thiết kế",
  },
  {
    id: "tl7",
    name: "Bảng tính giá trị hợp đồng",
    type: "xls",
    size: "1.1 MB",
    date: "2025-03-08",
    category: "Thanh toán",
  },
  {
    id: "tl8",
    name: "CMND/CCCD khách hàng",
    type: "jpg",
    size: "2.1 MB",
    date: "2025-03-10",
    category: "Hồ sơ KH",
  },
];

const DEMO_CONTRACT: ContractDetail = {
  maHD: "DEMO-001",
  soHopDong: "HD-2025-001234",
  ngayKy: "2025-03-10",
  tenKH: "Nguyễn Văn An",
  maSP: "A-12-08",
  tongGiaTri: 3250000000,
  trangThai: "Đang thực hiện",
  tenDA: "Bee Land Tower",
  colorTT: "#3B82F6",
  lichSuThu: [
    { ngayThu: "2025-03-15", soTien: 975000000, ghiChu: "Thu đợt 1 - Ký HĐMB" },
    { ngayThu: "2025-05-20", soTien: 650000000, ghiChu: "Thu đợt 2 - Đợt 1" },
    { ngayThu: "2025-07-10", soTien: 325000000, ghiChu: "Thu đợt 2 - Đợt 2" },
  ],
  tienDoDot: [
    { dot: "Đợt 1 - Ký HĐMB (30%)", phaiThu: 975000000, daThu: 975000000, conNo: 0, trangThai: "paid" },
    { dot: "Đợt 2 - Xây thô (30%)", phaiThu: 975000000, daThu: 975000000, conNo: 0, trangThai: "paid" },
    { dot: "Đợt 3 - Hoàn thiện (30%)", phaiThu: 975000000, daThu: 0, conNo: 975000000, trangThai: "unpaid" },
    { dot: "Đợt 4 - Bàn giao (10%)", phaiThu: 325000000, daThu: 0, conNo: 325000000, trangThai: "unpaid" },
  ],
  tongPhaiThu: 3250000000,
  tongDaThu: 1950000000,
  tongConNo: 1300000000,
  taiLieu: DEMO_DOCUMENTS,
};

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

function getDocIcon(type: string) {
  switch (type) {
    case "pdf":
      return { icon: File, color: "#EF4444", bg: "rgba(239,68,68,0.08)" };
    case "doc":
      return { icon: FileText, color: "#3B82F6", bg: "rgba(59,130,246,0.08)" };
    case "xls":
      return { icon: FileSpreadsheet, color: "#10B981", bg: "rgba(16,185,129,0.08)" };
    case "jpg":
    case "png":
      return { icon: Image, color: "#F59E0B", bg: "rgba(245,158,11,0.08)" };
    default:
      return { icon: File, color: "#6B7280", bg: "rgba(107,114,128,0.08)" };
  }
}

function getInstallmentIcon(status: "paid" | "partial" | "unpaid") {
  switch (status) {
    case "paid":
      return { icon: CheckCircle, color: "#10B981", bg: "rgba(16,185,129,0.1)" };
    case "partial":
      return { icon: Clock, color: "#F59E0B", bg: "rgba(245,158,11,0.1)" };
    case "unpaid":
      return { icon: AlertCircle, color: "#EF4444", bg: "rgba(239,68,68,0.1)" };
  }
}

export default function ContractDetailScreen() {
  const { id, data: dataParam } = useLocalSearchParams<{ id: string; data?: string }>();
  const router = useRouter();

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"history" | "progress" | "documents">("progress");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const buildFromParam = useCallback((): ContractDetail => {
    if (dataParam) {
      try {
        const parsed = JSON.parse(dataParam);
        return {
          ...DEMO_CONTRACT,
          maHD: parsed.maHD || id || DEMO_CONTRACT.maHD,
          soHopDong: parsed.soHopDong || DEMO_CONTRACT.soHopDong,
          ngayKy: parsed.ngayKy || DEMO_CONTRACT.ngayKy,
          tenKH: parsed.tenKH || DEMO_CONTRACT.tenKH,
          maSP: parsed.maSP || DEMO_CONTRACT.maSP,
          tongGiaTri: parsed.tongGiaTri || DEMO_CONTRACT.tongGiaTri,
          trangThai: parsed.trangThai || DEMO_CONTRACT.trangThai,
          tenDA: parsed.tenDA || DEMO_CONTRACT.tenDA,
          colorTT: parsed.colorTT || DEMO_CONTRACT.colorTT,
        };
      } catch {
        return DEMO_CONTRACT;
      }
    }
    return DEMO_CONTRACT;
  }, [dataParam, id]);

  const loadContractDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await CustomerService.getAllContracts({ maHD: id, Limit: 1, Offset: 1 });
      console.log("[ContractDetail] API response:", JSON.stringify(res?.data?.length));

      if (res?.data?.length) {
        const item = res.data[0];
        const lichSuThu: PaymentHistory[] = (item.lichSuThuTien || item.lichSuThu || []).map((h: any) => ({
          ngayThu: h.ngayThu || h.NgayThu || h.ngayPhieu || "",
          soTien: h.soTien || h.SoTien || h.giaTri || 0,
          ghiChu: h.ghiChu || h.GhiChu || h.dienGiai || "",
        }));

        const tienDoDot: Installment[] = (item.tienDoDot || item.dotThanhToan || []).map((d: any) => {
          const phaiThu = d.phaiThu || d.PhaiThu || d.soTienDot || 0;
          const daThu = d.daThu || d.DaThu || d.soTienDaThu || 0;
          const conNo = phaiThu - daThu;
          let trangThai: "paid" | "partial" | "unpaid" = "unpaid";
          if (daThu >= phaiThu && phaiThu > 0) trangThai = "paid";
          else if (daThu > 0) trangThai = "partial";
          return {
            dot: d.tenDot || d.TenDot || d.dot || "",
            phaiThu,
            daThu,
            conNo: conNo > 0 ? conNo : 0,
            trangThai,
          };
        });

        const tongPhaiThu = tienDoDot.reduce((s, d) => s + d.phaiThu, 0);
        const tongDaThu = tienDoDot.reduce((s, d) => s + d.daThu, 0);

        const detail: ContractDetail = {
          maHD: item.maHD?.toString() || id || "",
          soHopDong: item.soHopDong || item.soHD || "",
          ngayKy: item.ngayKy || item.ngayHD || "",
          tenKH: item.tenKH || item.tenKhachHang || "",
          maSP: item.maSP || item.maCanHo || "",
          tongGiaTri: item.tongGiaTri || item.giaTriHD || 0,
          trangThai: item.trangThai || item.tenTT || "",
          tenDA: item.tenDA || item.tenDuAn || "",
          colorTT: item.colorTT || item.ColorWeb || "#3B82F6",
          lichSuThu,
          tienDoDot,
          tongPhaiThu,
          tongDaThu,
          tongConNo: tongPhaiThu - tongDaThu > 0 ? tongPhaiThu - tongDaThu : 0,
          taiLieu: DEMO_DOCUMENTS,
        };

        if (tienDoDot.length > 0 || lichSuThu.length > 0) {
          setContract({ ...detail, taiLieu: DEMO_DOCUMENTS });
        } else {
          console.log("[ContractDetail] No installment data, using demo");
          setContract(buildFromParam());
        }
      } else {
        console.log("[ContractDetail] No API data, using demo");
        setContract(buildFromParam());
      }
    } catch (err) {
      console.log("[ContractDetail] Error:", err);
      setContract(buildFromParam());
    } finally {
      setLoading(false);
    }
  }, [id, buildFromParam]);

  useEffect(() => {
    void loadContractDetail();
  }, [loadContractDetail]);

  useEffect(() => {
    if (!loading && contract) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [loading, contract, fadeAnim, slideAnim]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: "Chi tiết hợp đồng",
            headerStyle: { backgroundColor: Colors.primary },
            headerTintColor: Colors.white,
            headerTitleStyle: { fontWeight: "700" as const, fontSize: 18 },
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
                <ChevronLeft color={Colors.white} size={24} />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      </View>
    );
  }

  if (!contract) return null;

  const progressPercent = contract.tongPhaiThu > 0
    ? Math.round((contract.tongDaThu / contract.tongPhaiThu) * 100)
    : 0;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Chi tiết hợp đồng",
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white,
          headerTitleStyle: { fontWeight: "700" as const, fontSize: 18 },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
              <ChevronLeft color={Colors.white} size={24} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View style={styles.contractInfoCard}>
            <View style={styles.contractInfoHeader}>
              <View style={[styles.contractIconWrap, { backgroundColor: `${contract.colorTT}15` }]}>
                <FileText color={contract.colorTT} size={22} />
              </View>
              <View style={styles.contractInfoHeaderText}>
                <Text style={styles.contractNumber}>{contract.soHopDong}</Text>
                <Text style={styles.projectName}>{contract.tenDA}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: `${contract.colorTT}18` }]}>
                <View style={[styles.statusDot, { backgroundColor: contract.colorTT }]} />
                <Text style={[styles.statusText, { color: contract.colorTT }]}>{contract.trangThai}</Text>
              </View>
            </View>

            <View style={styles.contractMetaRow}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Khách hàng</Text>
                <Text style={styles.metaValue}>{contract.tenKH}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Mã SP</Text>
                <Text style={styles.metaValue}>{contract.maSP}</Text>
              </View>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Ngày ký</Text>
                <Text style={styles.metaValue}>{formatDate(contract.ngayKy)}</Text>
              </View>
            </View>

            <View style={styles.contractValueRow}>
              <Text style={styles.contractValueLabel}>Giá trị hợp đồng</Text>
              <Text style={styles.contractValueAmount}>{formatCurrency(contract.tongGiaTri)}</Text>
            </View>
          </View>

          <View style={styles.overviewCard}>
            <Text style={styles.sectionTitle}>Tổng quan thu tiền</Text>
            <View style={styles.progressBarWrap}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
              </View>
              <Text style={styles.progressPercent}>{progressPercent}%</Text>
            </View>

            <View style={styles.overviewStats}>
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: "rgba(59,130,246,0.1)" }]}>
                  <DollarSign color="#3B82F6" size={16} />
                </View>
                <View>
                  <Text style={styles.statLabel}>Phải thu</Text>
                  <Text style={[styles.statValue, { color: "#3B82F6" }]}>
                    {formatCurrencyShort(contract.tongPhaiThu)}
                  </Text>
                </View>
              </View>
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: "rgba(16,185,129,0.1)" }]}>
                  <TrendingUp color="#10B981" size={16} />
                </View>
                <View>
                  <Text style={styles.statLabel}>Đã thu</Text>
                  <Text style={[styles.statValue, { color: "#10B981" }]}>
                    {formatCurrencyShort(contract.tongDaThu)}
                  </Text>
                </View>
              </View>
              <View style={styles.statItem}>
                <View style={[styles.statIcon, { backgroundColor: "rgba(239,68,68,0.1)" }]}>
                  <AlertCircle color="#EF4444" size={16} />
                </View>
                <View>
                  <Text style={styles.statLabel}>Còn nợ</Text>
                  <Text style={[styles.statValue, { color: "#EF4444" }]}>
                    {formatCurrencyShort(contract.tongConNo)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "progress" && styles.tabActive]}
              onPress={() => setActiveTab("progress")}
              activeOpacity={0.7}
            >
              <Layers
                color={activeTab === "progress" ? Colors.primary : Colors.textTertiary}
                size={16}
              />
              <Text style={[styles.tabText, activeTab === "progress" && styles.tabTextActive]}>
                Tiến độ đợt
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "history" && styles.tabActive]}
              onPress={() => setActiveTab("history")}
              activeOpacity={0.7}
            >
              <CreditCard
                color={activeTab === "history" ? Colors.primary : Colors.textTertiary}
                size={16}
              />
              <Text style={[styles.tabText, activeTab === "history" && styles.tabTextActive]}>
                Lịch sử thu
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "documents" && styles.tabActive]}
              onPress={() => setActiveTab("documents")}
              activeOpacity={0.7}
            >
              <Paperclip
                color={activeTab === "documents" ? Colors.primary : Colors.textTertiary}
                size={16}
              />
              <Text style={[styles.tabText, activeTab === "documents" && styles.tabTextActive]}>
                Tài liệu
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === "progress" && (
            <View style={styles.sectionCard}>
              {contract.tienDoDot.map((dot, idx) => {
                const iconInfo = getInstallmentIcon(dot.trangThai);
                const Icon = iconInfo.icon;
                const isLast = idx === contract.tienDoDot.length - 1;
                return (
                  <View key={idx}>
                    <View style={styles.installmentRow}>
                      <View style={styles.installmentLeft}>
                        <View style={[styles.installmentIconWrap, { backgroundColor: iconInfo.bg }]}>
                          <Icon color={iconInfo.color} size={16} />
                        </View>
                        {!isLast && <View style={styles.installmentLine} />}
                      </View>
                      <View style={styles.installmentContent}>
                        <Text style={styles.installmentDot}>{dot.dot}</Text>
                        <View style={styles.installmentGrid}>
                          <View style={styles.installmentGridItem}>
                            <Text style={styles.gridLabel}>Phải thu</Text>
                            <Text style={styles.gridValue}>{formatCurrencyShort(dot.phaiThu)}</Text>
                          </View>
                          <View style={styles.installmentGridItem}>
                            <Text style={styles.gridLabel}>Đã thu</Text>
                            <Text style={[styles.gridValue, { color: "#10B981" }]}>
                              {formatCurrencyShort(dot.daThu)}
                            </Text>
                          </View>
                          <View style={styles.installmentGridItem}>
                            <Text style={styles.gridLabel}>Còn nợ</Text>
                            <Text
                              style={[
                                styles.gridValue,
                                { color: dot.conNo > 0 ? "#EF4444" : "#10B981" },
                              ]}
                            >
                              {formatCurrencyShort(dot.conNo)}
                            </Text>
                          </View>
                        </View>
                        {dot.phaiThu > 0 && (
                          <View style={styles.miniProgressWrap}>
                            <View style={styles.miniProgressBg}>
                              <View
                                style={[
                                  styles.miniProgressFill,
                                  {
                                    width: `${Math.min(100, Math.round((dot.daThu / dot.phaiThu) * 100))}%`,
                                    backgroundColor: iconInfo.color,
                                  },
                                ]}
                              />
                            </View>
                            <Text style={[styles.miniProgressText, { color: iconInfo.color }]}>
                              {Math.round((dot.daThu / dot.phaiThu) * 100)}%
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {!isLast && <View style={{ height: 4 }} />}
                  </View>
                );
              })}
            </View>
          )}

          {activeTab === "history" && (
            <View style={styles.sectionCard}>
              {contract.lichSuThu.length === 0 ? (
                <View style={styles.emptyHistory}>
                  <CreditCard color={Colors.textTertiary} size={32} />
                  <Text style={styles.emptyHistoryText}>Chưa có lịch sử thu tiền</Text>
                </View>
              ) : (
                contract.lichSuThu.map((item, idx) => {
                  const isLast = idx === contract.lichSuThu.length - 1;
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
                              <Text style={styles.historyDate}>{formatDate(item.ngayThu)}</Text>
                            </View>
                            <Text style={styles.historyAmount}>
                              +{formatCurrencyShort(item.soTien)}
                            </Text>
                          </View>
                          {item.ghiChu ? (
                            <Text style={styles.historyNote}>{item.ghiChu}</Text>
                          ) : null}
                        </View>
                      </View>
                      {!isLast && <View style={{ height: 4 }} />}
                    </View>
                  );
                })
              )}
            </View>
          )}

          {activeTab === "documents" && (
            <View style={styles.sectionCard}>
              {contract.taiLieu.length === 0 ? (
                <View style={styles.emptyHistory}>
                  <Paperclip color={Colors.textTertiary} size={32} />
                  <Text style={styles.emptyHistoryText}>Chưa có tài liệu</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.docCount}>{contract.taiLieu.length} tài liệu</Text>
                  {contract.taiLieu.map((doc, idx) => {
                    const docIconInfo = getDocIcon(doc.type);
                    const DocIcon = docIconInfo.icon;
                    const isLast = idx === contract.taiLieu.length - 1;
                    return (
                      <TouchableOpacity
                        key={doc.id}
                        style={[styles.docRow, !isLast && styles.docRowBorder]}
                        activeOpacity={0.6}
                      >
                        <View style={[styles.docIconWrap, { backgroundColor: docIconInfo.bg }]}>
                          <DocIcon color={docIconInfo.color} size={18} />
                        </View>
                        <View style={styles.docInfo}>
                          <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
                          <View style={styles.docMeta}>
                            <Text style={styles.docType}>{doc.type.toUpperCase()}</Text>
                            <View style={styles.docMetaDot} />
                            <Text style={styles.docSize}>{doc.size}</Text>
                            <View style={styles.docMetaDot} />
                            <Text style={styles.docDate}>{formatDate(doc.date)}</Text>
                          </View>
                          {doc.category ? (
                            <View style={styles.docCategoryWrap}>
                              <Text style={styles.docCategory}>{doc.category}</Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.docAction}>
                          <Download color={Colors.textTertiary} size={16} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </View>
          )}

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
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  contractInfoCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 12 },
      android: { elevation: 3 },
      web: { boxShadow: "0 3px 12px rgba(0,0,0,0.07)" },
    }),
  },
  contractInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  contractIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  contractInfoHeaderText: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  contractNumber: {
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
  contractMetaRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  metaItem: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    borderRadius: 10,
    padding: 10,
  },
  metaLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: "500" as const,
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  contractValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(232,111,37,0.06)",
    borderRadius: 10,
    padding: 12,
  },
  contractValueLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  contractValueAmount: {
    fontSize: 17,
    fontWeight: "800" as const,
    color: Colors.primary,
    letterSpacing: -0.3,
  },
  overviewCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 12 },
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
    textAlign: "right",
  },
  overviewStats: {
    flexDirection: "row",
    gap: 8,
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
  tabBar: {
    flexDirection: "row",
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 8px rgba(0,0,0,0.05)" },
    }),
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 11,
  },
  tabActive: {
    backgroundColor: "rgba(232,111,37,0.1)",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textTertiary,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 12 },
      android: { elevation: 3 },
      web: { boxShadow: "0 3px 12px rgba(0,0,0,0.07)" },
    }),
  },
  installmentRow: {
    flexDirection: "row",
  },
  installmentLeft: {
    alignItems: "center",
    width: 36,
  },
  installmentIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  installmentLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#E5E7EB",
    marginTop: 4,
  },
  installmentContent: {
    flex: 1,
    marginLeft: 10,
    paddingBottom: 16,
  },
  installmentDot: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 8,
  },
  installmentGrid: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  installmentGridItem: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    borderRadius: 8,
    padding: 8,
  },
  gridLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: "500" as const,
    marginBottom: 2,
  },
  gridValue: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  miniProgressWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  miniProgressBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EDEEF2",
    overflow: "hidden",
  },
  miniProgressFill: {
    height: "100%",
    borderRadius: 3,
  },
  miniProgressText: {
    fontSize: 11,
    fontWeight: "700" as const,
    minWidth: 32,
    textAlign: "right",
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
  docCount: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: "600" as const,
    marginBottom: 12,
  },
  docRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: 12,
  },
  docRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F2F3F7",
  },
  docIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  docInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  docName: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.text,
    marginBottom: 3,
  },
  docMeta: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    marginBottom: 4,
  },
  docType: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: Colors.textTertiary,
    letterSpacing: 0.5,
  },
  docMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#D1D5DB",
  },
  docSize: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: "500" as const,
  },
  docDate: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: "500" as const,
  },
  docCategoryWrap: {
    alignSelf: "flex-start" as const,
    backgroundColor: "#F2F3F7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  docCategory: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  docAction: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F7F8FA",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
});
