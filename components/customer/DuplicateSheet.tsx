import React, { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ShieldAlert, UserCheck } from "lucide-react-native";

import { Badge, BadgeTone, BottomSheet, Button, Card, Text, TextField, useToast } from "@/components/ui";
import { CustomerFormValues, PROTECTION_LABEL, ProtectionLevel, duplicateFieldLabel } from "@/lib/customerRules";
import { maskPhone } from "@/lib/format";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { colors, space } from "@/theme";
import { CustomerRulesService, DuplicateMatch, DuplicateResult } from "@/sevicesSupabase/CustomerRulesService";

const PROTECTION_TONE: Record<ProtectionLevel, BadgeTone> = {
  none: "neutral",
  low: "info",
  medium: "warning",
  high: "danger",
};

/**
 * Hộp báo trùng khách hàng – như web components/Customers/DuplicateGuardModal.tsx:
 *  - block: không cho lưu; chỉ xem/dùng khách đã có.
 *  - request: gửi yêu cầu kèm ghi chú để quản lý phân xử (khách đầu tiên trong danh sách, như web).
 */
export function DuplicateSheet({
  visible,
  result,
  values,
  useExistingLabel,
  onClose,
  onUseExisting,
  onRequested,
}: {
  visible: boolean;
  result: DuplicateResult | null;
  values: CustomerFormValues;
  useExistingLabel: string;
  onClose: () => void;
  onUseExisting: (match: DuplicateMatch) => void;
  onRequested: () => void;
}) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);

  if (!result) return null;
  const isRequest = result.mode === "request";

  const send = async () => {
    const match = result.matches[0];
    if (!match || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const res = await CustomerRulesService.createDuplicateRequest(match, values, note.trim());
      if (res.ok) {
        hapticSuccess();
        toast.show({ type: "success", message: "Đã gửi yêu cầu, chờ quản lý phân xử" });
        setNote("");
        onRequested();
      } else {
        hapticError();
        toast.show({ type: "error", message: res.message || "Gửi yêu cầu không thành công" });
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={isRequest ? "Khách hàng bị trùng — cần gửi yêu cầu" : "Không cho phép trùng khách hàng"}
      maxHeightRatio={0.85}
    >
      <View style={styles.body}>
        <View style={styles.intro}>
          <ShieldAlert size={20} color={isRequest ? colors.warning : colors.danger} />
          <Text variant="caption" color="textSecondary" style={styles.flex}>
            {isRequest
              ? "Thông tin này trùng với khách hàng đã có. Gửi yêu cầu để quản lý quyết định cho tạo mới hay dùng khách cũ."
              : "Thông tin này trùng với khách hàng đã có nên không thể tạo / lưu. Hãy dùng hồ sơ khách đã có."}
          </Text>
        </View>

        {result.matches.map((m) => (
          <Card key={m.customerId} style={styles.card}>
            <View style={styles.matchHead}>
              <View style={styles.flex}>
                <Text variant="subhead" numberOfLines={1}>
                  {m.customerName}
                </Text>
                <Text variant="caption" color="textSecondary" numberOfLines={1}>
                  {[m.customerCode, m.phone ? maskPhone(m.phone) : null].filter(Boolean).join(" · ") || "—"}
                </Text>
              </View>
              <Badge label={PROTECTION_LABEL[m.protection.level]} tone={PROTECTION_TONE[m.protection.level]} />
            </View>
            <Text variant="caption" color="textSecondary">
              Trùng: {m.fields.map(duplicateFieldLabel).join(", ")}
            </Text>
            <Text variant="caption" color="textSecondary">
              Phụ trách: {m.isOwn ? "Bạn" : m.ownerName || "—"}
            </Text>
            {m.protection.reasons.length ? (
              <Text variant="caption" color="textTertiary">
                {m.protection.reasons.join(" · ")}
              </Text>
            ) : null}
            <Button
              title={useExistingLabel}
              variant="secondary"
              icon={UserCheck}
              onPress={() => onUseExisting(m)}
              style={styles.useBtn}
            />
          </Card>
        ))}

        {isRequest ? (
          <>
            <TextField
              label="Ghi chú cho quản lý"
              placeholder="Lý do cần tạo khách hàng mới…"
              value={note}
              onChangeText={setNote}
              multiline
            />
            <Button title="Gửi yêu cầu" size="lg" loading={sending} onPress={() => void send()} />
          </>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md, paddingBottom: space.lg },
  intro: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  flex: { flex: 1 },
  matchHead: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.xs },
  card: { gap: space.xs },
  useBtn: { marginTop: space.sm },
});
