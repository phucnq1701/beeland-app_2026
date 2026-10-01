import { Stack } from 'expo-router';

/** Các màn báo cáo tự dựng AppHeader (design system) → tắt header mặc định. */
export default function ReportsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
