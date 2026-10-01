import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Không tìm thấy" }} />
      <View style={styles.container}>
        <Text style={styles.title}>Trang này không tồn tại.</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Về trang chủ</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: colors.text,
    marginBottom: 16,
  },
  link: {
    marginTop: 15,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  linkText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: colors.surface,
  },
});
