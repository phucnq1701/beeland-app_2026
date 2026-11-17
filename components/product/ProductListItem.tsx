import React, { memo } from "react";
import { StyleSheet, View } from "react-native";

import { ListItem, MoneyText, StatusBadge } from "@/components/ui";
import { formatArea } from "@/lib/format";
import { colors, elevation, radius, space } from "@/theme";

type Props = {
  product: any;
  statusLabel: string;
  statusColor: string | null;
  onPress: (id: string) => void;
};

/** Card sản phẩm bo tròn: ký hiệu căn, khu · diện tích · dự án, trạng thái (màu từ danh mục), giá nếu căn có giá riêng. */
function ProductListItemBase({ product, statusLabel, statusColor, onPress }: Props) {
  const code = product?.KyHieu || product?.MaSP || "—";
  return (
    // Bóng ở lớp ngoài, bo + cắt ở lớp trong (iOS: overflow hidden làm mất bóng)
    <View style={styles.card}>
      <View style={styles.clip}>
        <ListItem
          title={String(code)}
          subtitle={
            [product?.TenKhu, Number(product?.DienTichThongThuy) > 0 ? formatArea(product.DienTichThongThuy) : null, product?.TenDA]
              .filter(Boolean)
              .join(" · ") || undefined
          }
          accessibilityLabel={`Căn ${code}${statusLabel ? ", " + statusLabel : ""}`}
          trailing={
            <>
              {statusLabel ? (
                // Bọc lại để badge căn phải (Badge tự alignSelf flex-start)
                <View style={styles.badge}>
                  <StatusBadge label={statusLabel} color={statusColor} />
                </View>
              ) : null}
              {/* Giá căn phần lớn nằm ở bảng giá (xem ở chi tiết) ⇒ chỉ hiện khi căn có giá riêng; không "Liên hệ" / "0 đ" */}
              {Number(product?.TongGomPBT) > 0 ? <MoneyText value={product?.TongGomPBT} short variant="subhead" /> : null}
            </>
          }
          onPress={() => onPress(product?.MaSP)}
        />
      </View>
    </View>
  );
}

export const ProductListItem = memo(ProductListItemBase);

const styles = StyleSheet.create({
  card: { marginHorizontal: space.xl, borderRadius: radius.xxl, backgroundColor: colors.surface, ...elevation.soft },
  clip: { borderRadius: radius.xxl, overflow: "hidden" },
  badge: { alignSelf: "flex-end" },
});
