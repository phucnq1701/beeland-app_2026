import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";

import {
  AppHeader,
  Avatar,
  Button,
  Card,
  ErrorState,
  KeyValueRow,
  Screen,
  SkeletonDetail,
  Text,
} from "@/components/ui";
import { space } from "@/theme";
import { CloudProfileService, CloudProfile } from "@/sevicesSupabase/CloudProfileService";

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<CloudProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setUser(null);
    setError(null);
    setLoading(true);
    void CloudProfileService.userInfo().then((res) => {
      if (active) setUser(res.data);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Không tải được hồ sơ.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
    // `retry` cố ý: bấm "Thử lại" tăng retry để tải lại hồ sơ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry]));

  const body = loading ? (
    <SkeletonDetail />
  ) : error ? (
    <>
      <ErrorState title="Không tải được hồ sơ" description={error} onRetry={() => setRetry((v) => v + 1)} />
      <Button variant="ghost" title="Đăng nhập lại" onPress={() => router.push("/login")} style={styles.center} />
    </>
  ) : (
    <>
      <View style={styles.hero}>
        <Avatar name={user?.HoTen || "?"} size={56} />
        <Text variant="title" align="center">
          {user?.HoTen || "Chưa cập nhật họ tên"}
        </Text>
        {user?.Email ? (
          <Text variant="caption" color="textSecondary" align="center">
            {user.Email}
          </Text>
        ) : null}
      </View>
      <Card>
        <KeyValueRow label="Họ tên" value={user?.HoTen || "Chưa cập nhật"} />
        <KeyValueRow
          label="Email"
          value={user?.Email || "Chưa cập nhật"}
          copyValue={user?.Email || undefined}
        />
        <KeyValueRow
          label="Số điện thoại"
          value={user?.DiDong || "Chưa cập nhật"}
          copyValue={user?.DiDong || undefined}
          last
        />
      </Card>
    </>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen header={<AppHeader title="Thông tin cá nhân" />}>{body}</Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: space.xs, paddingVertical: space.lg },
  center: { alignSelf: "center" },
});
