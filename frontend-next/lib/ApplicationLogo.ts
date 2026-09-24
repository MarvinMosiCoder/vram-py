import api from "@/lib/http";

const getAppLogo = async () => {
    try {
        const response = await api.get<string>("/system/logo");
        return response.data || '/images/settings/vram-logo/vram-logo.webp';
    } catch (error) {
        console.error('Error fetching app logo:', error);
        return '/images/settings/vram-logo/vram-logo.webp';
    }
};

export default getAppLogo;