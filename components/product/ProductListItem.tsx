import React, { memo } from "react";
import { StyleSheet, View } from "react-native";

import { ListItem, MoneyText, StatusBadge } from "@/components/ui";
import { colors, elevation, radius, space } from "@/theme";

type Props = {
  product: any;
  statusLabel: string;
  statusColor: string | null;
  onPress: (id: string) => void;
};

/** Card sản phẩm bo tròn: ký hiệu căn, tổng giá gồm PBT, trạng thái (màu từ danh mục). */
function ProductListItemBase({ product, statusLabel, statusColor, onPress }: Props) {
  const code = product?.KyHieu || product?.MaSP || "—";
  return (
    // Bóng ở lớp ngoài, bo + cắt ở lớp trong (iOS: overflow hidden làm mất bóng)
    <View style={styles.card}>
      <View style={styles.clip}>
        <ListItem
          title={String(code)}
          subtitle={[product?.TenKhu, product?.TenDA].filter(Boolean).join(" · ") || undefined}
          accessibilityLabel={`Căn ${code}${statusLabel ? ", " + statusLabel : ""}`}
          trailing={
            <>
              {statusLabel ? (
                // Bọc lại để badge căn phải (Badge tự alignSelf flex-start)
                <View style={styles.badge}>
                  <StatusBadge label={statusLabel} color={statusColor} />
                </View>
              ) : null}
              <MoneyText value={product?.TongGomPBT} short variant="subhead" />
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
