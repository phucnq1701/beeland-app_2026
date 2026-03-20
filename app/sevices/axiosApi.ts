// import axios, { AxiosInstance } from "axios";

// export const API_URL = (): string => {
//   return "https://api-beeland.beesky.vn/";
// };
// const axiosApi = (headers?: Record<string, string>): AxiosInstance => {
//   return axios.create({
//     baseURL: "https://api-beeland.beesky.vn/",
//     headers: {
//       "Content-Type": "application/json",
//       ...headers,
//     },
//   });
// };

// export default axiosApi;

import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "https://api-beeland.beesky.vn/";
const axiosApi = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json;charset=utf-8",
  },
});

axiosApi.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem("@token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.log("[API Request Error]", error?.message);
    return Promise.reject(error);
  }
);

axiosApi.interceptors.response.use(
  (response) => {
    console.log(`[API Response] ${response.config.url} - Status: ${response.status}`);
    return response;
  },
  (error) => {
    if (error.code === "ECONNABORTED") {
      console.log("[API Timeout]", error.config?.url);
    } else if (!error.response) {
      console.log("[API Network Error]", error.config?.url, error.message);
    } else {
      console.log(`[API Error] ${error.config?.url} - Status: ${error.response?.status}`);
    }
    return Promise.reject(error);
  }
);

export default axiosApi;
