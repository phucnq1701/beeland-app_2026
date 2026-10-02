import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";

import { HomeSectionHeader } from "@/components/home/HomeSectionHeader";
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
import { colors, elevation, radius, space } from "@/theme";
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
      <Button
        variant="ghost"
        title="Đăng nhập lại"
        onPress={() => router.push("/login")}
        style={[styles.center, styles.pill]}
      />
    </>
  ) : (
    <>
      <View style={styles.hero}>
        <Avatar name={user?.HoTen || "?"} size={56} round />
        <Text variant="title" align="center">
          {user?.HoTen || "Chưa cập nhật họ tên"}
        </Text>
        {user?.Email ? (
          <Text variant="caption" color="textSecondary" align="center">
            {user.Email}
          </Text>
        ) : null}
      </View>
      <HomeSectionHeader title="Thông tin liên hệ" />
      <Card style={styles.card} padding={0}>
        <View style={styles.rows}>
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
        </View>
      </Card>
    </>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen header={<AppHeader variant="soft" title="Thông tin cá nhân" />} padded={false}>
        <View style={styles.body}>{body}</View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.md },
  hero: {
    alignItems: "center",
    gap: space.xs,
    paddingTop: space.xl,
    paddingBottom: space.xl,
    paddingHorizontal: space.lg,
    borderRadius: radius.x3,
    backgroundColor: colors.surface,
    ...elevation.soft,
  },
  card: { borderWidth: 0, borderRadius: radius.xxl, ...elevation.soft },
  rows: { paddingHorizontal: space.lg + 2, paddingVertical: space.xs },
  center: { alignSelf: "center" },
  pill: { borderRadius: radius.full },
});
