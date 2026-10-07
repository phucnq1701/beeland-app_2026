import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Check } from "lucide-react-native";

import {
  AppHeader,
  BottomActionBar,
  Button,
  Card,
  Screen,
  StatusBadge,
  Text,
  TextField,
  useToast,
} from "@/components/ui";
import { mapCatalog, type YcCat } from "@/lib/customerRequest";
import { colors, elevation, radius, space } from "@/theme";
import { CustomerRequestService } from "@/sevicesSupabase/CustomerRequestService";

const NOTE_MAX = 2000;

/**
 * Cập nhật xử lý – như form "Cập nhật xử lý" ở web RequestDetailDrawer / RequestHistoryDrawer:
 * trạng thái mới (không chọn = giữ nguyên) + nội dung xử lý (bắt buộc) → fn_customer_request_process
 * (ghi 1 dòng lịch sử, người xử lý = nhân viên đăng nhập; khách thấy dòng này trong app khách hàng).
 */
export default function RequestProcessScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ id: string; status?: string }>();
  const current = params.status || null;
  const [statuses, setStatuses] = useState<YcCat[]>(mapCatalog([], "dm_trang_thai_yeu_cau"));
  const [next, setNext] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    CustomerRequestService.catalogs()
      .then((c) => setStatuses(c.dm_trang_thai_yeu_cau))
      .catch(() => {});
  }, []);

  const save = async () => {
    if (lock.current) return;
    if (!note.trim()) {
      setNoteError("Vui lòng nhập nội dung xử lý");
      return;
    }
    lock.current = true;
    setSaving(true);
    try {
      await CustomerRequestService.process(String(params.id ?? ""), next, note);
      toast.show({ type: "success", message: "Đã ghi nhận xử lý" });
      router.back();
    } catch (e: any) {
      toast.show({ type: "error", message: e?.message || "Không ghi nhận được" });
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        header={<AppHeader variant="soft" title="Cập nhật xử lý" subtitle="Ghi lịch sử, đổi trạng thái" />}
        padded={false}
        keyboardAware
        footer={
          <BottomActionBar>
            <Button variant="secondary" title="Huỷ" onPress={() => router.back()} style={styles.pill} />
            <Button title="Ghi nhận" loading={saving} onPress={() => void save()} style={[styles.flex, styles.pill]} />
          </BottomActionBar>
        }
      >
        <View style={styles.body}>
          <Card style={styles.card}>
            <Text variant="subhead">Trạng thái mới</Text>
            <Text variant="caption" color="textSecondary">
              Không chọn = giữ nguyên trạng thái hiện tại.
            </Text>
            <View style={styles.options}>
              {statuses.map((s) => {
                const selected = next === s.ID;
                const isCurrent = current === s.ID;
                return (
                  <Pressable
                    key={s.ID}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${s.Name}${isCurrent ? ", trạng thái hiện tại" : ""}`}
                    onPress={() => setNext(selected ? null : s.ID)}
                    style={({ pressed }) => [
                      styles.option,
                      selected ? styles.optionActive : null,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <View style={styles.optionText}>
                      <View style={styles.optionHead}>
                        <StatusBadge label={s.Name} color={s.Color} size="sm" />
                        {isCurrent ? (
                          <Text variant="label" color="textTertiary">
                            Hiện tại
                          </Text>
                        ) : null}
                      </View>
                      {s.GhiChu ? (
                        <Text variant="caption" color="textSecondary" numberOfLines={1}>
                          {s.GhiChu}
                        </Text>
                      ) : null}
                    </View>
                    {selected ? <Check size={20} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Card style={styles.card}>
            <TextField
              variant="soft"
              label="Nội dung xử lý"
              required
              multiline
              value={note}
              maxLength={NOTE_MAX}
              onChangeText={(t) => {
                setNote(t);
                if (noteError) setNoteError(null);
              }}
              placeholder="Mô tả công việc đã thực hiện, kết quả trao đổi với khách…"
              error={noteError}
              helper={`${note.length}/${NOTE_MAX} · Khách hàng xem được nội dung này trong app khách hàng`}
              style={styles.note}
            />
          </Card>
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.xl, gap: space.md },
  card: {
    borderWidth: 0,
    borderRadius: radius.xxl,
    paddingHorizontal: space.lg + 2,
    gap: space.sm,
    ...elevation.soft,
  },
  options: { gap: space.sm, marginTop: space.xs },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: colors.surfaceMuted,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySubtle },
  optionText: { flex: 1, gap: space.xs },
  optionHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  pressed: { opacity: 0.85 },
  note: { minHeight: 120, textAlignVertical: "top" },
  pill: { borderRadius: radius.full },
});
