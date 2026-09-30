import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  Stack,
  useRouter,
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";
import { Palette, SearchX } from "lucide-react-native";
import {
  FilterPanel,
  FilterSection,
  FilterToggleButton,
} from "@/components/FilterPanel";
import BlockGrid from "@/components/product/BlockGrid";
import { OverviewView } from "@/components/product/OverviewView";
import { ProductListItem } from "@/components/product/ProductListItem";
import {
  AppHeader,
  BottomSheet,
  Button,
  EmptyState,
  IconButton,
  Screen,
  SearchBar,
  SegmentedControl,
  SkeletonList,
  Text,
} from "@/components/ui";
import { SummaryKey } from "@/lib/productOverview";
import { applyRealtimeChange, resolveCatalogStatus, unitStatusOf } from "@/lib/productRealtime";
import { colors, space } from "@/theme";
import { ProductService } from "@/sevicesSupabase/ProductService";
import { ProjectService } from "@/sevicesSupabase/ProjectService";
import { FilterService } from "@/sevicesSupabase/FilterService";
import { PriceServices } from "@/sevicesSupabase/PriceServices";

import * as signalR from "@microsoft/signalr";

type ViewMode = "list" | "grid" | "overview";

/** Màu lưu dạng số nguyên (ARGB) trong dữ liệu → chuỗi hex. Ngoài component để tham chiếu ổn định. */
const getHexColor = (number: any) => {
  if (number === null || number === undefined) return colors.surfaceMuted;
  return `#${(Number(number) >>> 0).toString(16).slice(-6)}`;
};

// Số sản phẩm mỗi lần gọi API (phân trang cuộn vô hạn)
const PAGE_SIZE = 16;
/** Chừa chỗ cho tab bar nổi khi màn được nhúng trong tab menu. */
const TAB_BAR_SPACE = 100;

export default function ProductsScreen({
  embedded,
}: { embedded?: boolean } = {}) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filterExpanded, setFilterExpanded] = useState<boolean>(false);
  const [legendOpen, setLegendOpen] = useState<boolean>(false);
  const [selectedOverviewStatus, setSelectedOverviewStatus] = useState<SummaryKey>("all");
  const router = useRouter();
  const { MaDA } = useLocalSearchParams();


  const [products2, setProducts2] = useState<any[]>([]);
  const [duAn, setDuAn] = useState<any[]>([]);
  const [khuVuc, setKhuVuc] = useState<any[]>([]);
  const [TrangThai, setTrangThai] = useState<any[]>([]);
  const trangThaiRef = useRef<any[]>([]);
  trangThaiRef.current = TrangThai;
  const [dataGrid, setDataGrid] = useState<any[]>([]);
  // Bản mới nhất cho handler realtime (đăng ký một lần, tránh closure cũ)
  const dataGridRef = useRef<any[]>([]);
  dataGridRef.current = dataGrid;
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
        // Tra trạng thái mới theo mã/uuid trong danh mục → cập nhật cả tên và màu (lib/productRealtime).
        // Danh mục + lưới đọc qua ref vì handler chỉ đăng ký một lần.
        const catalog = trangThaiRef.current;
        const entry = resolveCatalogStatus(response?.maTT, catalog);
        const { changedMaSP } = applyRealtimeChange(dataGridRef.current, response, catalog);

        setDataGrid((prev) => applyRealtimeChange(prev, response, catalog).grid);

        // Danh sách: đổi trạng thái đúng dòng của căn vừa đổi
        if (changedMaSP && entry) {
          setProducts2((list) =>
            list.map((p) => (p?.MaSP === changedMaSP ? { ...p, MaTT: entry.MaTT } : p))
          );
        }
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
  // MaTT là uuid → nhóm trạng thái theo MÃ danh mục (fallback theo tên) – lib/productRealtime
  const mapStatusByTT = (item: any) => unitStatusOf(item, trangThaiRef.current);

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
      // (bộ đếm bộ lọc không tính dự án ban đầu)
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
    // Danh sách rỗng trong lúc tải lại (lọc/tìm/làm mới) cũng kích hoạt onEndReached → bỏ qua,
    // tránh gửi thêm một request trang 1 song song như bản cuộn cũ không có
    if (loading || products2.length === 0) return;
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

  // Chỉ load mặc định khi mount lần đầu
  useEffect(() => {
    void loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    }, []),
  );


  const getStatusLabel = (status: number) => {
    const item = TrangThai.find((i) => i.MaTT === status);
    return item?.TenTT || "";
  };

  const getStatusColor = (status: number): string | null => {
    const item = TrangThai.find((i) => i.MaTT === status);
    return item?.ColorWeb || null;
  };

  // useCallback: truyền xuống BlockGrid/UnitCell (memo) – tránh vẽ lại mọi ô khi có sự kiện realtime
  const handlePressProduct = useCallback(
    (id: string) => {
      console.log("[Products] Navigate to product detail", { id });
      router.push({ pathname: "/product/[id]", params: { id } });
    },
    [router]
  );


  // Số nhóm lọc đang khác mặc định (hiện badge trên nút Bộ lọc)
  const getDefaultMaDA = () => {
    const initial = defaultFilterRef.current.MaDA;
    return initial != null && initial !== -1
      ? initial
      : (duAn?.[0]?.MaDA ?? (Number(MaDA) || null));
  };

  const activeFilterCount = useMemo(() => {
    const defaultMaDA = getDefaultMaDA();
    return [
      filterCondition?.MaDA != null && filterCondition.MaDA !== defaultMaDA,
      filterCondition?.MaKhu != null,
      filterCondition?.FormCode != null,
      filterCondition?.MaTT != null,
    ].filter(Boolean).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCondition, duAn, MaDA]);

  // Reset toàn bộ bộ lọc về mặc định
  const resetFilters = () => {
    const resetFilter = {
      MaDA: getDefaultMaDA(),
      MaKhu: null,
      MaPK: null,
      MaTT: null,
      FormCode: null,
      KyHieu: "",
    };
    setFilterCondition(resetFilter);
    setSearchQuery("");
    void loadProducts2(resetFilter);
  };

  const switchViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    // Lưới cần dữ liệu khối mới nhất như bản cũ
    if (mode === "grid") void handleFormGrid(filterCondition?.MaDA);
  };

  const renderProduct = useCallback(
    ({ item }: { item: any }) => (
      <ProductListItem
        product={item}
        statusLabel={getStatusLabel(item.MaTT)}
        statusColor={getStatusColor(item.MaTT)}
        onPress={handlePressProduct}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [TrangThai]
  );

  const listHeader = (
    <View style={styles.stickyHeader}>
      <SearchBar
        value={searchQuery}
        onChangeText={handleSearchChange}
        placeholder="Mã sản phẩm, số căn hộ"
      />

      {filterExpanded && (
        <FilterPanel activeCount={activeFilterCount} onReset={resetFilters}>
          <FilterSection
            title="Dự án"
            options={duAn.map((project: any) => ({
              key: project?.MaDA,
              label: project?.TenDA,
              selected: filterCondition?.MaDA === project?.MaDA,
              onPress: () => applyChangeFilter("MaDA", project?.MaDA),
            }))}
          />
          {khuVuc?.length > 0 && (
            <FilterSection
              title="Khu vực"
              options={[
                {
                  key: "__all__",
                  label: "Tất cả",
                  selected: filterCondition?.MaKhu == null,
                  onPress: () => applyChangeFilter("MaKhu", null),
                },
                ...khuVuc.map((kv: any) => ({
                  key: kv?.MaKhu,
                  label: kv?.TenKhu,
                  selected: filterCondition?.MaKhu === kv?.MaKhu,
                  onPress: () => applyChangeFilter("MaKhu", kv?.MaKhu),
                })),
              ]}
            />
          )}
          {/* Cao tầng / Thấp tầng — form_code: CAOTANG | THAPTANG | null */}
          <FilterSection
            title="Loại sản phẩm"
            options={[
              { key: null, label: "Tất cả" },
              { key: "CAOTANG", label: "Cao tầng" },
              { key: "THAPTANG", label: "Thấp tầng" },
            ].map((opt) => ({
              key: String(opt.key),
              label: opt.label,
              selected: filterCondition?.FormCode === opt.key,
              onPress: () => {
                setFilterCondition((prev) => ({
                  ...prev,
                  FormCode: opt.key,
                }));
                void loadProducts2({
                  ...filterCondition,
                  FormCode: opt.key,
                });
              },
            }))}
          />
          <FilterSection
            title="Trạng thái"
            options={[
              {
                key: "__all__",
                label: "Tất cả",
                selected: filterCondition?.MaTT == null,
                onPress: () => applyChangeFilter("TrangThai", null),
              },
              ...TrangThai.map((status: any) => ({
                key: status.MaTT,
                label: status.TenTT,
                selected: filterCondition?.MaTT === status.MaTT,
                color: status.ColorWeb,
                onPress: () => applyChangeFilter("TrangThai", status.MaTT),
              })),
            ]}
          />
        </FilterPanel>
      )}

      <SegmentedControl
        value={viewMode}
        onChange={switchViewMode}
        options={[
          { value: "list", label: "Danh sách" },
          { value: "grid", label: "Lưới" },
          { value: "overview", label: "Tổng quan" },
        ]}
      />
    </View>
  );

  const listEmpty = loading ? (
    <SkeletonList />
  ) : (
    <EmptyState
      icon={SearchX}
      title="Không tìm thấy sản phẩm phù hợp"
      description="Thử đổi từ khoá hoặc bỏ bớt bộ lọc."
      actionLabel={activeFilterCount > 0 || searchQuery ? "Xoá bộ lọc" : undefined}
      onAction={activeFilterCount > 0 || searchQuery ? resetFilters : undefined}
    />
  );

  const listFooter =
    viewMode === "list" && !loading ? (
      loadingMore ? (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text variant="caption" color="textSecondary">
            Đang tải thêm...
          </Text>
        </View>
      ) : !hasMore && products2.length > 0 ? (
        <View style={styles.footer}>
          <Text variant="caption" color="textTertiary">
            Đã hiển thị tất cả sản phẩm
          </Text>
        </View>
      ) : null
    ) : null;

  const bottomPad = { paddingBottom: embedded ? TAB_BAR_SPACE : space.xxl };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        scroll={false}
        padded={false}
        header={
          <AppHeader
            title="Sản phẩm"
            // Khi nhúng trong tab menu: không có nút back (đã ở root tab)
            hideBack={embedded}
            actions={
              <View style={styles.headerActions}>
                {viewMode === "grid" && TrangThai?.length > 0 ? (
                  <IconButton icon={Palette} accessibilityLabel="Chú thích màu trạng thái" onPress={() => setLegendOpen(true)} />
                ) : null}
                <FilterToggleButton
                  open={filterExpanded}
                  activeCount={activeFilterCount}
                  onPress={() => setFilterExpanded(!filterExpanded)}
                />
              </View>
            }
          />
        }
      >
        {viewMode === "list" ? (
          <FlatList
            data={loading ? [] : products2}
            keyExtractor={(item, index) => `${item?.MaSP}-${index}`}
            renderItem={renderProduct}
            ItemSeparatorComponent={Separator}
            ListHeaderComponent={listHeader}
            stickyHeaderIndices={[0]}
            ListEmptyComponent={listEmpty}
            ListFooterComponent={listFooter}
            onEndReached={() => void loadMore()}
            onEndReachedThreshold={0.4}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={bottomPad}
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={() => void loadProducts2(filterConditionRef.current)}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          />
        ) : (
          <ScrollView
            stickyHeaderIndices={[0]}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={bottomPad}
          >
            {listHeader}
            <View style={styles.body}>
              {viewMode === "grid" ? (
                dataGrid?.length ? (
                  dataGrid.map((block) => (
                    <BlockGrid
                      key={block.rawBlock?.maKhu}
                      block={block}
                      localChange={localChange}
                      handlePressProduct={handlePressProduct}
                      getHexColor={getHexColor}
                    />
                  ))
                ) : (
                  <EmptyState title="Chưa có sơ đồ căn" description="Dự án/khu đang chọn chưa có dữ liệu lưới." />
                )
              ) : (
                <OverviewView
                  dataGrid={dataGrid}
                  catalog={TrangThai}
                  selected={selectedOverviewStatus}
                  onSelect={setSelectedOverviewStatus}
                  onPressUnit={handlePressProduct}
                />
              )}
            </View>
          </ScrollView>
        )}
      </Screen>

      {/* Chú thích màu trạng thái (thay khối thu/mở cũ) */}
      <BottomSheet visible={legendOpen} onClose={() => setLegendOpen(false)} title="Chú thích trạng thái">
        <ScrollView>
          {TrangThai.map((item: any) => (
            <View key={item.MaTT} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: item.ColorWeb || colors.surfaceMuted }]} />
              <Text variant="body">{item.TenTT}</Text>
            </View>
          ))}
        </ScrollView>
        <Button variant="secondary" title="Đóng" fullWidth onPress={() => setLegendOpen(false)} style={styles.legendClose} />
      </BottomSheet>
    </>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: "row", alignItems: "center", gap: space.xs, paddingRight: space.sm },
  stickyHeader: {
    backgroundColor: colors.bg,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    gap: space.md,
  },
  body: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.md },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: space.lg },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: space.sm, paddingVertical: space.lg },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  legendDot: { width: 16, height: 16, borderRadius: 8 },
  legendClose: { marginTop: space.md },
});
