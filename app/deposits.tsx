import React, { useCallback } from "react";
import { useRouter } from "expo-router";

import { SalesDocList, StatusOption } from "@/components/sales/SalesDocList";
import { Avatar, ListItem, MoneyText, StatusBadge } from "@/components/ui";
import { foldVietnamese, formatDate } from "@/lib/format";
import { DatCocService } from "@/sevicesSupabase/DatCocService";

/**
 * Bộ lọc màn Đặt cọc chỉ hiện "Đặt cọc chờ duyệt" và "Đặt cọc đã duyệt" (giữ như màn cũ);
 * lọc vẫn truyền MaTT xuống fn_deposit_list.
 */
function isVisibleDepositStatus(s: StatusOption): boolean {
  const n = foldVietnamese(s.TenTT);
  return n.includes("dat coc") && (n.includes("cho duyet") || n.includes("da duyet"));
}

/** Danh sách đặt cọc – dữ liệu fn_deposit_list như web (DepositListService). */
export default function DepositsScreen({ embedded }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const fetchPage = useCallback((f: any) => DatCocService.get(f), []);
  const fetchStatuses = useCallback(() => DatCocService.getTT({}), []);

  const renderRow = useCallback(
    (item: any) => (
      <ListItem
        leading={<Avatar name={item.KhachHang || "?"} />}
        title={item.KhachHang || "—"}
        subtitle={[item.MaSanPham, item.TenDA].filter(Boolean).join(" · ") || undefined}
        meta={[item.SoPhieu, formatDate(item.NgayDatCoc)].filter(Boolean).join(" · ")}
        trailing={
          <>
            <MoneyText value={item.TienCoc} short />
            {item.TenTT ? <StatusBadge label={item.TenTT} color={item.MauNen} /> : null}
          </>
        }
        onPress={() =>
          router.push({ pathname: "/deposit/[id]", params: { id: String(item.MaPDC ?? item.ID), data: JSON.stringify(item) } })
        }
      />
    ),
    [router]
  );

  return (
    <SalesDocList
      title="Đặt cọc"
      embedded={embedded}
      searchPlaceholder="Số phiếu, khách hàng, căn…"
      emptyTitle="Chưa có phiếu đặt cọc"
      emptyDescription="Phiếu đặt cọc được lập từ booking đã duyệt."
      fetchPage={fetchPage}
      fetchStatuses={fetchStatuses}
      statusFilter={isVisibleDepositStatus}
      renderRow={renderRow}
      keyOf={(item, i) => `${item.MaPDC ?? item.ID ?? "dc"}-${i}`}
    />
  );
}
