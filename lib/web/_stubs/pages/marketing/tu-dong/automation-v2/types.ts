// ⚠️ TỰ SINH — kiểu trích nguyên văn (module không thuần) từ web src/pages/marketing/tu-dong/automation-v2/types.ts (scripts/sync-web-pricing.cjs): AV2Edge, AV2Execution, AV2ExecutionStep, AV2Integration, AV2Node, AV2Template, AV2Workflow, AV2WorkflowVersion. KHÔNG SỬA TAY.
// ===== AUTOMATION V2 — Kiểu dữ liệu (độc lập hoàn toàn với Automation V1) =====

export type AV2NodeType =
  | "trigger"
  | "condition"
  | "action"
  | "delay"
  | "integration"
  | "approval"
  | "end";

export type AV2TriggerType = "event" | "schedule" | "manual" | "api" | "webhook";

export type AV2WorkflowStatus = "draft" | "active" | "inactive" | "archived";

export type AV2ExecutionStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "waiting"
  | "retry"
  | "skipped"
  | "cancelled";

export type AV2Operator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "not_contains"
  | "in"
  | "is_empty"
  | "is_not_empty"
  | "before_today"
  | "after_today";

export interface AV2Condition {
  id: string;
  field: string;
  operator: AV2Operator;
  value?: string;
  data_type?: "string" | "number" | "boolean" | "date" | "currency" | "enum";
}

export interface AV2ConditionGroup {
  logic: "and" | "or";
  not?: boolean;
  conditions: AV2Condition[];
  groups?: AV2ConditionGroup[];
}

export interface AV2NodeData {
  label: string;
  description?: string;
  /** trigger */
  trigger_type?: AV2TriggerType;
  event_code?: string;
  schedule_cron?: string;
  /** condition */
  condition_group?: AV2ConditionGroup;
  /** action */
  action_type?: string;
  action_config?: Record<string, any>;
  template_id?: string | null;
  integration_id?: string | null;
  /** delay */
  delay_minutes?: number;
  /** retry */
  max_retry?: number;
  retry_interval_sec?: number;
  /** idempotency */
  idempotency_expr?: string;
  /** approval (bước duyệt của con người trong quy trình nghiệp vụ) */
  assignee_type?: "user" | "department" | "role" | "creator" | "manager";
  assignee_ids?: string[];
  sla_hours?: number;
  approve_label?: string;
  reject_label?: string;
  /** hành động tự động sau khi duyệt/từ chối */
  on_approve_status?: string;
  on_reject_status?: string;
}

export interface AV2Node {
  id: string;
  type: AV2NodeType;
  position: { x: number; y: number };
  data: AV2NodeData;
}

export interface AV2Edge {
  id: string;
  source: string;
  target: string;
  label?: string;
  /** nhánh: true / false / error */
  branch?: "true" | "false" | "error" | null;
}

export interface AV2Workflow {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  category: string;
  project_id: string | null;
  company_id: string | null;
  trigger_type: AV2TriggerType;
  trigger_config: Record<string, any>;
  status: AV2WorkflowStatus;
  current_version: number;
  is_template: boolean;
  run_count: number;
  success_count: number;
  failed_count: number;
  last_run_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AV2WorkflowVersion {
  id: string;
  workflow_id: string;
  version: number;
  nodes: AV2Node[];
  edges: AV2Edge[];
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AV2Execution {
  id: string;
  workflow_id: string | null;
  workflow_version: number | null;
  workflow_name: string | null;
  event_code: string | null;
  project_id: string | null;
  trigger_type: string;
  triggered_by: string | null;
  status: AV2ExecutionStatus;
  is_test: boolean;
  idempotency_key: string | null;
  input: any;
  output: any;
  error_message: string | null;
  retry_count: number;
  next_retry_at: string | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface AV2ExecutionStep {
  id: string;
  execution_id: string;
  node_id: string;
  node_type: string;
  node_label: string | null;
  step_index: number;
  status: AV2ExecutionStatus;
  input: any;
  output: any;
  error_message: string | null;
  retry_count: number;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
}

export interface AV2Template {
  id: string;
  code: string | null;
  name: string;
  channel: "email" | "sms" | "zalo" | "notification";
  subject: string | null;
  content: string;
  variables: string[];
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AV2Integration {
  id: string;
  code: string | null;
  name: string;
  kind: "accounting" | "einvoice" | "email" | "sms" | "zalo" | "api";
  provider: string | null;
  environment: string;
  base_url: string | null;
  config: Record<string, any>;
  field_mapping: Record<string, any>;
  timeout_ms: number;
  max_retry: number;
  status: "active" | "inactive" | "error";
  last_check_at: string | null;
  last_error: string | null;
  secret_names: string[];
  created_at: string;
  updated_at: string;
}
