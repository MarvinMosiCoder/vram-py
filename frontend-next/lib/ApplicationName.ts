import api from "@/lib/http";

const getAppName = async () => {
  try {
    const response = await api.get<string>("/system/appname");
    return response.data || "VRAM";
  } catch (error) {
    console.error("Error fetching app name:", error);
    return "VRAM";
  }
};

export default getAppName;