import api from "../../api";

const getAppName = async () => {
  try {
    const response = await api.get("/system/appname");
    return response.data || "VRAM";
  } catch (error) {
    console.error("Error fetching app name:", error);
    return "VRAM";
  }
};

export default getAppName;