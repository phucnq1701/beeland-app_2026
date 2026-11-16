import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFreshJwt } from "@/services/session";
import { API_URL } from "@/services/config";

/**
 * API BEELAND (.NET + SQL Server từ 01/11/2026), nhận nguyên cú pháp Supabase (`rest/v1`, `functions/v1`, `storage/v1`);
 * realtime là SignalR `/api/realtime` (`realtimeHub.ts`). Địa chỉ cũ `api-beelandv2.beesky.vn` chỉ còn chuyển tiếp tạm.
 */
export { API_URL };

export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg3NTQ2ODQ0LCJleHAiOjE5NDUyMjY4NDR9.ftDz2g-LgHuMoXnFMzTtbIfgDodnntv5fGbbonqWYiw";

const axiosApiSupabase = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    apikey: SUPABASE_ANON_KEY,
  },
});

axiosApiSupabase.interceptors.request.use(
  async (config) => {
    config.headers.apikey = SUPABASE_ANON_KEY;

    const isSupabaseRest = config.url?.startsWith("rest/v1");

    if (isSupabaseRest) {
      // rest/v1 cần JWT còn hạn: sắp / đã hết thì làm mới phiên trước (services/session.ts) — không còn lặng lẽ dùng
      // anon key (danh sách rỗng). Làm mới thất bại ⇒ gửi không JWT ⇒ máy chủ trả 401 ⇒ màn báo lỗi.
      const validJwt = await getFreshJwt();
      if (validJwt) {
        config.headers.Authorization = `Bearer ${validJwt}`;
      } else {
        console.log(`[Auth] chưa có JWT hợp lệ khi gọi ${config.url}`);
        delete config.headers.Authorization;
      }
    } else {
      const token = await AsyncStorage.getItem("@token");
      config.headers.Authorization = `Bearer ${token || SUPABASE_ANON_KEY}`;
    }

    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.log("[API Request Error]", error?.message);
    return Promise.reject(error);
  }
);

axiosApiSupabase.interceptors.response.use(
  (response) => {
    console.log(
      `[API Response] ${response.config.url} - Status: ${response.status}`
    );
    return response;
  },
  async (error) => {
    if (error.code === "ECONNABORTED") {
      console.log("[API Timeout]", error.config?.url);
    } else if (!error.response) {
      console.log("[API Network Error]", error.config?.url, error.message);
    } else {
      console.log(
        `[API Error] ${error.config?.url} - Status: ${error.response?.status}`
      );
      console.log("[API Error Data]", JSON.stringify(error.response?.data));
      const msg = JSON.stringify(error.response?.data || "");
      // JWT hết hạn: hướng dẫn đăng nhập lại, không retry vòng lặp
      if (error.response?.status === 401 && msg.includes("JWT expired")) {
        console.log(
          "[Auth] PGRST303 JWT expired -> vui lòng đăng nhập lại để lấy cloud_jwt mới. Tạm thời request đã fallback anon-key nhưng RLS có thể trả rỗng."
        );
      }
    }
    return Promise.reject(error);
  }
);

export default axiosApiSupabase;