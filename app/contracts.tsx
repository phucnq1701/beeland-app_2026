import React, { useCallback } from "react";
import { useRouter } from "expo-router";

import { DocTrailing, SalesDocList } from "@/components/sales/SalesDocList";
import { Avatar, ListItem } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { HopDongService } from "@/services/HopDongService";

/** Trong module Hợp đồng bỏ tiền tố "HĐMB" của tên trạng thái ("HĐMB đã duyệt" → "Đã duyệt") cho nhãn gọn, tên khách đủ chỗ */
const shortStatus = (name: unknown) => {
  const s = String(name ?? "").replace(/^\s*(HĐMB|HĐ|hợp đồng( mua bán)?)\s+/i, "").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : String(name ?? "");
};

/** Danh sách hợp đồng mua bán – dữ liệu fn_contract_list như web (ContractListService). */
export default function ContractsScreen({ embedded }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const fetchPage = useCallback((f: any) => HopDongService.get(f), []);
  const fetchStatuses = useCallback(() => HopDongService.getTT({}), []);

  const renderRow = useCallback(
    (item: any) => (
      <ListItem
        leading={<Avatar name={item.TenKH || "?"} size={44} round />}
        title={item.TenKH || "—"}
        subtitle={[item.KyHieu, item.TenDA].filter(Boolean).join(" · ") || undefined}
        meta={[item.SoHDMB, item.NgayKy ? `Ký ${formatDate(item.NgayKy)}` : null].filter(Boolean).join(" · ")}
        trailing={<DocTrailing amount={item.TongGiaTriHDMB} status={shortStatus(item.TenTT)} color={item.MauNen} />}
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
      statusLabel={shortStatus}
      renderRow={renderRow}
      keyOf={(item, i) => `${item.MaHD ?? item.ID ?? "hd"}-${i}`}
    />
  );
}
