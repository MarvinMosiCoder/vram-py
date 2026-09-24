import axios from "axios";

// Browser requests share the token stored by the existing Next.js AuthProvider.
const api = axios.create({ baseURL: "http://localhost:8080" });

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
