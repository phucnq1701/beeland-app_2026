import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Building2 } from "lucide-react-native";

import { Button, EmptyState, SearchBar, SegmentedControl, SelectField, StatusBadge, Text } from "@/components/ui";
import { formatArea } from "@/lib/format";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { ProductService } from "@/sevicesSupabase/ProductService";
import { ProjectService } from "@/sevicesSupabase/ProjectService";
import { colors, elevation, radius, space } from "@/theme";

const PAGE = 30;

/**
 * Chọn căn để lập phiếu – như PriceSheetProductPicker của web: chọn dự án + loại (cao tầng / thấp tầng),
 * tìm theo ký hiệu / mã / số căn, phân trang ở máy chủ. Trả uuid sản phẩm.
 */
export function ProductPicker({ onPick }: { onPick: (productId: string) => void }) {
  const [projects, setProjects] = useState<{ value: string; label: string }[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [type, setType] = useState<"CAOTANG" | "THAPTANG">("CAOTANG");
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const version = useRef(0);

  useEffect(() => {
    ProjectService.getProjects({ limit: 200 })
      .then((r: any) => {
        const list = (r?.data ?? [])
          .filter((p: any) => p?.id)
          .map((p: any) => ({ value: String(p.id), label: p.TenDA || p.ten_da || "Dự án" }));
        setProjects(list);
        if (list.length === 1) setProjectId(list[0].value);
      })
      .catch(() => setProjects([]));
  }, []);

  const fetch = async (more: boolean) => {
    if (!projectId) return;
    const v = more ? version.current : ++version.current;
    setLoading(true);
    try {
      const res: any = await ProductService.getProducts({
        MaDA: projectId,
        FormCode: type,
        InputSearch: debounced.trim(),
        Limit: PAGE,
        offSet: (more ? rows.length : 0) + 1,
      });
      if (v !== version.current) return;
      const data = res?.data ?? [];
      setRows((prev) => (more ? [...prev, ...data] : data));
      setTotal(Number(res?.total ?? data.length));
    } finally {
      if (v === version.current) setLoading(false);
    }
  };

  useEffect(() => {
    setRows([]);
    setTotal(0);
    void fetch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, type, debounced]);

  return (
    <View style={styles.wrap}>
      <SelectField
        label="Dự án"
        required
        value={projectId}
        options={projects}
        onChange={setProjectId}
        placeholder="Chọn dự án"
        sheetTitle="Chọn dự án"
        variant="raised"
      />
      <SegmentedControl
        variant="soft"
        value={type}
        onChange={setType}
        options={[
          { value: "CAOTANG", label: "Cao tầng" },
          { value: "THAPTANG", label: "Thấp tầng" },
        ]}
      />
      {projectId ? <SearchBar value={query} onChangeText={setQuery} placeholder="Ký hiệu, mã căn…" variant="soft" /> : null}

      {!projectId ? (
        <EmptyState icon={Building2} title="Chọn dự án" description="Chọn dự án để xem danh sách căn." />
      ) : !loading && rows.length === 0 ? (
        <EmptyState icon={Building2} title="Không có căn phù hợp" description="Thử đổi loại hoặc từ khoá." />
      ) : (
        <View style={styles.card}>
          {rows.map((p, i) => (
            <Pressable
              key={`${p.ID}-${i}`}
              accessibilityRole="button"
              accessibilityLabel={`Chọn căn ${p.KyHieu || p.MaSP}`}
              onPress={() => p.ID && onPick(String(p.ID))}
              style={({ pressed }) => [styles.row, i < rows.length - 1 ? styles.divider : null, pressed ? styles.pressed : null]}
            >
              <View style={styles.flex}>
                <Text variant="subhead" numberOfLines={1}>
                  {p.KyHieu || p.MaSP || "—"}
                </Text>
                <Text variant="caption" color="textSecondary" numberOfLines={1}>
                  {[p.TenKhu, p.DienTichThongThuy ? `${formatArea(p.DienTichThongThuy)} m²` : null].filter(Boolean).join(" · ") ||
                    " "}
                </Text>
              </View>
              {p.TenTT ? <StatusBadge label={p.TenTT} color={p.ColorTT} size="sm" /> : null}
            </Pressable>
          ))}
          {loading ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : null}
        </View>
      )}
      {!loading && rows.length > 0 && rows.length < total ? (
        <Button title="Tải thêm" variant="secondary" onPress={() => void fetch(true)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  flex: { flex: 1 },
  card: { borderRadius: radius.xxl, backgroundColor: colors.surface, ...elevation.soft, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56, paddingHorizontal: space.lg + 2, paddingVertical: space.sm },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pressed: { backgroundColor: colors.surfaceMuted },
  loader: { paddingVertical: space.lg },
});
