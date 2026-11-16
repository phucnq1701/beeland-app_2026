import { errorMessage } from "@/services/nvApi";
import { DuAnApi } from "@/services/SanPhamApi";

/**
 * Danh sách dự án người đăng nhập được xem (`fn_nv_app_du_an_list` — bộ API riêng app nhân viên, lõi chung với web
 * fn_da_project_list): máy chủ tự áp công ty + phạm vi (đại lý ⇒ dự án của đại lý; nội bộ ⇒ dự án được gán; toàn quyền ⇒ tất cả),
 * chỉ dự án đang áp dụng, kèm ảnh dự án. Dùng cho màn Dự án, Trang chủ và mọi ô chọn dự án.
 * Lỗi ⇒ `{ data: [], error }` (màn tự báo) — không còn trả rỗng im lặng.
 */
export const ProjectService = {
  getProjects: async (payload: any = {}) => {
    const size = Math.max(1, Number(payload?.limit ?? payload?.Limit ?? 200) || 200);
    const keyword = String(payload?.keyword ?? payload?.InputSearch ?? "").trim();
    try {
      const { rows, total } = await DuAnApi.list({ keyword, size });
      return { data: rows, total };
    } catch (e) {
      console.log("ERROR getProjects (fn_nv_app_du_an_list):", errorMessage(e));
      return { data: [] as Awaited<ReturnType<typeof DuAnApi.list>>["rows"], total: 0, error: errorMessage(e) };
    }
  },
};
