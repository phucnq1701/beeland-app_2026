// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/SalesProcessService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { supabase } from "../_shims/integrations/supabase/client";
import { AutomationV2Service, currentMaCTDK } from "./AutomationV2Service";

/** Các bước trong quy trình bán hàng có thể gán automation */
export interface SalesStageDef {
  key: string;
  label: string;
  description: string;
}

export const SALES_PROCESS_STAGES: SalesStageDef[] = [
  { key: "booking", label: "Booking", description: "Chạy khi tạo mới phiếu booking (giữ chỗ)" },
  { key: "booking_priority", label: "Booking ưu tiên", description: "Chạy khi tạo mới booking có tích ưu tiên" },
  { key: "prebooking", label: "Booking thiện chí", description: "Chạy khi tạo mới phiếu booking thiện chí" },

  { key: "lock", label: "Lock căn", description: "Chạy khi lock một sản phẩm" },
  { key: "deposit", label: "Đặt cọc", description: "Chạy khi tạo mới phiếu đặt cọc" },
  { key: "hdgv", label: "Hợp đồng góp vốn", description: "Chạy khi tạo mới hợp đồng góp vốn" },
  { key: "hdmb", label: "Hợp đồng mua bán", description: "Chạy khi tạo mới hợp đồng mua bán" },
];

export interface SalesProcessBinding {
  id?: string;
  process_key: string;
  /** Mã dự án áp dụng — rỗng/null = áp dụng chung cho mọi dự án */
  ma_da?: string | null;
  name: string;
  description?: string | null;
  workflow_id?: string | null;
  run_mode?: string | null;
  active?: boolean;
}

const TBL = "cloud_sales_processes" as const;

let cache: { ctdk: string; at: number; rows: SalesProcessBinding[] } | null = null;

const norm = (v: any) => (v == null || v === "" ? "" : String(v));

export const SalesProcessService = {
  stages: SALES_PROCESS_STAGES,

  /** Danh sách cấu hình gán automation của công ty đang đăng nhập */
  async list(force = false): Promise<SalesProcessBinding[]> {
    const ctdk = currentMaCTDK();
    if (!ctdk) return [];
    if (!force && cache && cache.ctdk === ctdk && Date.now() - cache.at < 60_000) return cache.rows;
    const { data, error } = await supabase
      .from(TBL as any)
      .select("*")
      .eq("ma_ctdk", ctdk);
    if (error) throw error;
    const rows = (data || []) as any as SalesProcessBinding[];
    cache = { ctdk, at: Date.now(), rows };
    return rows;
  },

  /** Lưu (thêm mới hoặc cập nhật) cấu hình cho 1 bước, theo dự án hoặc áp dụng chung */
  async save(binding: SalesProcessBinding): Promise<void> {
    const ctdk = currentMaCTDK();
    if (!ctdk) throw new Error("Không xác định được công ty đăng ký");
    const maDA = norm(binding.ma_da) || null;
    const row: any = {
      ma_ctdk: ctdk,
      process_key: binding.process_key,
      ma_da: maDA,
      name: binding.name,
      description: binding.description ?? null,
      workflow_id: binding.workflow_id || null,
      run_mode: binding.run_mode || "async",
      active: binding.active !== false,
      updated_at: new Date().toISOString(),
    };
    // Index unique dùng biểu thức COALESCE nên không upsert được → tự tìm rồi update/insert
    let q = supabase
      .from(TBL as any)
      .select("id")
      .eq("ma_ctdk", ctdk)
      .eq("process_key", binding.process_key)
      .limit(1);
    q = maDA ? q.eq("ma_da", maDA) : q.is("ma_da", null);
    const { data: found, error: findErr } = await q;
    if (findErr) throw findErr;
    const existing = (found || [])[0] as any;
    if (existing?.id) {
      const { error } = await supabase.from(TBL as any).update(row).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from(TBL as any).insert(row);
      if (error) throw error;
    }
    cache = null;
  },

  /** Xoá cấu hình riêng của 1 dự án cho 1 bước */
  async remove(processKey: string, maDA: string): Promise<void> {
    const ctdk = currentMaCTDK();
    if (!ctdk || !norm(maDA)) return;
    const { error } = await supabase
      .from(TBL as any)
      .delete()
      .eq("ma_ctdk", ctdk)
      .eq("process_key", processKey)
      .eq("ma_da", String(maDA));
    if (error) throw error;
    cache = null;
  },

  clearCache() {
    cache = null;
  },
};

/**
 * Kích hoạt automation đã gán cho 1 bước của quy trình bán hàng.
 * Ưu tiên cấu hình riêng của dự án, nếu không có thì dùng cấu hình chung.
 * Không chặn luồng nghiệp vụ: mọi lỗi chỉ ghi log.
 */
export const salesProcessEntity = (stageKey: string) => `sales:${stageKey}`;

/** Mã bản ghi nghiệp vụ dùng để gắn lần chạy automation với dòng dữ liệu trên danh sách */
export const salesProcessEntityId = (context: Record<string, any>) =>
  norm(
    context.entity_id ??
      context.so_phieu ??
      context.SoPhieu ??
      context.ma_dc ??
      context.ma_hd ??
      context.ma_pgc ??
      context.ma_lock ??
      context.id
  );

export async function triggerSalesProcess(
  stageKey: string,
  context: Record<string, any> = {}
): Promise<void> {
  try {
    const rows = await SalesProcessService.list();
    const maDA = norm(context.ma_da ?? context.MaDA ?? context.maDA);
    const ofStage = rows.filter((r) => r.process_key === stageKey);
    const b =
      (maDA ? ofStage.find((r) => norm(r.ma_da) === maDA) : undefined) ||
      ofStage.find((r) => !norm(r.ma_da));
    if (!b || b.active === false || !b.workflow_id) return;
    const entityId = salesProcessEntityId(context);
    const ctx = { stage: stageKey, entity_id: entityId, ...context };
    if ((b.run_mode || "async") === "sync") {
      await AutomationV2Service.runOnServer(b.workflow_id, ctx);
    } else {
      await AutomationV2Service.enqueueJob(b.workflow_id, ctx, {
        entity: salesProcessEntity(stageKey),
        entity_id: entityId || undefined,
        name: `Quy trình bán hàng · ${b.name}`,
      });
    }
  } catch (e) {
    console.warn("[SalesProcess] Không chạy được automation cho bước", stageKey, e);
  }
}

/** Trạng thái chạy quy trình của 1 bản ghi nghiệp vụ */
export interface SalesProcessRun {
  entity_id: string;
  /** pending | running | waiting | success | failed | cancelled */
  status: string;
  execution_id?: string | null;
  job_id?: string | null;
  workflow_id?: string | null;
  workflow_name?: string | null;
  error_message?: string | null;
  resume_at?: string | null;
  finished_at?: string | null;
  created_at?: string | null;
}

const RUNNING_STATUSES = new Set(["pending", "queued", "running", "waiting", "retry"]);
export const isSalesProcessRunning = (s?: string | null) => !!s && RUNNING_STATUSES.has(s);

/**
 * Lấy trạng thái chạy automation mới nhất của từng bản ghi cho 1 bước quy trình.
 * Gộp dữ liệu từ hàng đợi công việc và lịch sử thực thi.
 */
export async function fetchSalesProcessRuns(
  stageKey: string,
  entityIds: string[]
): Promise<Record<string, SalesProcessRun>> {
  const ctdk = currentMaCTDK();
  const ids = Array.from(new Set((entityIds || []).map(norm).filter(Boolean)));
  const out: Record<string, SalesProcessRun> = {};
  if (!ctdk || !ids.length) return out;
  try {
    const [jobsRes, execRes] = await Promise.all([
      supabase
        .from("av2_jobs" as any)
        .select("id,status,entity_id,execution_id,workflow_id,workflow_name,error_message,created_at,finished_at")
        .eq("ma_ctdk", ctdk)
        .eq("entity", salesProcessEntity(stageKey))
        .in("entity_id", ids)
        .order("created_at", { ascending: true }),
      supabase
        .from("av2_executions" as any)
        .select("id,status,input,workflow_id,workflow_name,error_message,created_at,finished_at,resume_at")
        .eq("ma_ctdk", ctdk)
        .filter("input->>stage", "eq", stageKey)
        .filter("input->>entity_id", "in", `(${ids.map((i) => `"${i}"`).join(",")})`)
        .order("created_at", { ascending: true }),
    ]);

    for (const j of ((jobsRes as any)?.data || []) as any[]) {
      const key = norm(j.entity_id);
      if (!key) continue;
      out[key] = {
        entity_id: key,
        status: j.status === "queued" ? "pending" : j.status,
        execution_id: j.execution_id ?? null,
        job_id: j.id,
        workflow_id: j.workflow_id ?? null,
        workflow_name: j.workflow_name ?? null,
        error_message: j.error_message ?? null,
        created_at: j.created_at ?? null,
        finished_at: j.finished_at ?? null,
      };
    }
    // Lịch sử thực thi có thông tin chi tiết hơn → ưu tiên ghi đè
    for (const e of ((execRes as any)?.data || []) as any[]) {
      const key = norm(e?.input?.entity_id);
      if (!key) continue;
      out[key] = {
        entity_id: key,
        status: e.status,
        execution_id: e.id,
        job_id: out[key]?.job_id ?? null,
        workflow_id: e.workflow_id ?? null,
        workflow_name: e.workflow_name ?? out[key]?.workflow_name ?? null,
        error_message: e.error_message ?? null,
        resume_at: e.resume_at ?? null,
        created_at: e.created_at ?? null,
        finished_at: e.finished_at ?? null,
      };
    }
  } catch (e) {
    console.warn("[SalesProcess] Không đọc được trạng thái chạy", e);
  }
  return out;
}

export default SalesProcessService;
