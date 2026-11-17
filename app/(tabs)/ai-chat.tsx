import { Redirect } from "expo-router";

/** Tab ẩn cũ (dữ liệu mẫu) → hộp thư chat thật `app/chat/index.tsx`. */
export default function LegacyChatTab() {
  return <Redirect href="/chat" />;
}
