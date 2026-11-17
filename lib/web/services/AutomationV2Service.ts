// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/AutomationV2Service.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { supabase } from "../_shims/integrations/supabase/client";
import type {
  AV2Execution,
  AV2ExecutionStep,
  AV2Integration,
  AV2Node,
  AV2Edge,
  AV2Template,
  AV2Workflow,
  AV2WorkflowVersion,
} from "../_stubs/pages/marketing/tu-dong/automation-v2/types";

/** Mã công ty đăng nhập (multi-tenant): mọi dữ liệu Automation V2 đều gắn theo mã này. */
export const currentMaCTDK = (): string => {
  try {
    const u = JSON.parse(localStorage.getItem("authUser") || "{}");
    return String(u?.data?.maCTDK ?? u?.maCTDK ?? "") || "";
  } catch {
    return "";
  }
};

/** Gắn ma_ctdk vào payload trước khi ghi. */
const withCT = <T extends Record<string, any>>(row: T): T & { ma_ctdk: string } => ({
  ...(row as any),
  ma_ctdk: currentMaCTDK(),
});

/** Lọc theo công ty đăng nhập. */
const scoped = (q: any) => q.eq("ma_ctdk", currentMaCTDK());

/** Mã công ty được phép TẠO/SỬA mẫu automation dùng chung */
export const AV2_TEMPLATE_EDITOR_TENANTS = ["beesky", "beesky1"];

/** Chỉ beesky / beesky1 mới được sửa kho mẫu; các công ty khác chỉ xem & áp dụng. */
export const canEditAV2Templates = (): boolean =>
  AV2_TEMPLATE_EDITOR_TENANTS.includes(currentMaCTDK().trim().toLowerCase());

const assertCanEditTemplates = () => {
  if (!canEditAV2Templates())
    throw new Error("Chỉ mã công ty beesky / beesky1 mới được chỉnh sửa mẫu automation");
};

/** Mẫu quy trình dùng chung trong Kho mẫu */
export interface AV2LibraryTemplate {
  id?: string;
  code?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  tags?: string[] | null;
  trigger_type?: string | null;
  trigger_config?: any;
  nodes?: AV2Node[] | any;
  edges?: AV2Edge[] | any;
  is_published?: boolean;
  usage_count?: number;
  owner_ctdk?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

const actor = () => {
  try {
    const u = JSON.parse(localStorage.getItem("authUser") || "{}");
    return u?.TenNV || u?.HoTen || u?.UserName || "Hệ thống";
  } catch {
    return "Hệ thống";
  }
};

async function audit(entity_type: string, entity_id: string | null, action: string, detail: any = {}) {
  await supabase.from("av2_audit_logs").insert(withCT({
    entity_type,
    entity_id,
    action,
    actor: actor(),
    detail,
  }) as any);
}

export const AutomationV2Service = {
  actor,
  audit,

  // ===== WORKFLOW =====
  async listWorkflows(): Promise<AV2Workflow[]> {
    const { data, error } = await supabase
      .from("av2_workflows")
      .select("*")
      .eq("ma_ctdk", currentMaCTDK())
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data || []) as any;
  },

  async getWorkflow(id: string): Promise<AV2Workflow | null> {
    const { data, error } = await scoped(supabase.from("av2_workflows").select("*").eq("id", id)).maybeSingle();
    if (error) throw error;
    return (data as any) || null;
  },

  async createWorkflow(payload: Partial<AV2Workflow>): Promise<AV2Workflow> {
    const { data, error } = await supabase
      .from("av2_workflows")
      .insert(withCT({ ...(payload as any), created_by: actor() }) as any)
      .select("*")
      .single();
    if (error) throw error;
    await supabase.from("av2_workflow_versions").insert(withCT({
      workflow_id: data.id,
      version: 1,
      nodes: [],
      edges: [],
      created_by: actor(),
    }) as any);
    await audit("workflow", data.id, "create", { name: data.name });
    return data as any;
  },

  async updateWorkflow(id: string, patch: Partial<AV2Workflow>): Promise<AV2Workflow> {
    const { data, error } = await supabase
      .from("av2_workflows")
      .update(patch as any)
      .eq("id", id)
      .eq("ma_ctdk", currentMaCTDK())
      .select("*")
      .single();
    if (error) throw error;
    await audit("workflow", id, "update", patch);
    return data as any;
  },

  async setStatus(ids: string[], status: string) {
    if (!ids.length) return;
    const { error } = await scoped(supabase.from("av2_workflows").update({ status } as any).in("id", ids));
    if (error) throw error;
    await Promise.all(ids.map((id) => audit("workflow", id, status === "active" ? "activate" : "deactivate", { status })));
  },

  async deleteWorkflows(ids: string[]) {
    if (!ids.length) return;
    const { error } = await scoped(supabase.from("av2_workflows").delete().in("id", ids));
    if (error) throw error;
    await Promise.all(ids.map((id) => audit("workflow", id, "delete")));
  },

  async cloneWorkflow(id: string): Promise<AV2Workflow> {
    const wf = await this.getWorkflow(id);
    if (!wf) throw new Error("Không tìm thấy workflow");
    const ver = await this.getVersion(id, wf.current_version);
    const created = await this.createWorkflow({
      name: `${wf.name} (bản sao)`,
      description: wf.description,
      category: wf.category,
      project_id: wf.project_id,
      trigger_type: wf.trigger_type,
      trigger_config: wf.trigger_config,
      status: "draft",
    } as any);
    if (ver) await this.saveVersion(created.id, 1, ver.nodes, ver.edges, "Sao chép");
    return created;
  },

  // ===== VERSION =====
  async listVersions(workflow_id: string): Promise<AV2WorkflowVersion[]> {
    const { data, error } = await supabase
      .from("av2_workflow_versions")
      .select("*")
      .eq("ma_ctdk", currentMaCTDK())
      .eq("workflow_id", workflow_id)
      .order("version", { ascending: false });
    if (error) throw error;
    return (data || []) as any;
  },

  async getVersion(workflow_id: string, version: number): Promise<AV2WorkflowVersion | null> {
    const { data, error } = await supabase
      .from("av2_workflow_versions")
      .select("*")
      .eq("ma_ctdk", currentMaCTDK())
      .eq("workflow_id", workflow_id)
      .eq("version", version)
      .maybeSingle();
    if (error) throw error;
    return (data as any) || null;
  },

  /** Lưu đè sơ đồ vào 1 version cụ thể. */
  async saveVersion(workflow_id: string, version: number, nodes: AV2Node[], edges: AV2Edge[], note?: string) {
    const existing = await this.getVersion(workflow_id, version);
    if (existing) {
      const { error } = await supabase
        .from("av2_workflow_versions")
        .update({ nodes: nodes as any, edges: edges as any, note: note ?? existing.note } as any)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("av2_workflow_versions").insert(withCT({
        workflow_id,
        version,
        nodes: nodes as any,
        edges: edges as any,
        note,
        created_by: actor(),
      }) as any);
      if (error) throw error;
    }
    await audit("workflow_version", workflow_id, "save", { version });
  },

  /** Tạo phiên bản mới (không ảnh hưởng execution đang chạy version cũ). */
  async publishNewVersion(workflow_id: string, nodes: AV2Node[], edges: AV2Edge[], note?: string) {
    const versions = await this.listVersions(workflow_id);
    const nextVer = (versions[0]?.version || 0) + 1;
    await this.saveVersion(workflow_id, nextVer, nodes, edges, note || `Phiên bản ${nextVer}`);
    await scoped(supabase.from("av2_workflows").update({ current_version: nextVer } as any).eq("id", workflow_id));
    await audit("workflow", workflow_id, "publish_version", { version: nextVer });
    return nextVer;
  },

  async rollbackVersion(workflow_id: string, version: number) {
    await scoped(supabase.from("av2_workflows").update({ current_version: version } as any).eq("id", workflow_id));
    await audit("workflow", workflow_id, "rollback", { version });
  },

  // ===== EVENT =====
  async listEvents() {
    const { data, error } = await scoped(supabase.from("av2_events").select("*")).order("event_code");
    if (error) throw error;
    return data || [];
  },

  async upsertEvent(row: any) {
    const { data, error } = await supabase
      .from("av2_events")
      .upsert(withCT(row) as any, { onConflict: "event_code,ma_ctdk" })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async listEventLogs(limit = 200) {
    const { data, error } = await supabase
      .from("av2_event_logs")
      .select("*")
      .eq("ma_ctdk", currentMaCTDK())
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  /** Điểm vào duy nhất cho các module nghiệp vụ phát sự kiện tới Automation V2. */
  async emit(event_code: string, payload: any, meta: { entity?: string; entity_id?: string; project_id?: string } = {}) {
    const { data, error } = await supabase
      .from("av2_event_logs")
      .insert(withCT({
        event_code,
        entity: meta.entity ?? null,
        entity_id: meta.entity_id ?? null,
        project_id: meta.project_id ?? null,
        payload,
        status: "received",
      }) as any)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  // ===== EXECUTION =====
  async listExecutions(limit = 300): Promise<AV2Execution[]> {
    const { data, error } = await supabase
      .from("av2_executions")
      .select("*")
      .eq("ma_ctdk", currentMaCTDK())
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as any;
  },

  async getExecution(id: string): Promise<AV2Execution | null> {
    const { data, error } = await supabase
      .from("av2_executions")
      .select("*")
      .eq("id", id)
      .eq("ma_ctdk", currentMaCTDK())
      .maybeSingle();
    if (error) throw error;
    return (data as any) || null;
  },

  async listSteps(execution_id: string): Promise<AV2ExecutionStep[]> {
    const { data, error } = await supabase
      .from("av2_execution_steps")
      .select("*")
      .eq("ma_ctdk", currentMaCTDK())
      .eq("execution_id", execution_id)
      .order("step_index");
    if (error) throw error;
    return (data || []) as any;
  },

  async saveExecution(exec: any, steps: any[]) {
    const { data, error } = await supabase.from("av2_executions").insert(withCT(exec) as any).select("*").single();
    if (error) throw error;
    if (steps.length) {
      const rows = steps.map((s, i) => withCT({ ...s, execution_id: data.id, step_index: i }));
      const { error: e2 } = await supabase.from("av2_execution_steps").insert(rows);
      if (e2) throw e2;
    }
    return data;
  },

  // ===== TEMPLATE =====
  async listTemplates(): Promise<AV2Template[]> {
    const { data, error } = await scoped(supabase.from("av2_templates").select("*")).order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as any;
  },
  async upsertTemplate(row: any) {
    const { id, ...rest } = row || {};
    const q = id
      ? scoped(supabase.from("av2_templates").update(rest).eq("id", id)).select("*").single()
      : supabase.from("av2_templates").insert(withCT(rest) as any).select("*").single();
    const { data, error } = await q;
    if (error) throw error;
    await audit("template", data.id, id ? "update" : "create", { name: data.name });
    return data;
  },
  async deleteTemplates(ids: string[]) {
    if (!ids.length) return;
    const { error } = await scoped(supabase.from("av2_templates").delete().in("id", ids));
    if (error) throw error;
  },

  // ===== INTEGRATION =====
  async listIntegrations(): Promise<AV2Integration[]> {
    const { data, error } = await scoped(supabase.from("av2_integrations").select("*")).order("kind");
    if (error) throw error;
    return (data || []) as any;
  },
  async upsertIntegration(row: any) {
    const { id, ...rest } = row || {};
    const q = id
      ? scoped(supabase.from("av2_integrations").update(rest).eq("id", id)).select("*").single()
      : supabase.from("av2_integrations").insert(withCT(rest) as any).select("*").single();
    const { data, error } = await q;
    if (error) throw error;
    await audit("integration", data.id, id ? "update" : "create", { name: data.name });
    return data;
  },
  async deleteIntegrations(ids: string[]) {
    if (!ids.length) return;
    const { error } = await scoped(supabase.from("av2_integrations").delete().in("id", ids));
    if (error) throw error;
  },

  // ===== VARIABLE =====
  async listVariables() {
    const { data, error } = await scoped(supabase.from("av2_variables").select("*")).order("key");
    if (error) throw error;
    return data || [];
  },
  async upsertVariable(row: any) {
    const { id, ...rest } = row || {};
    const q = id
      ? scoped(supabase.from("av2_variables").update(rest).eq("id", id)).select("*").single()
      : supabase.from("av2_variables").insert(withCT(rest) as any).select("*").single();
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },
  async deleteVariables(ids: string[]) {
    if (!ids.length) return;
    const { error } = await scoped(supabase.from("av2_variables").delete().in("id", ids));
    if (error) throw error;
  },

  // ===== ENGINE (máy chủ) =====
  /** Chạy thật 1 workflow trên máy chủ (không phải mô phỏng). */
  async runOnServer(workflowId: string, context: any = {}, opts: { dryRun?: boolean; isTest?: boolean } = {}) {
    const { data, error } = await supabase.functions.invoke("av2-engine", {
      body: {
        action: "run",
        workflow_id: workflowId,
        context,
        dry_run: !!opts.dryRun,
        is_test: !!opts.isTest,
        triggered_by: localStorage.getItem("userName") || "manual",
      },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return data;
  },
  /** Bắn 1 sự kiện nghiệp vụ để kích hoạt các workflow đang hoạt động. */
  async dispatchEvent(eventCode: string, payload: any = {}, extra: Record<string, any> = {}) {
    const { data, error } = await supabase.functions.invoke("av2-engine", {
      body: { action: "dispatch", event_code: eventCode, payload, ma_ctdk: currentMaCTDK(), ...extra },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return data;
  },

  /** Đưa 1 workflow vào hàng đợi công việc để máy chủ chạy. */
  async enqueueJob(workflowId: string, context: any = {}, extra: Record<string, any> = {}) {
    const { data, error } = await supabase.functions.invoke("av2-engine", {
      body: { action: "enqueue", workflow_id: workflowId, context, ma_ctdk: currentMaCTDK(), triggered_by: actor(), ...extra },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return data;
  },

  // ===== HÀNG ĐỢI CÔNG VIỆC (JOB QUEUE) =====
  async listJobs(limit = 300) {
    const { data, error } = await supabase
      .from("av2_jobs" as any)
      .select("*")
      .eq("ma_ctdk", currentMaCTDK())
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as any[];
  },
  /** Yêu cầu máy chủ xử lý ngay các job đang chờ. */
  async workQueue(limit = 20) {
    const { data, error } = await supabase.functions.invoke("av2-engine", { body: { action: "work", limit } });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return data;
  },
  /**
   * Quét đến hạn: chạy workflow theo lịch + tiếp tục các lượt đang chờ (node Chờ)
   * + xử lý hàng đợi. Máy chủ tự chạy mỗi phút; hàm này dùng để chạy ngay/dự phòng.
   */
  async tick() {
    const { data, error } = await supabase.functions.invoke("av2-engine", { body: { action: "tick" } });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return data;
  },

  /** Đưa job về trạng thái chờ để chạy lại. */
  async retryJobs(ids: string[]) {
    if (!ids.length) return;
    const { error } = await supabase
      .from("av2_jobs" as any)
      .update({ status: "pending", attempts: 0, run_at: new Date().toISOString(), error_message: null, finished_at: null, locked_at: null, locked_by: null } as any)
      .in("id", ids);
    if (error) throw error;
  },
  async cancelJobs(ids: string[]) {
    if (!ids.length) return;
    const { error } = await supabase
      .from("av2_jobs" as any)
      .update({ status: "canceled", finished_at: new Date().toISOString() } as any)
      .in("id", ids)
      .in("status", ["pending", "running"]);
    if (error) throw error;
  },
  async deleteJobs(ids: string[]) {
    if (!ids.length) return;
    const { error } = await supabase.from("av2_jobs" as any).delete().in("id", ids);
    if (error) throw error;
  },

  // ===== AUDIT =====
  async listAudit(limit = 300) {
    const { data, error } = await supabase
      .from("av2_audit_logs")
      .select("*")
      .eq("ma_ctdk", currentMaCTDK())
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  // ===== KHO MẪU (TEMPLATE LIBRARY) =====
  /** Danh sách mẫu quy trình dùng chung (mọi công ty đều xem được) */
  async listLibraryTemplates(): Promise<AV2LibraryTemplate[]> {
    let q = supabase
      .from("av2_template_library")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    if (!canEditAV2Templates()) q = q.eq("is_published", true);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as any;
  },

  /** Thêm/sửa mẫu — chỉ mã công ty beesky / beesky1 */
  async upsertLibraryTemplate(row: Partial<AV2LibraryTemplate>) {
    assertCanEditTemplates();
    const payload: any = {
      ...row,
      owner_ctdk: row.owner_ctdk || currentMaCTDK(),
      created_by: row.created_by || actor(),
    };
    const { data, error } = await supabase
      .from("av2_template_library")
      .upsert(payload)
      .select("*")
      .single();
    if (error) throw error;
    await audit("template_library", (data as any)?.id || null, row.id ? "update" : "create", { name: row.name });
    return data as any;
  },

  /** Xóa mẫu — chỉ mã công ty beesky / beesky1 */
  async deleteLibraryTemplates(ids: string[]) {
    assertCanEditTemplates();
    if (!ids.length) return;
    const { error } = await supabase.from("av2_template_library").delete().in("id", ids);
    if (error) throw error;
    await Promise.all(ids.map((id) => audit("template_library", id, "delete")));
  },

  /** Lưu một workflow hiện có thành mẫu dùng chung */
  async saveWorkflowAsLibraryTemplate(workflow_id: string, patch: Partial<AV2LibraryTemplate> = {}) {
    assertCanEditTemplates();
    const wf = await this.getWorkflow(workflow_id);
    if (!wf) throw new Error("Không tìm thấy workflow");
    const ver = await this.getVersion(workflow_id, wf.current_version);
    return this.upsertLibraryTemplate({
      name: patch.name || wf.name,
      description: patch.description ?? wf.description,
      category: patch.category || wf.category || "general",
      trigger_type: wf.trigger_type,
      trigger_config: wf.trigger_config as any,
      nodes: (ver?.nodes || []) as any,
      edges: (ver?.edges || []) as any,
      is_published: patch.is_published ?? true,
    });
  },

  /** Áp dụng mẫu: tạo workflow nháp trong công ty đang đăng nhập */
  async applyLibraryTemplate(tpl: AV2LibraryTemplate): Promise<AV2Workflow> {
    const wf = await this.createWorkflow({
      name: tpl.name,
      description: tpl.description,
      category: tpl.category,
      trigger_type: (tpl.trigger_type as any) || "event",
      trigger_config: (tpl.trigger_config as any) || {},
      status: "draft",
    } as any);
    await this.saveVersion(wf.id, 1, (tpl.nodes as any) || [], (tpl.edges as any) || [], `Tạo từ kho mẫu: ${tpl.name}`);
    if (tpl.id)
      await supabase
        .from("av2_template_library")
        .update({ usage_count: (Number(tpl.usage_count) || 0) + 1 } as any)
        .eq("id", tpl.id);
    return wf;
  },
};

export default AutomationV2Service;
