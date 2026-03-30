import axiosApi from "./axiosApi";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const ProjectService = {
  getProjects: async (payload: any = {}) => {
    const tenCTDKVT =
      (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";

    const dataInit = {
      TenCTDKVT: tenCTDKVT,
      ...payload,
    };

    return await axiosApi
      .post("api/beeland/get-project", dataInit)
      .then((res) => res.data);
  },


};