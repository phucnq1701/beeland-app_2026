import axiosApi from "./axiosApi";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const NotificationService = {
    
  getNotifications: async (payload: any = {}) => {
    const dataInit = {
      ...payload,
    };
    return await axiosApi
      .post("api/admin/get-notifications", dataInit)
      .then((res) => res.data);
  },
};
