// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/workflows/approvalFlow.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { supabase } from "../../_shims/integrations/supabase/client";
import { toRpcError } from "../../lib/rpcError";

/**
 * Quy trình phê duyệt nhiều cấp theo loại nghiệp vụ + dự án (spec api-beeland-new/docs/superpowers/specs/2026-11-08-quy-trinh-phe-duyet-nhieu-cap-design.md).
 * Mọi thao tác qua RPC .NET (api/tu-dong-hoa/fn_wf_*): chọn quy trình, chụp sơ đồ, chạy song song / điều kiện / trả lại đều ở máy chủ.
 */

export type ApprovalBusinessType =
  | "PRICE_SHEET"
  | "PRICE_SHEET_TEMPLATE"
  | "THU_TUC"
  | "TTDC"
  | "HDMB"
  | "GIA_HAN"
  | "DCTT"
  | "TL_TTDC"
  | "TL_HDMB"
  | "TB_TIEN_DO";

/** Nhãn bước đang mở của một chứng từ (backend trả mảng; rỗng khi không có gì để hiển thị). */
export interface WfNhan {
  step_run_id: string;
  ten: string | null;
  trang_thai: "CHO_DUYET" | "TU_CHOI" | "TRA_LAI";
  nguoi_xu_ly: string | null;
  han_xu_ly: string | null;
}

export const WF_NHAN_LABEL: Record<WfNhan["trang_thai"], string> = {
  CHO_DUYET: "chờ duyệt",
  TU_CHOI: "từ chối",
  TRA_LAI: "trả lại",
};

export const wfNhanText = (n: WfNhan[] | null | undefined): string =>
  (n ?? []).map((x) => `${x.ten?.trim() || "Đang xử lý"} (${WF_NHAN_LABEL[x.trang_thai]})`).join(", ");

export interface BusinessTypeVar {
  key: string;
  ten: string;
  kieu: "number" | "text";
}

export interface BusinessType {
  ma: ApprovalBusinessType;
  ten: string;
  base_path: string | null;
  bien_dieu_kien: BusinessTypeVar[];
}

export type StepRunStatus = "CHO" | "DANG_XU_LY" | "DA_DUYET" | "TRA_LAI" | "TU_CHOI" | "HUY";

export interface StepRun {
  id: string;
  node_id: string;
  loai: "approval" | "execution" | "split" | "join" | "condition" | "end";
  ten_buoc: string | null;
  nhan_hien_thi: string | null;
  kieu_duyet: "single" | "any" | "all" | null;
  trang_thai: StepRunStatus;
  lan: number;
  nhanh: string;
  tu_buoc_run_id: string | null;
  bat_dau_luc: string;
  han_xu_ly: string | null;
  ket_thuc_luc: string | null;
  ket_qua_ghi_chu: string | null;
  qua_han: boolean;
}

export interface StepTask {
  id: string;
  step_run_id: string | null;
  step_id: string | null;
  step_name: string | null;
  task_type: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  status: "pending" | "in_progress" | "approved" | "rejected" | "returned" | "cancelled";
  action_taken: string | null;
  comment: string | null;
  deadline: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ReturnTarget {
  node_id: string;
  ten: string | null;
  loai: string;
}

export interface MyStepTask {
  task_id: string;
  step_run_id: string;
  node_id: string;
  loai: "approval" | "execution";
  ten_buoc: string | null;
  kieu_duyet: string | null;
  co_tu_choi: boolean;
  dich_tra_lai: ReturnTarget[];
}

export interface ApprovalHistoryRow {
  id: string;
  submission_id: string;
  step_id: string | null;
  step_name: string | null;
  action: string | null;
  performer_name: string | null;
  comment: string | null;
  created_at: string;
  lan_gui: number | null;
}

export interface FlowNodeLite {
  id: string;
  type: string;
  position?: { x: number; y: number };
  data?: Record<string, any>;
}

export interface FlowEdgeLite {
  id?: string;
  source: string;
  target: string;
  label?: string;
}

export interface ApprovalProgress {
  co_quy_trinh: boolean;
  quy_trinh: { id: string; workflow_code: string | null; workflow_name: string; phien_ban: number } | null;
  submission: {
    id: string;
    submission_code: string | null;
    status: "pending" | "approved" | "rejected" | "draft" | "cancelled";
    submitted_by: string | null;
    submitted_at: string | null;
    completed_at: string | null;
    lan_gui: number | null;
    phien_ban: number | null;
    workflow_id: string | null;
    workflow_name: string | null;
    so_do: { nodes: FlowNodeLite[]; edges: FlowEdgeLite[] } | null;
  } | null;
  runs: StepRun[];
  tasks: StepTask[];
  history: ApprovalHistoryRow[];
  viec_cua_toi: MyStepTask[];
  co_the_gui: boolean;
  co_the_thu_hoi: boolean;
  so_lan_gui: number;
}

export interface ProjectFlow {
  da_project_id: string;
  workflow_id: string;
  workflow_code: string | null;
  workflow_name: string;
  phien_ban: number;
}

export type StepAction = "approve" | "complete" | "return" | "reject";

const rpc = async <T = any>(fn: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw toRpcError(error);
  return data as T;
};

export const ApprovalFlowService = {
  businessTypes: () => rpc<BusinessType[]>("fn_wf_loai_nghiep_vu", {}),

  /** Dự án nào đã có quy trình đang Hoạt động (null ⇒ mọi dự án) */
  projectFlows: (loai: ApprovalBusinessType, projectIds?: string[] | null) =>
    rpc<ProjectFlow[]>("fn_wf_quy_trinh_ap_dung", {
      p_loai: loai,
      p_da_project_ids: projectIds && projectIds.length ? projectIds : null,
    }),

  progress: (loai: ApprovalBusinessType, id: string) =>
    rpc<ApprovalProgress>("fn_wf_tien_trinh", { p_loai: loai, p_doi_tuong_id: id }),

  submit: (loai: ApprovalBusinessType, id: string, note?: string | null) =>
    rpc<{ submission_id: string; submission_code: string; status: string }>("fn_wf_gui_duyet", {
      p_loai: loai,
      p_doi_tuong_id: id,
      p_ghi_chu: note?.trim() || null,
    }),

  recall: (loai: ApprovalBusinessType, id: string, reason?: string | null) =>
    rpc("fn_wf_thu_hoi", { p_loai: loai, p_doi_tuong_id: id, p_ly_do: reason?.trim() || null }),

  /** returnTo: 'truoc' (bước liền trước) | node_id | 'nguoi_tao' */
  act: (taskId: string, action: StepAction, comment?: string | null, returnTo?: string | null) =>
    rpc<{ task_id: string; task_status: string; submission_status: string }>("fn_wf_xu_ly", {
      p_task_id: taskId,
      p_action: action,
      p_comment: comment?.trim() || null,
      p_tra_ve: returnTo || null,
    }),

  validate: (loai: string, nodes: unknown[], edges: unknown[]) =>
    rpc<{ ok: boolean; loi: string[] }>("fn_wf_kiem_tra_so_do", { p_loai: loai, p_nodes: nodes, p_edges: edges }),

  createFromTemplate: (projectId: string, types: ApprovalBusinessType[]) =>
    rpc<{ id: string; workflow_code: string; workflow_name: string; loai_nghiep_vu: string }[]>("fn_wf_tao_tu_mau", {
      p_da_project_id: projectId,
      p_loai_list: types,
    }),
};

export const STEP_RUN_STATUS_META: Record<StepRunStatus, { label: string; color: string }> = {
  CHO: { label: "Chờ đủ nhánh", color: "default" },
  DANG_XU_LY: { label: "Đang xử lý", color: "processing" },
  DA_DUYET: { label: "Đã duyệt", color: "success" },
  TRA_LAI: { label: "Trả lại", color: "warning" },
  TU_CHOI: { label: "Từ chối", color: "error" },
  HUY: { label: "Đã huỷ", color: "default" },
};

/** Nhãn "Đang duyệt · Chờ TP KD duyệt, Chờ Kế toán kiểm tra" từ các bước đang mở */
export const openStepLabels = (runs: StepRun[]): string[] =>
  runs
    .filter((r) => r.trang_thai === "DANG_XU_LY" && (r.loai === "approval" || r.loai === "execution"))
    .map((r) => r.nhan_hien_thi || r.ten_buoc || "Đang xử lý");
