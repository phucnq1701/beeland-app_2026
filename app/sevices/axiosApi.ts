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

// const API_URL = 'https://apibeehomecore.appbeesky.com';
const API_URL = "https://api-beeland.beesky.vn/";
const axiosApi = axios.create({
  baseURL: API_URL,
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
    return config;
  },
  (error) => Promise.reject(error)
);

export default axiosApi;
