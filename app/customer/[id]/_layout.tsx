import { Stack } from "expo-router";

export default function CustomerDetailLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Quay lại" }}>
      <Stack.Screen name="index" options={{ headerShown: true }} />
      <Stack.Screen name="contracts" options={{ headerShown: true }} />
      <Stack.Screen name="edit" options={{ headerShown: true }} />
    </Stack>
  );
}
