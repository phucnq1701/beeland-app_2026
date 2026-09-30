import React, { memo } from "react";

import { ListItem, MoneyText, StatusBadge } from "@/components/ui";

type Props = {
  product: any;
  statusLabel: string;
  statusColor: string | null;
  onPress: (id: string) => void;
};

/** Dòng sản phẩm: ký hiệu căn, tổng giá gồm PBT, trạng thái (màu từ danh mục). */
function ProductListItemBase({ product, statusLabel, statusColor, onPress }: Props) {
  const code = product?.KyHieu || product?.MaSP || "—";
  return (
    <ListItem
      title={String(code)}
      subtitle={[product?.TenKhu, product?.TenDA].filter(Boolean).join(" · ") || undefined}
      accessibilityLabel={`Căn ${code}${statusLabel ? ", " + statusLabel : ""}`}
      trailing={
        <>
          <MoneyText value={product?.TongGomPBT} />
          {statusLabel ? <StatusBadge label={statusLabel} color={statusColor} /> : null}
        </>
      }
      onPress={() => onPress(product?.MaSP)}
    />
  );
}

export const ProductListItem = memo(ProductListItemBase);
