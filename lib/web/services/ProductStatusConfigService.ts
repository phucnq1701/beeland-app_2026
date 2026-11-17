// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/ProductStatusConfigService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { supabase } from "../_shims/integrations/supabase/client";
import { currentMaCTDK } from "./InterestDetailService";
import { loadScopedRows, resolveScope } from "./statusConfigScope";
import { clearApiCache } from "../lib/apiCache";

/**
 * Cấu hình cập nhật TRẠNG THÁI SẢN PHẨM.
 * Cấu trúc tương tự cấu hình trạng thái booking: lưu trên Cloud trong bảng
 * dùng chung `cloud_catalogs` theo
 * (ma_ctdk, catalog_type='trang_thai_san_pham', item_code=mã trạng thái).
 */
export interface ProductStatusConfig {
  /** Mã trạng thái sản phẩm (CHUABAN, LOCK, DCDUYET...) */
  code: string;
  /** Tên hiển thị trên giỏ hàng / sơ đồ căn */
  name: string;
  color: string;
  description: string;
  /** Diễn giải "cập nhật khi nào" (tự sinh từ hành động đã chọn) */
  trigger: string;
  /** Danh sách MÃ HÀNH ĐỘNG thực tế đưa sản phẩm về trạng thái này */
  triggerActions: string[];
  order: number;
  active: boolean;
  /** Cho phép giao dịch mới trên sản phẩm (booking/đặt cọc) */
  allowTransaction?: boolean;
  system?: boolean;
}

export interface ProductActionDef {
  code: string;
  label: string;
  group: string;
  where: string;
}

/** Hành động thực tế làm thay đổi trạng thái sản phẩm */
export const PRODUCT_ACTIONS: ProductActionDef[] = [
  {
    code: "PRODUCT_CREATE",
    label: "Tạo mới / import sản phẩm",
    group: "Khởi tạo",
    where: "Sản phẩm → Thêm mới hoặc Import Excel",
  },
  {
    code: "LOCK_CREATE",
    label: "Lock căn (giữ chỗ)",
    group: "Lock căn",
    where: "Bán hàng → Lock căn → Tạo lock",
  },
  {
    code: "LOCK_RELEASE",
    label: "Hủy lock / lock hết hạn",
    group: "Lock căn",
    where: "Bán hàng → Lock căn → Hủy lock hoặc tự động hết hạn",
  },
  {
    code: "BOOKING_ASSIGN",
    label: "Gán căn cho booking thiện chí",
    group: "Booking",
    where: "Booking thiện chí → Thao tác → Gán căn",
  },
  {
    code: "BOOKING_UNASSIGN",
    label: "Hủy gán căn khỏi booking",
    group: "Booking",
    where: "Booking thiện chí → Thao tác → Hủy gán căn",
  },
  {
    code: "BOOKING_CREATE",
    label: "Lập phiếu booking (giữ chỗ)",
    group: "Booking",
    where: "Sản phẩm → Giữ chỗ / Booking → Tạo booking",
  },
  {
    code: "BOOKING_CANCEL",
    label: "Hủy booking / booking hết hạn giữ chỗ",
    group: "Booking",
    where: "Bán hàng → Booking → Hủy hoặc hết hạn tự động",
  },
  {
    code: "DEPOSIT_CREATE",
    label: "Lập phiếu đặt cọc cho sản phẩm",
    group: "Đặt cọc",
    where: "Bán hàng → Đặt cọc → Thêm phiếu",
  },
  {
    code: "DEPOSIT_APPROVE",
    label: "Duyệt phiếu đặt cọc",
    group: "Đặt cọc",
    where: "Bán hàng → Đặt cọc → Duyệt phiếu",
  },
  {
    code: "DEPOSIT_APPROVE_CANCEL",
    label: "Hủy duyệt phiếu đặt cọc (về chờ duyệt)",
    group: "Đặt cọc",
    where: "Bán hàng → Đặt cọc → Hủy duyệt",
  },
  {
    code: "DEPOSIT_CANCEL",
    label: "Hủy cọc / thanh lý cọc",
    group: "Đặt cọc",
    where: "Bán hàng → Đặt cọc → Hủy cọc",
  },
  {
    code: "CONTRACT_SIGN",
    label: "Ký hợp đồng mua bán (HĐMB)",
    group: "Hợp đồng",
    where: "Tài chính → Hợp đồng → Ký HĐMB",
  },
  {
    code: "CONTRACT_LIQUIDATE",
    label: "Thanh lý hợp đồng",
    group: "Hợp đồng",
    where: "Tài chính → Hợp đồng → Thanh lý",
  },
  {
    code: "PRODUCT_OPEN_SALE",
    label: "Chuyển về Mở bán (thao tác hàng loạt)",
    group: "Khác",
    where: "Sản phẩm → chọn nhiều → Thao tác → Chuyển về Mở bán",
  },
  {
    code: "PRODUCT_STOP_SALE",
    label: "Ngừng bán (thao tác hàng loạt)",
    group: "Khác",
    where: "Sản phẩm → chọn nhiều → Thao tác → Ngừng bán",
  },
  {
    code: "PRODUCT_HOLD",
    label: "Khóa giỏ hàng (không bán)",
    group: "Khác",
    where: "Sản phẩm → Thao tác → Ngừng bán",
  },
];

export const productActionLabel = (code: string) =>
  PRODUCT_ACTIONS.find((a) => a.code === code)?.label || code;

export const buildProductTriggerText = (actions: string[] = []) =>
  actions.map(productActionLabel).join(" • ");

const CATALOG_TYPE = "trang_thai_san_pham";

export const DEFAULT_PRODUCT_STATUSES: ProductStatusConfig[] = (
  [
    {
      code: "MOBAN",
      name: "Mở bán",
      color: "hsl(var(--chart-positive))",
      order: 0,
      allowTransaction: true,
      triggerActions: ["PRODUCT_OPEN_SALE", "BOOKING_CANCEL"],
      description:
        "Sản phẩm đang mở bán. Được phép lập đặt cọc, hợp đồng, góp vốn.",
    },
    {
      code: "CHUABAN",
      name: "Chưa bán",
      color: "hsl(var(--muted-foreground))",
      order: 1,
      allowTransaction: true,
      triggerActions: ["PRODUCT_CREATE", "LOCK_RELEASE", "BOOKING_UNASSIGN"],
      description:
        "Sản phẩm chưa mở bán / chưa phát sinh giao dịch. Cho phép lock căn, gán booking.",
    },
    {
      code: "LOCK",
      name: "Lock căn",
      color: "hsl(var(--chart-warning))",
      order: 2,
      allowTransaction: true,
      triggerActions: ["LOCK_CREATE"],
      description:
        "Sản phẩm đang được giữ chỗ trong thời gian lock. Hết hạn lock sẽ tự trả về Chưa bán.",
    },
    {
      code: "BOOKING",
      name: "Đã gán booking",
      color: "hsl(var(--chart-info))",
      order: 3,
      allowTransaction: true,
      triggerActions: ["BOOKING_ASSIGN"],
      description:
        "Sản phẩm đã được gán cho một phiếu booking thiện chí, chờ chuyển sang bước đặt cọc.",
    },
    {
      code: "BOOKINGCHODUYET",
      name: "Booking chờ duyệt",
      color: "hsl(var(--chart-warning))",
      order: 4,
      allowTransaction: false,
      triggerActions: ["BOOKING_CREATE"],
      description:
        "Đã lập phiếu booking giữ chỗ cho sản phẩm, đang chờ duyệt. Hết thời gian giữ chỗ sẽ tự trả về Mở bán.",
    },
    {
      code: "DCCHODUYET",
      name: "ĐC chờ duyệt",
      color: "hsl(var(--chart-warning))",
      order: 4,
      allowTransaction: false,
      triggerActions: ["DEPOSIT_CREATE", "DEPOSIT_APPROVE_CANCEL"],
      description:
        "Đã lập phiếu đặt cọc cho sản phẩm, đang chờ duyệt. Không cho phát sinh giao dịch mới trên sản phẩm.",
    },
    {
      code: "DCDUYET",
      name: "ĐC đã duyệt",
      color: "hsl(var(--chart-6))",
      order: 5,
      allowTransaction: false,
      triggerActions: ["DEPOSIT_APPROVE"],
      description:
        "Phiếu đặt cọc đã được duyệt. Sản phẩm khóa giao dịch, chờ ký hợp đồng.",
    },
    {
      code: "DABAN",
      name: "Đã bán (ký HĐMB)",
      color: "hsl(var(--chart-positive))",
      order: 6,
      allowTransaction: false,
      triggerActions: ["CONTRACT_SIGN"],
      description:
        "Đã ký hợp đồng mua bán. Sản phẩm chốt bán, chỉ xử lý ở module hợp đồng.",
    },
    {
      code: "HUYCOC",
      name: "Hủy cọc",
      color: "hsl(var(--chart-negative))",
      order: 7,
      allowTransaction: true,
      triggerActions: ["DEPOSIT_CANCEL", "CONTRACT_LIQUIDATE"],
      description:
        "Phiếu cọc/hợp đồng bị hủy hoặc thanh lý, sản phẩm được mở bán trở lại theo quyết định của quản lý.",
    },
    {
      code: "NGUNGBAN",
      name: "Ngừng bán",
      color: "hsl(var(--muted-foreground))",
      order: 8,
      allowTransaction: false,
      triggerActions: ["PRODUCT_HOLD", "PRODUCT_STOP_SALE"],
      description:
        "Sản phẩm bị khóa khỏi giỏ hàng (giữ lại quỹ căn, không mở bán).",
    },
  ] as Omit<ProductStatusConfig, "trigger" | "active" | "system">[]
).map((s) => ({
  ...s,
  active: true,
  system: true,
  trigger: buildProductTriggerText(s.triggerActions),
}));

const maCTDK = () => currentMaCTDK() || "";

export const ProductStatusConfigService = {
  maCTDK,

  catalogType: CATALOG_TYPE,

  scope: () => resolveScope(CATALOG_TYPE),

  list: async (): Promise<ProductStatusConfig[]> => {
    const ma_ctdk = maCTDK();
    if (!ma_ctdk) return DEFAULT_PRODUCT_STATUSES;
    const { rows } = await loadScopedRows(CATALOG_TYPE);
    if (!rows.length) return DEFAULT_PRODUCT_STATUSES;
    return rows
      .map((r) => {
        const raw = r.raw || {};
        const triggerActions: string[] = Array.isArray(raw.triggerActions)
          ? raw.triggerActions
          : [];
        return {
          code: String(r.item_code),
          name: r.item_name || raw.name || String(r.item_code),
          color: raw.color || "hsl(var(--muted-foreground))",
          description: raw.description || "",
          triggerActions,
          trigger: triggerActions.length
            ? buildProductTriggerText(triggerActions)
            : raw.trigger || "",
          order: Number(raw.order) || 0,
          active: r.ap_dung !== false,
          allowTransaction: raw.allowTransaction !== false,
          system: !!raw.system,
        } as ProductStatusConfig;
      })
      .sort((a, b) => {
        const oa = a.order > 0 ? a.order : Number.MAX_SAFE_INTEGER;
        const ob = b.order > 0 ? b.order : Number.MAX_SAFE_INTEGER;
        if (oa !== ob) return oa - ob;
        return a.name.localeCompare(b.name, "vi");
      })
      .map((s, idx) => ({ ...s, order: idx + 1 }));
  },

  saveAll: async (items: ProductStatusConfig[]) => {
    const ma_ctdk = maCTDK();
    if (!ma_ctdk) throw new Error("Thiếu mã công ty đăng ký");
    const scope = await resolveScope(CATALOG_TYPE);
    if (!scope.canEdit)
      throw new Error(
        "Cấu hình trạng thái sản phẩm đang được áp dụng bắt buộc theo công ty quản trị, không thể chỉnh sửa."
      );
    // Chuẩn hoá thứ tự 1..n theo đúng thứ tự kéo thả hiện tại
    const ordered = [...items]
      .map((i, idx) => ({ ...i, order: Number(i.order) > 0 ? i.order : idx + 1 }))
      .sort((a, b) => a.order - b.order)
      .map((i, idx) => ({ ...i, order: idx + 1 }));
    const codes = ordered.map((i) => i.code);
    const payload = ordered.map((i) => ({
      ma_ctdk,
      catalog_type: CATALOG_TYPE,
      item_code: i.code,
      item_name: i.name,
      parent_code: null,
      ap_dung: i.active,
      raw: {
        color: i.color,
        description: i.description,
        triggerActions: i.triggerActions || [],
        trigger:
          buildProductTriggerText(i.triggerActions || []) || i.trigger,
        order: i.order,
        allowTransaction: i.allowTransaction !== false,
        system: !!i.system,
      },
    }));
    const { error } = await supabase
      .from("cloud_catalogs" as any)
      .upsert(payload as any, { onConflict: "ma_ctdk,catalog_type,item_code" });
    if (error) throw error;

    let del = supabase
      .from("cloud_catalogs" as any)
      .delete()
      .eq("ma_ctdk", ma_ctdk)
      .eq("catalog_type", CATALOG_TYPE);
    if (codes.length) del = del.not("item_code", "in", `(${codes.join(",")})`);
    const { error: delErr } = await del;
    if (delErr) throw delErr;
    // Trạng thái sản phẩm là một danh mục của form Thêm/Sửa → bỏ cache danh mục
    clearApiCache("catalog:");
  },

  resetDefault: async () => {
    await ProductStatusConfigService.saveAll(DEFAULT_PRODUCT_STATUSES);
    return DEFAULT_PRODUCT_STATUSES;
  },

  statusForAction: (
    items: ProductStatusConfig[],
    actionCode: string
  ): ProductStatusConfig | undefined =>
    [...items]
      .sort((a, b) => a.order - b.order)
      .find((s) => s.active && (s.triggerActions || []).includes(actionCode)),

  resolveStatusForAction: async (actionCode: string) => {
    const items = await ProductStatusConfigService.list().catch(
      () => DEFAULT_PRODUCT_STATUSES
    );
    return ProductStatusConfigService.statusForAction(items, actionCode);
  },
};

export default ProductStatusConfigService;
