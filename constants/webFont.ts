import { Platform } from "react-native";

// Font dùng chung cho toàn bộ bản web. Be Vietnam Pro được thiết kế cho tiếng Việt
// (dấu rõ, cân đối), phổ biến trong các sản phẩm Việt hiện nay.
export const WEB_FONT_FAMILY = "Be Vietnam Pro";

const GOOGLE_FONT_URL =
  "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600;700;800&display=swap";

const FALLBACK_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export function applyWebFont() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  if (document.getElementById("app-web-font")) return;

  const head = document.head;

  for (const href of ["https://fonts.googleapis.com", "https://fonts.gstatic.com"]) {
    const preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = href;
    if (href.includes("gstatic")) preconnect.crossOrigin = "anonymous";
    head.appendChild(preconnect);
  }

  const fontLink = document.createElement("link");
  fontLink.id = "app-web-font";
  fontLink.rel = "stylesheet";
  fontLink.href = GOOGLE_FONT_URL;
  head.appendChild(fontLink);

  // react-native-web gán font hệ thống cho Text/TextInput qua một class đơn (.css-xxx), nên
  // "body [class]" có độ ưu tiên cao hơn để ghi đè. Bỏ qua phần tử có font-family inline
  // để font icon (Ionicons...) không bị ảnh hưởng.
  const style = document.createElement("style");
  style.textContent = `
    html, body { font-family: "${WEB_FONT_FAMILY}", ${FALLBACK_STACK}; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    body [class]:not([style*="font-family"]), body input, body textarea, body button { font-family: "${WEB_FONT_FAMILY}", ${FALLBACK_STACK}; }
  `;
  head.appendChild(style);
}
