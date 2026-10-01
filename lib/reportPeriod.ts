/**
 * Kỳ báo cáo (Hôm nay / Tuần này / Tháng này / Năm nay / Tuỳ chọn) → khoảng ngày YYYY-MM-DD theo giờ máy.
 * Giữ đúng cách tính của màn Báo cáo cũ (tuần bắt đầu thứ Hai). Không import gì để test nạp trực tiếp được.
 */

export type PeriodType = 'today' | 'week' | 'month' | 'year' | 'custom';

export const PERIOD_LABEL: Record<PeriodType, string> = {
  today: 'Hôm nay',
  week: 'Tuần này',
  month: 'Tháng này',
  year: 'Năm nay',
  custom: 'Tuỳ chọn',
};

export const PERIODS: PeriodType[] = ['today', 'week', 'month', 'year', 'custom'];

export const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function periodRange(
  period: PeriodType,
  today: Date = new Date(),
  custom: { from?: string | null; to?: string | null } = {}
): { from: string; to: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  switch (period) {
    case 'today':
      return { from: toYmd(today), to: toYmd(today) };
    case 'week': {
      const dow = today.getDay();
      const mon = new Date(y, m, today.getDate() + (dow === 0 ? -6 : 1 - dow));
      const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
      return { from: toYmd(mon), to: toYmd(sun) };
    }
    case 'month':
      return { from: toYmd(new Date(y, m, 1)), to: toYmd(new Date(y, m + 1, 0)) };
    case 'year':
      return { from: toYmd(new Date(y, 0, 1)), to: toYmd(new Date(y, 11, 31)) };
    case 'custom': {
      const a = custom.from || toYmd(today);
      const b = custom.to || custom.from || toYmd(today);
      return a <= b ? { from: a, to: b } : { from: b, to: a };
    }
  }
}
