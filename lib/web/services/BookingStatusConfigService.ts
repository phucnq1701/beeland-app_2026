// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/BookingStatusConfigService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { supabase } from "../_shims/integrations/supabase/client";
import { currentMaCTDK } from "./InterestDetailService";
import { loadScopedRows, resolveScope } from "./statusConfigScope";

/* =====================================================================
 * NGUỒN MÀU TRẠNG THÁI DUY NHẤT CỦA HỆ THỐNG
 * Mọi màu trạng thái nghiệp vụ (sơ đồ, badge bảng, chú thích, dashboard)
 * đều lấy qua đây; giá trị thực nằm ở token CSS --status-* (index.css)
 * nên đổi token là toàn hệ thống đổi theo.
 * ===================================================================== */

export type StatusToken =
  | "available"
  | "reserved"
  | "sold"
  | "blocked"
  | "pending"
  | "contract"
  | "handover"
  | "booking"
  | "booking-pending"
  | "deposit"
  | "deposit-pending"
  | "contract-pending"
  | "capital"
  | "capital-pending"
  | "assigned"
  | "merge"
  | "refund"
  | "expired"
  | "cancelled"
  | "locked";

/** Màu của một token trạng thái (luôn trả về biến CSS → phản ứng theo theme) */
export const statusTokenColor = (token: StatusToken) =>
  `hsl(var(--status-${token}))`;

/** Tailwind class nền tương ứng token */
export const statusTokenBgClass = (token: StatusToken) => `bg-status-${token}`;

/** Mã trạng thái booking → token màu */
export const BOOKING_STATUS_TOKENS: Record<string, StatusToken> = {
  PENDING: "pending",
  APPROVED: "booking",
  WAITING: "reserved",
  ASSIGNED: "assigned",
  DEPOSITED: "deposit",
  DEPOSIT_PENDING: "deposit-pending",
  DEPOSIT_APPROVED: "deposit",
  MERGING: "merge",
  MERGED: "merge",
  WAITING_REFUND: "refund",
  REFUND_APPROVED: "refund",
  REFUNDED: "refund",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
};

/** Tên trạng thái nghiệp vụ (sản phẩm / booking / hợp đồng) → token màu */
const NAME_TOKEN_RULES: Array<[RegExp, StatusToken]> = [
  [/^(mở bán|còn trống|chưa bán|trống|đang bán|đang mở bán|sắp mở bán)$/i, "available"],
  [/booking.*(chờ duyệt|chờ xác nhận)/i, "booking-pending"],
  [/(đặt cọc|đc).*(chờ duyệt)/i, "deposit-pending"],
  [/(hđmb|hợp đồng mua bán|hđ mua bán).*(chờ duyệt)/i, "contract-pending"],
  [/(góp vốn|hđgv|hợp đồng góp vốn).*(chờ duyệt)/i, "capital-pending"],
  [/(hđmb|hợp đồng mua bán|đã ký hđ|hợp đồng)/i, "contract"],
  [/(góp vốn|hđgv)/i, "capital"],
  [/(đặt cọc|đã cọc|^đc\b)/i, "deposit"],
  [/(lock|khóa|tạm khóa|giữ chỗ)/i, "locked"],
  [/(booking|thiện chí)/i, "booking"],
  [/(đã bán|bán)/i, "sold"],
  [/(bàn giao)/i, "handover"],
  [/(gán căn)/i, "assigned"],
  [/(hoàn)/i, "refund"],
  [/(hết hạn|quá hạn)/i, "expired"],
  [/(hủy|từ chối)/i, "cancelled"],
  [/(chờ duyệt|chờ xử lý)/i, "pending"],
];

/** Tìm token theo tên trạng thái (không phân biệt hoa thường/dấu cách thừa) */
export const statusTokenByName = (name?: string | null): StatusToken | null => {
  const s = String(name || "").trim();
  if (!s) return null;
  for (const [re, token] of NAME_TOKEN_RULES) if (re.test(s)) return token;
  return null;
};

/**
 * Màu hiển thị cho một trạng thái nghiệp vụ.
 * Ưu tiên màu danh mục trả về (`color_code`/MauNen) → token theo tên → xám.
 */
export const resolveStatusColor = (
  name?: string | null,
  fallback?: string | null,
): string => {
  if (fallback && String(fallback).trim()) return String(fallback);
  const token = statusTokenByName(name);
  if (token) return statusTokenColor(token);
  return statusTokenColor("blocked");
};

/** Màu theo mã trạng thái booking */
export const resolveBookingStatusColor = (
  code?: string | null,
  name?: string | null,
): string => {
  const token = BOOKING_STATUS_TOKENS[String(code || "").toUpperCase()];
  if (token) return statusTokenColor(token);
  return resolveStatusColor(name);
};

/** Chú thích trạng thái dùng chung cho sơ đồ căn / sơ đồ phân lô */
export const STATUS_LEGEND: Array<{ token: StatusToken; label: string }> = [
  { token: "available", label: "Còn trống / Mở bán" },
  { token: "locked", label: "Lock căn / Giữ chỗ" },
  { token: "booking", label: "Booking" },
  { token: "deposit", label: "Đặt cọc" },
  { token: "contract", label: "Hợp đồng" },
  { token: "capital", label: "Góp vốn" },
  { token: "handover", label: "Bàn giao" },
  { token: "pending", label: "Chờ duyệt" },
  { token: "sold", label: "Đã bán" },
  { token: "blocked", label: "Tạm khóa" },
];


/**
 * Cấu hình trạng thái Booking thiện chí.
 * Lưu trên Cloud trong bảng dùng chung `cloud_catalogs`
 * theo (ma_ctdk, catalog_type='trang_thai_booking', item_code=mã trạng thái)
 * → mỗi công ty đăng ký (vd: mega) có cấu hình riêng.
 */
export interface BookingStatusConfig {
  /** Mã trạng thái hệ thống (PENDING, APPROVED...) */
  code: string;
  /** Tên hiển thị */
  name: string;
  /** Màu hiển thị (hex) */
  color: string;
  /** Mô tả nghiệp vụ: trạng thái này xảy ra khi nào */
  description: string;
  /** Diễn giải "thực hiện khi nào" (tự sinh từ hành động đã chọn) */
  trigger: string;
  /** Danh sách MÃ HÀNH ĐỘNG thực tế trên phần mềm đưa phiếu về trạng thái này */
  triggerActions: string[];
  order: number;
  active: boolean;
  /** Trạng thái mặc định của hệ thống (không cho xóa mã) */
  system?: boolean;
}

/** Hành động thực tế trong luồng Booking thiện chí trên phần mềm */
export interface BookingActionDef {
  code: string;
  label: string;
  group: string;
  /** Nơi thao tác trên phần mềm */
  where: string;
}

export const BOOKING_ACTIONS: BookingActionDef[] = [
  {
    code: "CREATE_AGENCY",
    label: "Đại lý tạo phiếu booking thiện chí",
    group: "Tạo phiếu",
    where: "Cổng đại lý → Booking thiện chí → Thêm phiếu",
  },
  {
    code: "CREATE_INTERNAL",
    label: "Nhân viên nội bộ tạo phiếu booking",
    group: "Tạo phiếu",
    where: "Bán hàng → Booking thiện chí → Thêm phiếu",
  },
  {
    code: "PAYMENT_FULL",
    label: "Ghi nhận thu đủ tiền booking",
    group: "Thu tiền",
    where: "Booking thiện chí → Thanh toán / Phiếu thu",
  },
  {
    code: "APPROVE",
    label: "Duyệt phiếu booking",
    group: "Duyệt",
    where: "Booking thiện chí → Thao tác → Duyệt",
  },
  {
    code: "REJECT",
    label: "Từ chối duyệt phiếu booking",
    group: "Duyệt",
    where: "Booking thiện chí → Thao tác → Từ chối",
  },
  {
    code: "EXTRA_PAYMENT_APPROVE",
    label: "Duyệt phiếu nộp tiền bổ sung",
    group: "Thu tiền",
    where: "Bán hàng → Nộp tiền bổ sung → Duyệt",
  },
  {
    code: "QUEUE_ASSIGN",
    label: "Đưa phiếu vào hàng chờ gán căn",
    group: "Gán căn",
    where: "Booking thiện chí → Hàng chờ / thứ tự ưu tiên",
  },
  {
    code: "ASSIGN_PRODUCT",
    label: "Gán căn cho phiếu (giỏ hàng / sơ đồ căn)",
    group: "Gán căn",
    where: "Booking thiện chí → Thao tác → Gán căn",
  },
  {
    code: "UNASSIGN_PRODUCT",
    label: "Hủy gán căn",
    group: "Gán căn",
    where: "Booking thiện chí → Thao tác → Hủy gán căn",
  },
  {
    code: "CREATE_DEPOSIT",
    label: "Lập phiếu đặt cọc từ booking",
    group: "Đặt cọc",
    where: "Booking thiện chí → Thao tác → Lập phiếu đặt cọc",
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
    code: "DEPOSIT_DELETE",
    label: "Xóa phiếu đặt cọc (booking quay lại chờ gán căn)",
    group: "Đặt cọc",
    where: "Bán hàng → Đặt cọc → Xóa phiếu",
  },

  {
    code: "RENAME_APPROVE",
    label: "Duyệt phiếu đổi tên booking",
    group: "Đổi tên",
    where: "Bán hàng → Đổi tên booking → Duyệt",
  },
  {
    code: "MERGE_CREATE",
    label: "Tạo phiếu gộp booking",
    group: "Gộp booking",
    where: "Bán hàng → Gộp booking → Thêm phiếu",
  },
  {
    code: "MERGE_APPROVE",
    label: "Duyệt phiếu gộp booking",
    group: "Gộp booking",
    where: "Bán hàng → Gộp booking → Duyệt",
  },
  {
    code: "MERGE_REJECT",
    label: "Từ chối phiếu gộp booking",
    group: "Gộp booking",
    where: "Bán hàng → Gộp booking → Từ chối",
  },
  {
    code: "REFUND_CREATE",
    label: "Tạo phiếu hoàn booking",
    group: "Hoàn booking",
    where: "Bán hàng → Hoàn booking → Thêm phiếu",
  },
  {
    code: "REFUND_APPROVE",
    label: "Duyệt hồ sơ hoàn booking",
    group: "Hoàn booking",
    where: "Bán hàng → Hoàn booking → Duyệt hồ sơ",
  },
  {
    code: "REFUND_PAYOUT",
    label: "Chi tiền hoàn cho khách hàng",
    group: "Hoàn booking",
    where: "Bán hàng → Hoàn booking → Đã chi tiền",
  },
  {
    code: "EXPIRE_AUTO",
    label: "Hệ thống tự hết hạn khi quá thời gian giữ chỗ",
    group: "Tự động",
    where: "Tác vụ nền theo cấu hình thời gian giữ chỗ",
  },
  {
    code: "CANCEL",
    label: "Người dùng hủy phiếu booking",
    group: "Hủy",
    where: "Booking thiện chí → Thao tác → Hủy phiếu",
  },
];

export const bookingActionLabel = (code: string) =>
  BOOKING_ACTIONS.find((a) => a.code === code)?.label || code;

/** Sinh câu diễn giải "thực hiện khi nào" từ các hành động đã chọn */
export const buildTriggerText = (actions: string[] = []) =>
  actions.map(bookingActionLabel).join(" • ");

const CATALOG_TYPE = "trang_thai_booking";


/** Bộ trạng thái mặc định — gắn đích danh hành động thực tế trên phần mềm */
export const DEFAULT_BOOKING_STATUSES: BookingStatusConfig[] = (
  [
    {
      code: "PENDING",
      name: "Chờ duyệt",
      color: statusTokenColor(BOOKING_STATUS_TOKENS["PENDING"]),
      order: 1,
      triggerActions: ["CREATE_AGENCY", "CREATE_INTERNAL"],
      description:
        "Phiếu vừa được tạo (từ cổng đại lý hoặc nhân viên kinh doanh nội bộ), chưa thu tiền. Cho phép sửa, xóa, duyệt hoặc từ chối.",
    },
    {
      code: "APPROVED",
      name: "Đã duyệt booking",
      color: statusTokenColor(BOOKING_STATUS_TOKENS["APPROVED"]),
      order: 2,
      triggerActions: ["PAYMENT_FULL", "APPROVE", "MERGE_REJECT"],
      description:
        "Kế toán/quản lý xác nhận đã thu đủ tiền booking → phiếu được duyệt. Từ đây phiếu có thể gán căn, gộp booking, nộp tiền bổ sung hoặc yêu cầu hoàn booking.",
    },
    {
      code: "WAITING",
      name: "Chờ gán căn",
      color: statusTokenColor(BOOKING_STATUS_TOKENS["WAITING"]),
      order: 3,
      triggerActions: ["QUEUE_ASSIGN", "UNASSIGN_PRODUCT"],
      description:
        "Phiếu hợp lệ nhưng chưa chọn được sản phẩm. Chờ đợt mở bán hoặc thứ tự ưu tiên để gán căn.",
    },
    {
      code: "ASSIGNED",
      name: "Đã gán căn",
      color: statusTokenColor(BOOKING_STATUS_TOKENS["ASSIGNED"]),
      order: 4,
      triggerActions: ["ASSIGN_PRODUCT", "DEPOSIT_DELETE"],
      description:
        "Booking đã gắn với một sản phẩm cụ thể. Phiếu bị khóa sửa thông tin chính, chỉ tiếp tục sang bước đặt cọc.",
    },
    {
      code: "DEPOSIT_PENDING",
      name: "Đặt cọc chờ duyệt",
      color: statusTokenColor(BOOKING_STATUS_TOKENS["DEPOSIT_PENDING"]),
      order: 5,
      triggerActions: ["CREATE_DEPOSIT", "DEPOSIT_APPROVE_CANCEL"],
      description:
        "Đã lập phiếu đặt cọc từ booking, phiếu cọc đang ở trạng thái ĐC chờ duyệt.",
    },
    {
      code: "DEPOSIT_APPROVED",
      name: "Đặt cọc đã duyệt",
      color: statusTokenColor(BOOKING_STATUS_TOKENS["DEPOSIT_APPROVED"]),
      order: 5.1,
      triggerActions: ["DEPOSIT_APPROVE"],
      description:
        "Phiếu đặt cọc đã được duyệt. Nghiệp vụ tiếp theo xử lý bên module Đặt cọc / Hợp đồng.",
    },
    {
      code: "DEPOSITED",
      name: "Đã đặt cọc",
      color: statusTokenColor(BOOKING_STATUS_TOKENS["DEPOSITED"]),
      order: 5.2,
      triggerActions: [],
      description:
        "Trạng thái cũ: tiền booking đã chuyển sang phiếu đặt cọc (giữ lại để tương thích dữ liệu cũ).",
    },
    {
      code: "MERGING",
      name: "Chờ duyệt gộp",
      color: statusTokenColor(BOOKING_STATUS_TOKENS["MERGING"]),
      order: 6,
      triggerActions: ["MERGE_CREATE"],
      description:
        "Các phiếu nguồn bị khóa trong khi phiếu gộp chờ duyệt. Nếu từ chối, phiếu quay về Đã duyệt booking.",
    },
    {
      code: "MERGED",
      name: "Đã duyệt gộp",
      color: statusTokenColor(BOOKING_STATUS_TOKENS["MERGED"]),
      order: 7,
      triggerActions: ["MERGE_APPROVE"],
      description:
        "Tiền của các phiếu nguồn đã dồn về phiếu đích. Phiếu nguồn không còn dùng cho giao dịch mới.",
    },
    {
      code: "WAITING_REFUND",
      name: "Chờ duyệt hoàn booking",
      color: statusTokenColor(BOOKING_STATUS_TOKENS["WAITING_REFUND"]),
      order: 8,
      triggerActions: ["REFUND_CREATE"],
      description:
        "Bước 1 của quy trình hoàn: hồ sơ hoàn đã lập, đang chờ duyệt. Phiếu booking bị khóa các thao tác giao dịch.",
    },
    {
      code: "REFUND_APPROVED",
      name: "Duyệt hoàn HS booking",
      color: statusTokenColor(BOOKING_STATUS_TOKENS["REFUND_APPROVED"]),
      order: 9,
      triggerActions: ["REFUND_APPROVE"],
      description:
        "Bước 2: hồ sơ hoàn đã duyệt, khóa sửa/xóa phiếu hoàn. Chờ kế toán chi tiền cho khách.",
    },
    {
      code: "REFUNDED",
      name: "Đã hoàn booking",
      color: statusTokenColor(BOOKING_STATUS_TOKENS["REFUNDED"]),
      order: 10,
      triggerActions: ["REFUND_PAYOUT"],
      description:
        "Bước 3: hoàn tất trả tiền. Booking kết thúc vòng đời, không dùng cho giao dịch mới.",
    },
    {
      code: "EXPIRED",
      name: "Hết hạn",
      color: statusTokenColor(BOOKING_STATUS_TOKENS["EXPIRED"]),
      order: 11,
      triggerActions: ["EXPIRE_AUTO"],
      description:
        "Phiếu quá hạn xử lý theo cấu hình thời gian giữ chỗ, tự động hết hiệu lực và nhả suất ưu tiên cho phiếu kế tiếp.",
    },
    {
      code: "CANCELLED",
      name: "Đã hủy",
      color: statusTokenColor(BOOKING_STATUS_TOKENS["CANCELLED"]),
      order: 12,
      triggerActions: ["CANCEL", "REJECT"],
      description:
        "Phiếu bị hủy/từ chối. Không phát sinh giao dịch, có thể xem lại trong lịch sử.",
    },
  ] as Omit<BookingStatusConfig, "trigger" | "active" | "system">[]
).map((s) => ({
  ...s,
  active: true,
  system: true,
  trigger: buildTriggerText(s.triggerActions),
}));


const maCTDK = () => currentMaCTDK() || "";

export const BookingStatusConfigService = {
  maCTDK,

  /** Đọc cấu hình theo mã công ty đăng ký; chưa có thì trả bộ mặc định */
  catalogType: CATALOG_TYPE,

  scope: () => resolveScope(CATALOG_TYPE),

  list: async (): Promise<BookingStatusConfig[]> => {
    const ma_ctdk = maCTDK();
    if (!ma_ctdk) return DEFAULT_BOOKING_STATUSES;
    const { rows } = await loadScopedRows(CATALOG_TYPE);
    if (!rows.length) return DEFAULT_BOOKING_STATUSES;
    const saved: BookingStatusConfig[] = rows
      .map((r) => {
        const raw = r.raw || {};
        const triggerActions: string[] = Array.isArray(raw.triggerActions)
          ? raw.triggerActions
          : [];
        return {
          code: String(r.item_code),
          name: r.item_name || raw.name || String(r.item_code),
          color: raw.color || resolveBookingStatusColor(String(r.item_code), r.item_name),
          description: raw.description || "",
          triggerActions,
          trigger: triggerActions.length
            ? buildTriggerText(triggerActions)
            : raw.trigger || "",
          order: Number(raw.order) || 0,
          active: r.ap_dung !== false,
          system: !!raw.system,
        } as BookingStatusConfig;
      });

    // Hòa giải với bộ mặc định: bổ sung trạng thái hệ thống còn thiếu và bảo đảm
    // mỗi hành động chuẩn của luồng đặt cọc chỉ thuộc đúng một trạng thái.
    const byCode = new Map<string, BookingStatusConfig>(
      saved.map((s) => [s.code, s])
    );
    DEFAULT_BOOKING_STATUSES.forEach((d) => {
      if (!byCode.has(d.code)) byCode.set(d.code, { ...d });
    });
    const OWNED_ACTIONS = [
      "CREATE_DEPOSIT",
      "DEPOSIT_APPROVE",
      "DEPOSIT_APPROVE_CANCEL",
      "DEPOSIT_DELETE",
    ];
    OWNED_ACTIONS.forEach((action) => {
      const owner = DEFAULT_BOOKING_STATUSES.find((d) =>
        (d.triggerActions || []).includes(action)
      );
      if (!owner) return;
      byCode.forEach((s, code) => {
        const has = (s.triggerActions || []).includes(action);
        if (code === owner.code && !has) {
          s.triggerActions = [...(s.triggerActions || []), action];
          s.trigger = buildTriggerText(s.triggerActions);
        } else if (code !== owner.code && has) {
          s.triggerActions = (s.triggerActions || []).filter(
            (a) => a !== action
          );
          s.trigger = buildTriggerText(s.triggerActions);
        }
      });
    });
    return Array.from(byCode.values()).sort((a, b) => a.order - b.order);
  },

  /** Ghi đè toàn bộ cấu hình của công ty đăng ký hiện tại */
  saveAll: async (items: BookingStatusConfig[]) => {
    const ma_ctdk = maCTDK();
    if (!ma_ctdk) throw new Error("Thiếu mã công ty đăng ký");
    const scope = await resolveScope(CATALOG_TYPE);
    if (!scope.canEdit)
      throw new Error(
        "Cấu hình trạng thái booking đang được áp dụng bắt buộc theo công ty quản trị, không thể chỉnh sửa."
      );
    const codes = items.map((i) => i.code);
    const payload = items.map((i) => ({
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
        trigger: buildTriggerText(i.triggerActions || []) || i.trigger,
        order: i.order,
        system: !!i.system,
      },

    }));
    const { error } = await supabase
      .from("cloud_catalogs" as any)
      .upsert(payload as any, { onConflict: "ma_ctdk,catalog_type,item_code" });
    if (error) throw error;

    // Xóa các trạng thái đã bị loại khỏi cấu hình
    let del = supabase
      .from("cloud_catalogs" as any)
      .delete()
      .eq("ma_ctdk", ma_ctdk)
      .eq("catalog_type", CATALOG_TYPE);
    if (codes.length) del = del.not("item_code", "in", `(${codes.join(",")})`);
    const { error: delErr } = await del;
    if (delErr) throw delErr;
  },

  /** Khôi phục bộ trạng thái mặc định theo luồng chuẩn */
  resetDefault: async () => {
    await BookingStatusConfigService.saveAll(DEFAULT_BOOKING_STATUSES);
    return DEFAULT_BOOKING_STATUSES;
  },

  /**
   * Tra trạng thái sẽ áp dụng khi một HÀNH ĐỘNG thực tế xảy ra trong luồng
   * booking (vd: ASSIGN_PRODUCT → trạng thái đang gắn hành động đó).
   */
  statusForAction: (
    items: BookingStatusConfig[],
    actionCode: string
  ): BookingStatusConfig | undefined =>
    [...items]
      .sort((a, b) => a.order - b.order)
      .find(
        (s) => s.active && (s.triggerActions || []).includes(actionCode)
      ),

  /** Bản async: đọc cấu hình theo công ty đăng ký rồi tra trạng thái */
  resolveStatusForAction: async (actionCode: string) => {
    const items = await BookingStatusConfigService.list().catch(
      () => DEFAULT_BOOKING_STATUSES
    );
    return BookingStatusConfigService.statusForAction(items, actionCode);
  },
};


export default BookingStatusConfigService;
