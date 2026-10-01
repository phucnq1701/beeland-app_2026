import React, { useCallback } from "react";
import { useRouter } from "expo-router";

import { SalesDocList } from "@/components/sales/SalesDocList";
import { Avatar, ListItem, MoneyText, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { HopDongService } from "@/sevicesSupabase/HopDongService";

/** Danh sách hợp đồng mua bán – dữ liệu fn_contract_list như web (ContractListService). */
export default function ContractsScreen({ embedded }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const fetchPage = useCallback((f: any) => HopDongService.get(f), []);
  const fetchStatuses = useCallback(() => HopDongService.getTT({}), []);

  const renderRow = useCallback(
    (item: any) => (
      <ListItem
        leading={<Avatar name={item.TenKH || "?"} />}
        title={item.TenKH || "—"}
        subtitle={[item.KyHieu, item.TenDA].filter(Boolean).join(" · ") || undefined}
        meta={[item.SoHDMB, item.NgayKy ? `Ký ${formatDate(item.NgayKy)}` : null].filter(Boolean).join(" · ")}
        trailing={
          <>
            <MoneyText value={item.TongGiaTriHDMB} short />
            {item.TenTT ? <StatusBadge label={item.TenTT} color={item.MauNen} /> : null}
          </>
        }
        onPress={() =>
          router.push({ pathname: "/contract/[id]", params: { id: String(item.MaHD ?? item.ID), data: JSON.stringify(item) } })
        }
      />
    ),
    [router]
  );

  return (
    <SalesDocList
      title="Hợp đồng"
      embedded={embedded}
      searchPlaceholder="Số hợp đồng, khách hàng, căn…"
      emptyTitle="Chưa có hợp đồng"
      emptyDescription="Hợp đồng mua bán của bạn sẽ hiện ở đây."
      fetchPage={fetchPage}
      fetchStatuses={fetchStatuses}
      renderRow={renderRow}
      keyOf={(item, i) => `${item.MaHD ?? item.ID ?? "hd"}-${i}`}
    />
  );
}
