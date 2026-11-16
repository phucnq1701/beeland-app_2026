// ⚠️ TỰ SINH — bản chép nguyên văn web src/utils/DateHelper.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
import dayjs, { Dayjs } from "dayjs";

export const DateHelper = {
    ToApiDateTime: (date?: string | Date | Dayjs | null) => {
        if (!date) return null;

        return dayjs(date).format("YYYY-MM-DDTHH:mm:ss");
    },

    /**
     * Như ToApiDateTime nhưng kèm múi giờ máy (vd. "2026-11-12T21:31:00+07:00").
     * Dùng cho ngày phiếu thu/chi: máy chủ lưu datetimeoffset và hiểu chuỗi không múi giờ là UTC
     * → thiếu múi giờ làm phiếu lệch +7 tiếng (thu sau 17h in ra ngày hôm sau).
     */
    ToApiDateTimeTz: (date?: string | Date | Dayjs | null) => {
        if (!date) return null;

        return dayjs(date).format("YYYY-MM-DDTHH:mm:ssZ");
    }
};