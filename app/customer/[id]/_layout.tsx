import { Stack } from "expo-router";

/** Các màn khách hàng tự dựng AppHeader (design system) → tắt header mặc định. */
export default function CustomerDetailLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
