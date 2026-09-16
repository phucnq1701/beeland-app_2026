import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getValidSupabaseJwt, isJwtExpired } from "./cloudTenant";

const API_URL = "https://api-beelandv2.beesky.vn";

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
      // rest/v1 bắt buộc JWT còn hạn, hết hạn thì dùng anon để tránh PGRST303
      const validJwt = await getValidSupabaseJwt();
      if (validJwt) {
        config.headers.Authorization = `Bearer ${validJwt}`;
      } else {
        const expired = await AsyncStorage.getItem("@supabase_jwt");
        if (expired && isJwtExpired(expired)) {
          console.log(
            `[Auth] JWT expired, gọi ${config.url} bằng anon-key, cần đăng nhập lại để có RLS đầy đủ`
          );
        }
        config.headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
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