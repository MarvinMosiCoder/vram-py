import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000",
});

// Runs before every request this instance sends: if we have a saved
// token, attach it as "Authorization: Bearer <token>" so the backend
// knows who's calling (React equivalent of an axios interceptor).
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
