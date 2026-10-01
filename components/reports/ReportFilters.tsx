import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { Chip, DateField, SelectField } from "@/components/ui";
import { PERIODS, PERIOD_LABEL, PeriodType, periodRange, toYmd } from "@/lib/reportPeriod";
import { space } from "@/theme";
import { ProjectService } from "@/sevicesSupabase/ProjectService";

export type ReportFilterValue = {
  period: PeriodType;
  customFrom?: string | null;
  customTo?: string | null;
  projectId: string | null;
};

export const DEFAULT_REPORT_FILTER: ReportFilterValue = { period: "week", projectId: null };

/** Khoảng ngày + dự án đưa vào ReportService. */
export function reportQuery(f: ReportFilterValue) {
  const { from, to } = periodRange(f.period, new Date(), { from: f.customFrom, to: f.customTo });
  return { from, to, projectId: f.projectId };
}

const ALL = "__all__";
const ymdToDate = (s?: string | null) => (s ? new Date(`${s}T12:00:00`) : null);

/** Bộ lọc báo cáo: kỳ (chip), khoảng ngày khi "Tuỳ chọn", dự án. */
export function ReportFilters({
  value,
  onChange,
  showPeriod = true,
}: {
  value: ReportFilterValue;
  onChange: (v: ReportFilterValue) => void;
  showPeriod?: boolean;
}) {
  const [projects, setProjects] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    ProjectService.getProjects({})
      .then((r: any) =>
        setProjects(
          (r?.data ?? [])
            .filter((p: any) => p?.MaDA)
            .map((p: any) => ({ value: String(p.MaDA), label: String(p.TenDA ?? p.MaDA) }))
        )
      )
      .catch(() => setProjects([]));
  }, []);

  return (
    <View style={styles.wrap}>
      {showPeriod ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {PERIODS.map((p) => (
            <Chip key={p} label={PERIOD_LABEL[p]} selected={value.period === p} onPress={() => onChange({ ...value, period: p })} />
          ))}
        </ScrollView>
      ) : null}
      {showPeriod && value.period === "custom" ? (
        <View style={styles.dates}>
          <DateField
            label="Từ ngày"
            value={ymdToDate(value.customFrom)}
            onChange={(d) => onChange({ ...value, customFrom: toYmd(d) })}
          />
          <DateField
            label="Đến ngày"
            value={ymdToDate(value.customTo)}
            minimumDate={ymdToDate(value.customFrom) ?? undefined}
            onChange={(d) => onChange({ ...value, customTo: toYmd(d) })}
          />
        </View>
      ) : null}
      <SelectField
        label="Dự án"
        value={value.projectId ?? ALL}
        options={[{ value: ALL, label: "Tất cả dự án" }, ...projects]}
        onChange={(v) => onChange({ ...value, projectId: v === ALL ? null : String(v) })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  chips: { gap: space.sm, paddingRight: space.lg },
  dates: { flexDirection: "row", gap: space.md },
});
