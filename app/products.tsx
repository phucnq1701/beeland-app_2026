import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import {
  Stack,
  useRouter,
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";
import {
  Search,
  List,
  Grid3x3,
  Filter,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
} from "lucide-react-native";
import {
  overviewBlocks,
  statusConfig,
  getOverviewStats,
  UnitStatus,
} from "@/mocks/overviewUnits";
import Colors from "@/constants/colors";
import { Product } from "@/mocks/properties";
import { ProductService } from "@/sevicesSupabase/ProductService";
import { ProjectService } from "@/sevicesSupabase/ProjectService";
import { FilterService } from "@/sevicesSupabase/FilterService";
import { PriceServices } from "@/sevicesSupabase/PriceServices";

import * as signalR from "@microsoft/signalr";
import BlockGrid from "./product/BlockGrid";

type ViewMode = "list" | "grid" | "overview";

// Số sản phẩm mỗi lần gọi API (phân trang cuộn vô hạn)
const PAGE_SIZE = 16;

export default function ProductsScreen({
  embedded,
}: { embedded?: boolean } = {}) {
  const { showFavorites } = useLocalSearchParams<{ showFavorites?: string }>();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filterExpanded, setFilterExpanded] = useState<boolean>(false);
  const [_selectedStatus, _setSelectedStatus] = useState<
    Product["status"] | "all"
  >("all");
  const [_currentBlockIndex, _setCurrentBlockIndex] = useState<number>(0);
  const [selectedOverviewStatus, setSelectedOverviewStatus] = useState<
    UnitStatus | "all"
  >("all");
  const [_onlyShowFavorites, _setOnlyShowFavorites] = useState<boolean>(
    showFavorites === "true"
  );
  const router = useRouter();
  const { MaDA } = useLocalSearchParams();

  const scrollYRef = useRef(0);
  const leftRef = useRef<ScrollView>(null);
  const rightRef = useRef<ScrollView>(null);

  const [products2, setProducts2] = useState<any[]>([]);
  const [duAn, setDuAn] = useState<any[]>([]);
  const [khuVuc, setKhuVuc] = useState<any[]>([]);
  const [TrangThai, setTrangThai] = useState<any[]>([]);
  const [dataGrid, setDataGrid] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offSetRef = useRef(1);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);

  // Default filter values (used to detect changes for "Đặt lại" button highlight)
  const defaultFilterRef = useRef<Record<string, any>>({
    MaDA: Number(MaDA) || null,
    MaKhu: null,
    MaPK: null,
    MaTT: null,
    FormCode: null,
    KyHieu: "",
  });

  const [filterCondition, setFilterCondition] = useState<Record<string, any>>({
    MaDA: Number(MaDA) || null,
    MaKhu: null,
    MaPK: null,
    MaTT: null,
    FormCode: null,
    KyHieu: "",
  });

  // real time

  const [hubConnection, setHubConnection] = useState<any>(null);
  const [localChange, setLocalChange] = useState<any>(null);

  const initSignalR = async () => {
    try {
      // Logger no-op: chặn hoàn toàn log nội bộ của SignalR (tránh stack trace rác
      // khi server đóng kết nối realtime — không phải lỗi API)
      const silentLogger: signalR.ILogger = {
        log: () => {},
      };

      const connection = new signalR.HubConnectionBuilder()
        .withUrl("https://api-beeland.beesky.vn/signalr-beeland")
        .withAutomaticReconnect()
        .configureLogging(silentLogger)
        .build();

      // Xử lý khi server đóng kết nối (không phải lỗi API, chỉ realtime)
      connection.onclose((err) => {
        if (err) {
          console.log("[SignalR] Connection closed:", err?.message || err);
        }
      });

      await connection.start();
      // console.log("✅ Connected SignalR");

      setHubConnection(connection);
    } catch {
      // SignalR connection error
    }
  };

  useEffect(() => {
    if (!hubConnection) return;

    try {
      hubConnection.on("ChangeTable", (response: any) => {
        console.log(response, "response");

        setDataGrid((prev) => {
          return prev.map((block) => {
            if (block.rawBlock?.maKhu !== response.data?.MaKhu) {
              return block; // giữ nguyên reference
            }

            let changed = false;

            const newFloors = block.rawBlock.floor.map((floor: any) => {
              if (Number(floor.maTang) !== Number(response.data?.MaTang)) {
                return floor;
              }

              const newDetails = floor.detailFloor.map((item: any) => {
                if (Number(item.MaVT) !== Number(response.data?.MaVT)) {
                  return item;
                }

                changed = true;

                return {
                  ...item,
                  MaTT: response.maTT,
                  MauNen: response.mauNen,
                };
              });

              return {
                ...floor,
                detailFloor: newDetails,
              };
            });

            if (!changed) return block;

            return {
              ...block,
              rawBlock: {
                ...block.rawBlock,
                floor: newFloors,
              },
            };
          });
        });
        setLocalChange({
          MaTang: response.data?.MaTang,
          MaVT: response.data?.MaVT,
        });

        setTimeout(() => setLocalChange(null), 1000);
      });
    } catch {
      // SignalR listen error
    }
  }, [hubConnection]);

  useEffect(() => {
    void initSignalR();
  }, []);

  useEffect(() => {
    return () => {
      hubConnection?.stop();
    };
  }, [hubConnection]);

  const applyChangeFilter = (p: string, v: any) => {
    // Tạo bản sao để tránh mutate state trực tiếp (gây không re-render)
    let _filter = { ...filterCondition };
    switch (p) {
      case "MaDA":
        _filter[p] = v;
        _filter.MaKhu = null;
        void loadProducts2(_filter);
        break;

      case "MaKhu":
        _filter[p] = v;
        void loadProducts2(_filter);
        break;

      case "TrangThai":
        _filter[p] = v;
        _filter.MaTT = v;
        void loadProducts2(_filter);
        break;

      default:
        _filter[p] = v;
        break;
    }
    setFilterCondition(_filter);
  };

  const loadDataByDA = async (MaDA: any) => {
    const resListKhu = await ProductService.getKhuVuc({ maDA: MaDA });
    setKhuVuc(resListKhu?.data || []);

    void handleFormGrid(MaDA);
  };
  // MaTT giờ là uuid → map trạng thái theo TÊN (TenTT) từ FK cloud_catalogs
  const mapStatusByTT = (item: any) => {
    const t = String(item?.TenTT || "").toLowerCase();
    if (
      t.includes("đã bán") ||
      t.includes("hdmb") ||
      t.includes("bàn giao") ||
      t.includes("sổ đỏ") ||
      t.includes("góp vốn") ||
      t.includes("thanh lý")
    )
      return "sold";
    if (t.includes("đặt cọc")) return "deposit";
    if (t.includes("booking")) return "booking";
    if (t.includes("giữ chỗ") || t.includes("lock")) return "locked";
    return "available";
  };

  const handleFormGrid = async (MaDA: any) => {
    const result = await PriceServices.getBlock({
      maDA: MaDA ?? filterCondition?.MaDA,
    });

    const raw = result?.data || [];

    const mappedBlocks = raw
      .filter((b: any) => b.maKhu !== -1)
      .map((block: any) => {
        const units: any[] = [];

        block.floor?.forEach((floor: any) => {
          floor.detailFloor?.forEach((item: any) => {
            units.push({
              id: item.KyHieu,
              floor: floor.maTang,
              column: item.MaVT,
              status: mapStatusByTT(item),
              raw: item,
            });
          });
        });

        return {
          name: block.tenKhu,
          units,
          rawBlock: block,
          stats: {
            total: units.length,
            available: units.filter((u) => u.status === "available").length,
            deposit: units.filter((u) => u.status === "deposit").length,
          },
        };
      });

    setDataGrid(mappedBlocks);
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      // Reset phân trang về trang đầu
      offSetRef.current = 1;
      hasMoreRef.current = true;
      setHasMore(true);

      const resDA = await ProjectService.getProjects({});
      setDuAn(resDA?.data || []);
      const ma = Number(MaDA);
      const finalMa = isNaN(ma) ? resDA?.data?.[0]?.MaDA : ma;

      // Cập nhật defaultFilterRef để khớp với trạng thái ban đầu thực tế
      // (tránh isFilterChanged = true ngay khi load trang)
      defaultFilterRef.current = {
        MaDA: finalMa ?? -1,
        MaKhu: null,
        MaPK: null,
        MaTT: null,
        FormCode: null,
        KyHieu: "",
      };

      void loadDataByDA(finalMa);

      const resTT = await FilterService.getStatusSP({});
      setTrangThai(resTT?.data || []);

      let filter = {
        MaDA: finalMa ?? -1,
        MaKhu: filterCondition.MaKhu,
        MaPK: filterCondition.MaPK,
        MaTT: null,
        FormCode: filterCondition.FormCode,
        KyHieu: filterCondition?.KyHieu,
        Limit: PAGE_SIZE,
        offSet: 1,
      };
      setFilterCondition(filter);
      const res = await ProductService.getProducts(filter);
      const data = res?.data || [];
      setProducts2(data);

      // Cập nhật con trỏ phân trang + còn dữ liệu để tải thêm hay không
      offSetRef.current = data.length + 1;
      const total = (res as any)?.total ?? data.length;
      const more =
        data.length >= PAGE_SIZE && (total === 0 || data.length < total);
      hasMoreRef.current = more;
      setHasMore(more);
    } catch {
      // load products error
    } finally {
      setLoading(false);
    }
  };

  const loadProducts2 = async (_filter: any) => {
    try {
      setLoading(true);
      // Đổi bộ lọc → quay lại trang đầu
      offSetRef.current = 1;
      hasMoreRef.current = true;
      setHasMore(true);

      let filter = {
        MaDA: _filter.MaDA,
        MaKhu: _filter.MaKhu,
        MaPK: _filter.MaPK,
        MaTT: _filter.MaTT,
        FormCode: _filter.FormCode,
        KyHieu: _filter?.KyHieu,
        Limit: PAGE_SIZE,
        offSet: 1,
      };
      void loadDataByDA(_filter.MaDA);

      const res = await ProductService.getProducts(filter);
      const data = res?.data || [];
      setProducts2(data);

      offSetRef.current = data.length + 1;
      const total = (res as any)?.total ?? data.length;
      const more =
        data.length >= PAGE_SIZE && (total === 0 || data.length < total);
      hasMoreRef.current = more;
      setHasMore(more);
    } catch (error) {
      console.log("error load products", error);
    } finally {
      setLoading(false);
    }
  };

  // Tìm kiếm sản phẩm theo từ khoá (mã sản phẩm / ký hiệu / số căn hộ).
  // Giống loadProducts2 nhưng KHÔNG load lại khu vực + lưới (tránh gọi API nặng khi gõ tìm kiếm).
  const searchProducts = async (_filter: any) => {
    try {
      setLoading(true);
      // Tìm kiếm mới → quay lại trang đầu
      offSetRef.current = 1;
      hasMoreRef.current = true;
      setHasMore(true);

      const filter = {
        MaDA: _filter.MaDA,
        MaKhu: _filter.MaKhu,
        MaPK: _filter.MaPK,
        MaTT: _filter.MaTT,
        FormCode: _filter.FormCode,
        KyHieu: _filter?.KyHieu,
        Limit: PAGE_SIZE,
        offSet: 1,
      };

      const res = await ProductService.getProducts(filter);
      const data = res?.data || [];
      setProducts2(data);

      offSetRef.current = data.length + 1;
      const total = (res as any)?.total ?? data.length;
      const more =
        data.length >= PAGE_SIZE && (total === 0 || data.length < total);
      hasMoreRef.current = more;
      setHasMore(more);
    } catch (error) {
      console.log("error search products", error);
    } finally {
      setLoading(false);
    }
  };

  // Ô tìm kiếm → lọc theo Mã sản phẩm (KyHieu): debounce 500ms rồi mới gọi API.
  // ProductService map KyHieu thành or=(ky_hieu,ma_sp,so_can_ho) ilike trên server.
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      const nextFilter = { ...filterCondition, KyHieu: text.trim() };
      setFilterCondition(nextFilter);
      void searchProducts(nextFilter);
    }, 500);
  };

  // Dọn dẹp timer debounce khi unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  // Tải thêm sản phẩm khi cuộn tới cuối danh sách.
  // Tự động dừng khi đã tải hết (hasMore = false) → không gọi API nữa.
  const loadMore = async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const f = filterCondition;
      const requestOffset = offSetRef.current;
      const filter = {
        MaDA: f.MaDA,
        MaKhu: f.MaKhu,
        MaPK: f.MaPK,
        MaTT: f.MaTT,
        FormCode: f.FormCode,
        KyHieu: f?.KyHieu,
        Limit: PAGE_SIZE,
        offSet: requestOffset,
      };

      const res = await ProductService.getProducts(filter);
      const data = res?.data || [];

      setProducts2((prev) => {
        // Loại bỏ trùng lặp: phân trang theo offset + order created_at (không
        // unique) có thể trả lại cùng 1 sản phẩm ở các trang khác nhau.
        const seen = new Set(prev.map((p) => p.MaSP));
        const uniqueNew = data.filter((p) => {
          if (!p?.MaSP || seen.has(p.MaSP)) return false;
          seen.add(p.MaSP);
          return true;
        });

        const merged = [...prev, ...uniqueNew];
        // Tiến offset theo SỐ BẢN GHI THỰC NHẬN từ server (không dùng
        // merged.length) để không bị lệch trang khi có bản ghi trùng.
        offSetRef.current = requestOffset + data.length;
        const total = (res as any)?.total ?? 0;
        // Dừng khi: trang rỗng, hoặc trang cuối (< PAGE_SIZE), hoặc đã đủ total.
        const more =
          data.length >= PAGE_SIZE && (total === 0 || merged.length < total);
        hasMoreRef.current = more;
        setHasMore(more);
        return merged;
      });
    } catch (error) {
      console.log("error load more products", error);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  // Phát hiện cuộn gần tới cuối (còn cách đáy 200px) → nạp thêm
  const handleScroll = (event: any) => {
    if (viewMode !== "list") return;
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - 200
    ) {
      void loadMore();
    }
  };

  // Chỉ load mặc định khi mount lần đầu
  useEffect(() => {
    void loadProducts();
  }, []);

  // Ref giữ filter mới nhất để dùng trong useFocusEffect (tránh stale closure)
  const filterConditionRef = useRef(filterCondition);
  filterConditionRef.current = filterCondition;

  // Khi quay lại màn (sau khi lock/booking từ chi tiết SP): tải lại danh sách
  // theo bộ lọc hiện tại để cập nhật trạng thái (Đã Lock, Booking…) mà không
  // cần thoát ra vào lại. Bỏ qua lần focus đầu (mount đã load ở trên).
  const isFirstFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        return;
      }
      void loadProducts2(filterConditionRef.current);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  useEffect(() => {
    if (rightRef.current) {
      rightRef.current.scrollTo({
        y: scrollYRef.current,
        animated: false,
      });
    }

    if (leftRef.current) {
      leftRef.current.scrollTo({
        y: scrollYRef.current,
        animated: false,
      });
    }
  }, [dataGrid]);

  const getStatusLabel = (status: number) => {
    const item = TrangThai.find((i) => i.MaTT === status);
    return item?.TenTT || "";
  };

  const getStatusColor = (status: number) => {
    const item = TrangThai.find((i) => i.MaTT === status);
    return item?.ColorWeb || "#9CA3AF";
  };

  // Chữ tự động đen/trắng theo độ sáng của màu nền (dễ đọc trên mọi màu danh mục)
  const getStatusTextColor = (bg: string) => {
    try {
      let hex = String(bg || "")
        .trim()
        .replace("#", "");
      if (hex.length === 3) {
        hex = hex
          .split("")
          .map((c) => c + c)
          .join("");
      }
      if (hex.length !== 6) return "#fff";
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return lum > 0.6 ? "#111827" : "#fff";
    } catch {
      return "#fff";
    }
  };

  const handlePressProduct = (id: string) => {
    console.log("[Products] Navigate to product detail", { id });
    router.push({ pathname: "/product/[id]", params: { id } });
  };

  const getHexColor = (number: any) => {
    if (number === null || number === undefined) return "#ccc";
    return "#" + (Number(number) >>> 0).toString(16).slice(-6);
  };

  // Check if filter has changed from default (for "Đặt lại" button highlight)
  const isFilterChanged = useMemo(() => {
    const defaultFilter = defaultFilterRef.current;
    const currentFilter = filterCondition;
    const isEqual = (a: any, b: any) => {
      if (a === b) return true;
      if (Number.isNaN(a) && Number.isNaN(b)) return true;
      if (a == null && b == null) return true;
      return false;
    };
    return (
      !isEqual(currentFilter.MaDA, defaultFilter.MaDA) ||
      !isEqual(currentFilter.MaKhu, defaultFilter.MaKhu) ||
      !isEqual(currentFilter.MaPK, defaultFilter.MaPK) ||
      !isEqual(currentFilter.MaTT, defaultFilter.MaTT) ||
      !isEqual(currentFilter.FormCode, defaultFilter.FormCode) ||
      !isEqual(currentFilter.KyHieu, defaultFilter.KyHieu)
    );
  }, [filterCondition]);

  const currentOverviewBlock = overviewBlocks[0];
  const overviewStats = getOverviewStats(currentOverviewBlock);

  const _statusSummaryItems: Array<{
    key: UnitStatus | "all";
    label: string;
    count: number;
    color: string;
  }> = [
    { key: "all", label: "TỔNG", count: overviewStats.total, color: "#3B82F6" },
    {
      key: "available",
      label: "TRỐNG",
      count: overviewStats.available,
      color: "#22C55E",
    },
    {
      key: "holding",
      label: "GIỮ CHỖ",
      count: overviewStats.holding,
      color: "#F59E0B",
    },
    {
      key: "pending_kitchen",
      label: "BẾP CHỜ",
      count: overviewStats.pendingKitchen,
      color: "#F97316",
    },
    {
      key: "sold",
      label: "ĐÃ BÁN",
      count: overviewStats.sold,
      color: "#EF4444",
    },
    {
      key: "deposit",
      label: "ĐÃ CỌC",
      count: overviewStats.deposit,
      color: "#3B82F6",
    },
  ];
  const buildOverviewData = (dataGrid: any) => {
    const floorsMap: Record<string, any> = {};

    dataGrid.forEach((block: any) => {
      block?.rawBlock?.floor?.forEach((floor: any) => {
        const floorKey = `${block.rawBlock.maKhu}_${floor.maTang}`;

        if (!floorsMap[floorKey]) {
          floorsMap[floorKey] = {
            id: floorKey,
            name: floor.tenTang,
            floorNumber: Number(floor.maTang),
            units: [],
          };
        }

        const units = (floor.detailFloor || []).map((item: any) => ({
          id: item.MaSP,
          code: item.KyHieu,
          price: item.GiaBan
            ? new Intl.NumberFormat("vi-VN").format(Math.round(item.GiaBan))
            : "",
          status: mapStatusByTT(item),
          column: String(item.MaVT),
        }));

        floorsMap[floorKey].units.push(...units);
      });
    });

    Object.values(floorsMap).forEach((floor: any) => {
      // column là uuid (vi_tri) → sắp theo chuỗi
      floor.units.sort((a: any, b: any) =>
        String(a.column).localeCompare(String(b.column))
      );
      floor.totalUnits = floor.units.length;
    });

    return Object.values(floorsMap);
  };

  const buildStatusSummary = (floors: any[]) => {
    const allUnits = floors.flatMap((f: any) => f.units);

    return [
      {
        key: "all",
        label: "TỔNG",
        count: allUnits.length,
        color: "#3B82F6",
      },
      {
        key: "available",
        label: "TRỐNG",
        count: allUnits.filter((u: any) => u.status === "available").length,
        color: "#22C55E",
      },
      {
        key: "deposit",
        label: "ĐÃ CỌC",
        count: allUnits.filter((u: any) => u.status === "deposit").length,
        color: "#3B82F6",
      },
      {
        key: "locked",
        label: "KHÓA",
        count: allUnits.filter((u: any) => u.status === "locked").length,
        color: "#555A64",
      },
      {
        key: "sold",
        label: "ĐÃ BÁN",
        count: allUnits.filter((u: any) => u.status === "sold").length,
        color: "#EF4444",
      },
      {
        key: "booking",
        label: "BOOKING",
        count: allUnits.filter((u: any) => u.status === "booking").length,
        color: "#CCCCCC",
      },
    ];
  };
  const renderOverviewView = () => {
    const floors = buildOverviewData(dataGrid);
    const statusSummaryItems = buildStatusSummary(floors);

    return (
      <View style={styles.overviewContainer}>
        {/* STATUS SUMMARY */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statusSummaryScroll}
          contentContainerStyle={styles.statusSummaryContent}
        >
          {statusSummaryItems.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.statusSummaryItem,
                { backgroundColor: item.color },
                selectedOverviewStatus === item.key &&
                  styles.statusSummaryItemActive,
              ]}
              onPress={() =>
                setSelectedOverviewStatus(item.key as UnitStatus | "all")
              }
              activeOpacity={0.8}
            >
              <Text style={styles.statusSummaryLabel}>{item.label}</Text>
              <Text style={styles.statusSummaryCount}>{item.count}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* FLOORS */}
        {floors.map((floor: any) => {
          const filteredUnits =
            selectedOverviewStatus === "all"
              ? floor.units
              : floor.units.filter(
                  (u: any) => u.status === selectedOverviewStatus
                );

          if (filteredUnits.length === 0) return null;

          return (
            <View key={String(floor.id)} style={styles.floorSection}>
              {/* HEADER */}
              <View style={styles.floorHeader}>
                <Text style={styles.floorName}>{floor.name}</Text>
                <Text style={styles.floorCount}>
                  ({filteredUnits.length}/{floor.totalUnits} CĂN)
                </Text>
              </View>

              {/* GRID */}
              <View style={styles.unitsGrid}>
                {filteredUnits.map((unit: any) => {
                  const config = statusConfig[unit.status as UnitStatus] || {};

                  return (
                    <TouchableOpacity
                      key={unit.id}
                      style={[
                        styles.unitCard,
                        {
                          backgroundColor: config.bgColor || "#ccc",
                        },
                      ]}
                      onPress={() => handlePressProduct(unit.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.unitCode} numberOfLines={1}>
                        {unit.code}
                      </Text>

                      {!!unit.price && (
                        <Text style={styles.unitPrice}>{unit.price}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    );
  };
  // const renderOverviewView = () => (
  //   <View style={styles.overviewContainer}>
  //     <ScrollView
  //       horizontal
  //       showsHorizontalScrollIndicator={false}
  //       style={styles.statusSummaryScroll}
  //       contentContainerStyle={styles.statusSummaryContent}
  //     >
  //       {statusSummaryItems.map((item) => (
  //         <TouchableOpacity
  //           key={item.key}
  //           style={[
  //             styles.statusSummaryItem,
  //             { backgroundColor: item.color },
  //             selectedOverviewStatus === item.key &&
  //               styles.statusSummaryItemActive,
  //           ]}
  //           onPress={() => setSelectedOverviewStatus(item.key)}
  //           activeOpacity={0.8}
  //         >
  //           <Text style={styles.statusSummaryLabel}>{item.label}</Text>
  //           <Text style={styles.statusSummaryCount}>{item.count}</Text>
  //         </TouchableOpacity>
  //       ))}
  //     </ScrollView>

  //     {currentOverviewBlock.floors.map((floor) => {
  //       const filteredUnits =
  //         selectedOverviewStatus === "all"
  //           ? floor.units
  //           : floor.units.filter((u) => u.status === selectedOverviewStatus);

  //       if (filteredUnits.length === 0) return null;

  //       return (
  //         <View key={floor.name} style={styles.floorSection}>
  //           <View style={styles.floorHeader}>
  //             <Text style={styles.floorName}>{floor.name}</Text>
  //             <Text style={styles.floorCount}>({floor.totalUnits} CĂN)</Text>
  //           </View>
  //           <View style={styles.unitsGrid}>
  //             {filteredUnits.map((unit) => {
  //               const config = statusConfig[unit.status];
  //               return (
  //                 <TouchableOpacity
  //                   key={unit.id}
  //                   style={[
  //                     styles.unitCard,
  //                     { backgroundColor: config.bgColor },
  //                   ]}
  //                   onPress={() => handlePressProduct(unit.id)}
  //                   activeOpacity={0.8}
  //                 >
  //                   <Text style={styles.unitCode} numberOfLines={1}>
  //                     {unit.code}
  //                   </Text>
  //                   <Text style={styles.unitPrice}>{unit.price}</Text>
  //                 </TouchableOpacity>
  //               );
  //             })}
  //           </View>
  //         </View>
  //       );
  //     })}
  //   </View>
  // );

  const renderGridView = () => {
    if (!dataGrid || dataGrid.length === 0) return null;

    return (
      <View style={styles.gridContainer}>
        {TrangThai?.length > 0 && (
          <View style={styles.statusLegend}>
            <View style={styles.legendItems}>
              {TrangThai.map((item) => (
                <View key={item.MaTT} style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: item.ColorWeb || "#ccc" },
                    ]}
                  />
                  <Text style={styles.legendText}>{item.TenTT}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {dataGrid.map((block) => (
          <BlockGrid
            key={block.rawBlock?.maKhu}
            block={block}
            leftRef={leftRef}
            rightRef={rightRef}
            scrollYRef={scrollYRef}
            localChange={localChange}
            handlePressProduct={handlePressProduct}
            getHexColor={getHexColor}
            styles={styles}
          />
        ))}
      </View>
    );
  };

  const formatCurrency = (num: any) => {
    if (!num) return "0 đ";
    return new Intl.NumberFormat("vi-VN").format(Math.round(num));
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Sản phẩm",
          headerStyle: {
            backgroundColor: Colors.background,
          },
          headerTintColor: Colors.text,
          headerTitleStyle: {
            fontWeight: "700",
            fontSize: 18,
          },
          headerShadowVisible: false,
          // Khi nhúng trong tab menu: không có nút back (đã ở root tab)
          headerLeft: embedded
            ? undefined
            : () => (
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={styles.headerBackButton}
                >
                  <ChevronLeft color={Colors.text} size={24} />
                </TouchableOpacity>
              ),
          headerRight: () => (
            <View style={styles.headerViewMode}>
              <TouchableOpacity
                style={[
                  styles.headerViewBtn,
                  viewMode === "list" && styles.headerViewBtnActive,
                ]}
                onPress={() => setViewMode("list")}
                activeOpacity={0.8}
              >
                <List
                  color={
                    viewMode === "list" ? Colors.white : Colors.textTertiary
                  }
                  size={18}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.headerViewBtn,
                  viewMode === "grid" && styles.headerViewBtnActive,
                ]}
                onPress={() => {
                  setViewMode("grid");
                  void handleFormGrid(filterCondition?.MaDA);
                }}
                activeOpacity={0.8}
              >
                <Grid3x3
                  color={
                    viewMode === "grid" ? Colors.white : Colors.textTertiary
                  }
                  size={18}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.headerViewBtn,
                  viewMode === "overview" && styles.headerViewBtnActive,
                ]}
                onPress={() => setViewMode("overview")}
                activeOpacity={0.8}
              >
                <LayoutDashboard
                  color={
                    viewMode === "overview" ? Colors.white : Colors.textTertiary
                  }
                  size={18}
                />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={300}
      >
        <View style={styles.searchAndFilterRow}>
          <View style={styles.searchContainer}>
            <Search color={Colors.textSecondary} size={20} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm theo mã sản phẩm, số căn hộ..."
              placeholderTextColor={Colors.textSecondary}
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={styles.filterButton}
            activeOpacity={0.7}
            onPress={() => setFilterExpanded(!filterExpanded)}
          >
            <Filter color={Colors.primary} size={18} />
            <Text style={styles.filterText}>Bộ lọc</Text>
            {filterExpanded ? (
              <ChevronUp color={Colors.primary} size={18} />
            ) : (
              <ChevronDown color={Colors.primary} size={18} />
            )}
          </TouchableOpacity>
        </View>

        {filterExpanded && (
          <View style={styles.filterPanel}>
            <View style={styles.filterSection}>
              <View style={styles.filterSectionHeader}>
                <Text style={styles.filterSectionTitle}>Dự án</Text>
                <TouchableOpacity
                  style={[
                    styles.resetFilterButton,
                    isFilterChanged && styles.resetFilterButtonHighlight,
                  ]}
                  disabled={!isFilterChanged}
                  onPress={() => {
                    // Reset toàn bộ bộ lọc về mặc định
                    const firstProject = duAn?.[0];
                    const defaultMaDA =
                      firstProject?.MaDA ?? (Number(MaDA) || null);
                    const resetFilter = {
                      MaDA: defaultMaDA,
                      MaKhu: null,
                      MaPK: null,
                      MaTT: null,
                      FormCode: null,
                      KyHieu: "",
                    };
                    setFilterCondition(resetFilter);
                    setSearchQuery("");
                    void loadProducts2(resetFilter);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.resetFilterText,
                      isFilterChanged && styles.resetFilterTextHighlight,
                    ]}
                  >
                    Đặt lại
                  </Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 200 }}>
                <View style={styles.filterOptionsGrid}>
                  {duAn.map((project) => (
                    <TouchableOpacity
                      key={project?.MaDA}
                      style={[
                        styles.filterOption,
                        filterCondition?.MaDA === project?.MaDA &&
                          styles.filterOptionActive,
                      ]}
                      onPress={() => {
                        applyChangeFilter("MaDA", project?.MaDA);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          filterCondition?.MaDA === project?.MaDA &&
                            styles.filterOptionTextActive,
                        ]}
                      >
                        {project?.TenDA}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Khu Vực</Text>
              <ScrollView style={{ maxHeight: 200 }}>
                <View style={styles.filterOptionsGrid}>
                  {khuVuc.map((project) => (
                    <TouchableOpacity
                      key={project?.MaKhu}
                      style={[
                        styles.filterOption,
                        filterCondition?.MaKhu === project?.MaKhu &&
                          styles.filterOptionActive,
                      ]}
                      onPress={() => {
                        applyChangeFilter("MaKhu", project?.MaKhu);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          filterCondition?.MaKhu === project?.MaKhu &&
                            styles.filterOptionTextActive,
                        ]}
                      >
                        {project?.TenKhu}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Cao tầng / Thấp tầng — form_code: CAOTANG | THAPTANG | null */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Loại sản phẩm</Text>
              <View style={styles.filterOptionsGrid}>
                {[
                  { key: null, label: "Tất cả" },
                  { key: "CAOTANG", label: "Cao tầng" },
                  { key: "THAPTANG", label: "Thấp tầng" },
                ].map((opt) => (
                  <TouchableOpacity
                    key={String(opt.key)}
                    style={[
                      styles.filterOption,
                      filterCondition?.FormCode === opt.key &&
                        styles.filterOptionActive,
                    ]}
                    onPress={() => {
                      setFilterCondition((prev) => ({
                        ...prev,
                        FormCode: opt.key,
                      }));
                      void loadProducts2({
                        ...filterCondition,
                        FormCode: opt.key,
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        filterCondition?.FormCode === opt.key &&
                          styles.filterOptionTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Trạng thái</Text>
              <View style={styles.filterOptionsGrid}>
                <TouchableOpacity
                  key={null}
                  style={[
                    styles.filterOption,
                    filterCondition?.MaTT === null && styles.filterOptionActive,
                  ]}
                  onPress={() => {
                    applyChangeFilter("TrangThai", null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      filterCondition?.MaTT === null &&
                        styles.filterOptionTextActive,
                    ]}
                  >
                    Tất cả
                  </Text>
                </TouchableOpacity>
                {TrangThai.map((status) => (
                  <TouchableOpacity
                    key={status.MaTT}
                    style={[
                      styles.filterOption,
                      filterCondition?.MaTT === status.MaTT &&
                        styles.filterOptionActive,
                    ]}
                    onPress={() => {
                      applyChangeFilter("TrangThai", status.MaTT);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        filterCondition?.MaTT === status.MaTT &&
                          styles.filterOptionTextActive,
                      ]}
                    >
                      {status.TenTT}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {viewMode === "list" ? (
          <>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
              </View>
            ) : (
              <View style={styles.productTable}>
                <View style={styles.tableHeader}>
                  <View style={[styles.colStatus]}>
                    <Text>Trạng thái</Text>
                  </View>
                  <View style={[styles.colCode]}>
                    <Text>Mã sản phẩm</Text>
                  </View>
                  <View style={[styles.colPrice]}>
                    <Text style={[styles.priceHeaderText]}>
                      Tổng giá trị gồm PBT
                    </Text>
                  </View>
                </View>

                {products2.map((product, index) => (
                  <TouchableOpacity
                    key={`${product.MaSP}-${index}`}
                    style={[
                      styles.tableRow,
                      index % 2 === 1 && styles.tableRowAlt,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handlePressProduct(product.MaSP)}
                  >
                    <View
                      style={[styles.colStatus, styles.statusBadgeContainer]}
                    >
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: getStatusColor(product.MaTT) },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            {
                              color: getStatusTextColor(
                                getStatusColor(product.MaTT)
                              ),
                            },
                          ]}
                        >
                          {getStatusLabel(product.MaTT)}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.colCode]}>
                      {product.KyHieu || product.MaSP}
                    </Text>
                    <Text
                      style={[styles.colPrice, styles.priceText]}
                      numberOfLines={
                        Number(product?.TongGomPBT || 0) < 99_000_000_000
                          ? 1
                          : 0
                      }
                      adjustsFontSizeToFit={
                        Number(product?.TongGomPBT || 0) < 99_000_000_000
                      }
                      minimumFontScale={0.8}
                    >
                      {formatCurrency(product?.TongGomPBT)}
                    </Text>
                  </TouchableOpacity>
                ))}

                {products2.length === 0 && (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      Không tìm thấy sản phẩm phù hợp
                    </Text>
                  </View>
                )}
              </View>
            )}

            {!loading && (
              <View style={styles.footerContainer}>
                {loadingMore ? (
                  <View style={styles.footerLoading}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.footerText}>Đang tải thêm...</Text>
                  </View>
                ) : !hasMore && products2.length > 0 ? (
                  <Text style={styles.footerText}>
                    Đã hiển thị tất cả sản phẩm
                  </Text>
                ) : null}
              </View>
            )}
          </>
        ) : viewMode === "grid" ? (
          renderGridView()
        ) : (
          renderOverviewView()
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerBackButton: {
    marginLeft: 8,
  },
  headerViewMode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginRight: 8,
  },
  headerViewBtn: {
    padding: 6,
    borderRadius: 6,
  },
  headerViewBtnActive: {
    backgroundColor: Colors.primary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 15,
    // Chừa chỗ cho tab bar phía dưới để nội dung (đặc biệt lưới Sản phẩm)
    // không bị che và cuộn được đến hàng cuối cùng
    paddingBottom: 100,
  },
  searchAndFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  viewModeLabel: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: "500" as const,
  },
  viewModeContainer: {
    flexDirection: "row",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  viewModeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: Colors.white,
  },
  viewModeButtonLeft: {
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  viewModeButtonMiddle: {
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  viewModeButtonRight: {},
  viewModeButtonActive: {
    backgroundColor: Colors.primary,
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  viewModeTextActive: {
    color: Colors.white,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  filterText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.primary,
  },
  productCount: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  productCountBold: {
    fontWeight: "700" as const,
    color: Colors.primary,
  },

  productTable: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    paddingVertical: 10,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    alignItems: "center",
  },
  colStatus: {
    width: 110,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingHorizontal: 8,
  },
  colCode: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  colPrice: {
    width: 130,
    paddingHorizontal: 8,
    textAlign: "right",
  },
  priceHeaderText: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: "right",
  },
  statusBadgeContainer: {
    alignItems: "flex-start",
  },
  statusBadge: {
    alignSelf: "flex-start" as const,
    maxWidth: "80%",
    flexShrink: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "600" as const,
    color: Colors.white,
  },
  priceText: {
    fontSize: 14,
    fontWeight: "600" as const,
    fontVariant: ["tabular-nums"] as const,
  },
  tableRowAlt: {
    backgroundColor: "#FCFCFD",
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: "center" as const,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  filterPanel: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  filterSectionTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.text,
    marginBottom: 12,
  },
  resetFilterButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    opacity: 0.6,
  },
  resetFilterButtonHighlight: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    opacity: 1,
  },
  resetFilterText: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: "#9CA3AF",
  },
  resetFilterTextHighlight: {
    color: Colors.white,
  },
  filterOptionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  filterOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: Colors.text,
  },
  filterOptionTextActive: {
    color: Colors.white,
  },
  gridContainer: {
    gap: 20,
  },
  statusLegend: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  legendTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.text,
    marginBottom: 12,
  },
  legendItems: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 14,
    color: Colors.text,
  },
  blockCard: {
    backgroundColor: "#FEF7F3",
    borderRadius: 12,
    // padding: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  blockTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
    // marginBottom: 16,
    padding: 10,
  },
  grid: {
    gap: 8,
  },
  gridRow: {
    flexDirection: "row",
    gap: 3,
    marginBottom: 3,
    height: 45,
  },
  gridCell: {
    // flex: 1,
    // aspectRatio: 1,
    width: 45,
    height: 45,
    justifyContent: "center",
    alignItems: "center",
  },

  headerCell: {
    backgroundColor: "#F3E8DC",
    borderRadius: 6,
  },
  headerCellText: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  floorCell: {
    backgroundColor: "#E8EAF6",
    borderRadius: 6,
  },
  floorCellText: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  unitCell: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
  },
  unitCellText: {
    fontSize: 9,
    fontWeight: "700" as const,
    color: "#333",
  },
  emptyCell: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emptyCellText: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  blockNavigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  navButton: {
    padding: 8,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  progressBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D1D5DB",
    flex: 1,
    maxWidth: 60,
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
  },
  blockStats: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center" as const,
    marginTop: 15,
  },
  overviewContainer: {
    gap: 16,
  },
  statusSummaryScroll: {
    marginBottom: 4,
  },
  statusSummaryContent: {
    gap: 8,
    paddingVertical: 2,
  },
  statusSummaryItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center" as const,
    minWidth: 72,
  },
  statusSummaryItemActive: {
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  statusSummaryLabel: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "#FFFFFF",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  statusSummaryCount: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: "#FFFFFF",
  },
  floorSection: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  floorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 6,
  },
  floorName: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  floorCount: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: Colors.textSecondary,
  },
  unitsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 8,
    gap: 6,
  },
  unitCard: {
    width: "23%" as unknown as number,
    flexBasis: "23%" as unknown as number,
    flexGrow: 0,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  unitCode: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#FFFFFF",
    marginBottom: 2,
  },
  unitPrice: {
    fontSize: 10,
    fontWeight: "500" as const,
    color: "rgba(255,255,255,0.85)",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 100,
  },

  loadingText: {
    marginTop: 10,
    color: Colors.textSecondary,
  },
  footerContainer: {
    paddingVertical: 20,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  footerLoading: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  footerText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  disabledCell: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E5E7EB",
    borderRadius: 6,
  },

  disabledText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
});
