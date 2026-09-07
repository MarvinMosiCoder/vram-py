import React, { useContext, useEffect, useState } from "react";
import ContentPanel from "../../../components/panel/ContentPanel";
import { NavbarContext } from "../../../context/NavbarContext";
import { useProfile, useTheme } from "../../../context/ThemeContext";
import useThemeStyles from "../../../hooks/useThemeStyles";
import colorMap from "../../../components/avatar/colorMap";
import api from "../../../api";
import { formatToastMessage, useToast } from "../../../context/ToastContext";
import Modal from "../../../components/modal/Modal";
import {
    Camera,
    CheckCircle2,
    Download,
    Images,
    Loader2,
    Mail,
    RefreshCw,
    ShieldCheck,
    Trash2,
    Upload,
    UserRound,
} from "lucide-react";

const avatarOptions = [
    { id: "ai-avatar-1", ext: "png" },
    { id: "ai-avatar-2", ext: "png" },
    { id: "ai-avatar-3", ext: "png" },
    { id: "ai-avatar-4", ext: "png" },
    { id: "ai-avatar-5", ext: "png" },
    { id: "ai-avatar-6", ext: "png" },
    { id: "ai-avatar-7", ext: "png" },
    { id: "ai-avatar-8", ext: "png" },
    { id: "person-amber", ext: "svg" },
    { id: "person-rose", ext: "svg" },
    { id: "person-violet", ext: "svg" },
    { id: "support-blue", ext: "svg" },
    { id: "support-green", ext: "svg" },
    { id: "tech", ext: "svg" },
    { id: "cat", ext: "svg" },
    { id: "fox", ext: "svg" },
    { id: "panda", ext: "svg" },
].map((avatar) => ({ ...avatar, src: `/images/profile-avatars/${avatar.id}.${avatar.ext}` }));

async function profileErrorMessage(error, fallback) {
    let data = error.response?.data;
    if (data instanceof Blob) {
        try {
            data = JSON.parse(await data.text());
        } catch {
            return fallback;
        }
    }
    return formatToastMessage(data?.detail || data?.errors || data?.message) || fallback;
}

const Profile = ({ page_title, user }) => {
    const { theme } = useTheme();
    const { profile, setProfile } = useProfile();
    const { setTitle } = useContext(NavbarContext);
    const [loading, setLoading] = useState(false);
    const { textColor, textColorActive, scrollbarTheme, primayActiveColor, borderTheme } = useThemeStyles(theme);
    const [profileImage, setProfileImage] = useState();
    const { handleToast } = useToast();
    const [forms, setForms] = useState({
        profile_image: user?.profile || "",
    });
    const [showModalProfiles, setShowModalProfiles] = useState(false);
    const [showProfileChooser, setShowProfileChooser] = useState(false);
    const [chooserTab, setChooserTab] = useState("avatars");
    const [selectedAvatar, setSelectedAvatar] = useState(null);
    const [profiles, setProfiles] = useState([]);
    const [profileUpdate, setProfileUpdate] = useState(null);
    const isDark = theme === "bg-skin-black";

    useEffect(() => {
        setTitle(page_title);
        document.title = page_title;
    }, [page_title, setTitle]);

    const getInitials = (fullName = "") => {
        const names = fullName.trim().split(" ").filter(Boolean);
        if (names.length === 0) return "A";
        if (names.length === 1) return names[0].charAt(0).toUpperCase();
        return `${names[0].charAt(0)}${names[names.length - 1].charAt(0)}`.toUpperCase();
    };

    const initials = getInitials(user.name);
    const backgroundColor = colorMap[initials.charAt(0)] || theme;
    const activeProfile = typeof profile === "string" ? profile : user.profile;
    const previewSrc = profileImage || (activeProfile ? `/images/profile/${activeProfile}` : null);
    const buttonTheme = theme === "bg-skin-white" ? primayActiveColor : theme;
    const closeProfileChooser = () => {
        setShowProfileChooser(false);
        setProfileImage(null);
        setForms({ profile_image: "" });
        setSelectedAvatar(null);
    };

    const fetchProfiles = () => {
        api.get("/profiles")
        .then((response) => setProfiles(response.data))
        .catch(async (error) => {
            handleToast(await profileErrorMessage(error, "Unable to load profiles."), "error");
        });
    };

    useEffect(() => {
        fetchProfiles();
    }, []);

    const handleImageChange = (e) => {
        const key = e.target.name;
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                setProfileImage(reader.result);
            };
            reader.readAsDataURL(file);
            setForms((current) => ({
                ...current,
                [key]: file,
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading || !profileImage) return;

        setLoading(true);
        try {
            const response = await api.post("/save-edit-image", forms, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            handleToast(response.data.message || "Profile updated.", response.data.status || "success");
            if (response.data.status === "success") {
                setProfile(response.data.file_name);
                setProfileImage(null);
                setShowProfileChooser(false);
                fetchProfiles();
            }
        } catch (error) {
            handleToast(await profileErrorMessage(error, "Unable to upload the profile image."), "error");
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarSubmit = async () => {
        if (loading || !selectedAvatar) return;
        setLoading(true);
        try {
            const response = await api.post("/save-profile-avatar", { avatar: selectedAvatar });
            handleToast(response.data.message || "Profile updated.", response.data.status || "success");
            if (response.data.status === "success") {
                setProfile(response.data.file_name);
                setSelectedAvatar(null);
                setShowProfileChooser(false);
                fetchProfiles();
            }
        } catch (error) {
            handleToast(await profileErrorMessage(error, "Unable to update the avatar."), "error");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = (e, id) => {
        e.preventDefault();
        setProfileUpdate(id);
    };

    const handleProfileUpdate = async (e, id, action) => {
        e.preventDefault();
        e.stopPropagation();
        if (loading) return;
        setLoading(true);

        try {
            const config = {
                headers: {
                    "Content-Type": "application/json",
                },
                responseType: action === "download" ? "blob" : "json",
            };

            const response = await api.post(
                "/update-profile",
                {
                    profile_id: id ?? profileUpdate,
                    action,
                },
                config
            );

            if (action === "download") {
                // The endpoint can return JSON warnings even with HTTP 200.
                const contentType = response.headers["content-type"] || response.data.type || "";
                if (contentType.includes("json")) {
                    const data = JSON.parse(await response.data.text());
                    handleToast(data.message || data.detail || "Unable to download the profile image.", data.status || "error");
                    return;
                }
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement("a");
                link.href = url;

                const contentDisposition = response.headers["content-disposition"];
                const fileName = contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1] || "profile_image";

                link.setAttribute("download", fileName);
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => window.URL.revokeObjectURL(url), 1000);
                handleToast("Profile image download started.", "success");
            } else {
                handleToast(response.data.message || "Profile updated.", response.data.status || "success");
                if (response.data.status === "success") {
                    if (response.data.file_name) {
                        setProfile(response.data.file_name);
                    }
                    if (action === "delete" && profiles.find((item) => item.id === (id ?? profileUpdate))?.file_name === activeProfile) {
                        setProfile("");
                    }
                    setProfileUpdate(null);
                    setShowModalProfiles(false);
                    fetchProfiles();
                }
            }
        } catch (error) {
            handleToast(
                await profileErrorMessage(error, "Unable to " + action + " the profile image."),
                "error"
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <ContentPanel>
                <form onSubmit={handleSubmit} className="space-y-5 font-poppins">
                    <section
                        className="relative overflow-hidden rounded-xl border border-(--das-border) bg-(--das-surface-solid) shadow-sm"
                    >
                        <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--app-theme-color),var(--app-theme-light),transparent)]" />
                        <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
                            <div className="border-b border-(--das-border) bg-(--das-surface-muted) p-5 lg:border-b-0 lg:border-r">
                                <div className="flex flex-col items-center text-center">
                                    <div className="relative">
                                        {previewSrc ? (
                                            <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-(--das-surface-solid) shadow-md ring-1 ring-(--das-border-strong)">
                                                <img src={previewSrc} alt="User Avatar" className="h-full w-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className={`${backgroundColor} flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-(--das-surface-solid) shadow-md ring-1 ring-(--das-border-strong)`}>
                                                <p className="text-4xl font-semibold text-white">{initials}</p>
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            className="absolute bottom-0 right-0 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-[3px] border-(--das-surface-solid) bg-skin-custom text-theme-contrast shadow-md transition hover:brightness-105"
                                            title="Change profile picture"
                                            onClick={() => setShowProfileChooser(true)}
                                        >
                                            <Camera className="h-4 w-4" />
                                        </button>
                                    </div>

                                    <h1 className="mt-4 text-lg font-semibold text-(--das-text)">
                                        {user.name}
                                    </h1>
                                    <p className="mt-1 max-w-full truncate text-[11px] text-(--das-text-muted)">
                                        {user.email}
                                    </p>
                                    <span
                                        className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                            user.privilege_name === "Admin"
                                                ? "bg-red-50 text-red-700"
                                                : "bg-emerald-50 text-emerald-700"
                                        }`}
                                    >
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        {user.privilege_name}
                                    </span>
                                </div>
                            </div>

                            <div className="p-5 md:p-6">
                                <div className="mb-4">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-(--app-theme-readable)">
                                        Account profile
                                    </p>
                                    <h2 className="mt-1 text-lg font-semibold text-(--das-text)">
                                        Manage your profile image
                                    </h2>
                                    <p className="mt-1.5 max-w-2xl text-[11px] leading-5 text-(--das-text-muted)">
                                        Choose a built-in avatar, upload your own image, or reuse one from profile history. Changes appear in the navbar immediately.
                                    </p>
                                </div>

                                <div className="grid gap-2 md:grid-cols-3">
                                    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-(--das-border) bg-(--das-surface-muted) p-3">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--app-theme-soft) text-(--app-theme-readable)"><UserRound className="h-4 w-4" /></span>
                                        <span className="min-w-0"><span className="block text-[9px] font-semibold uppercase tracking-wide text-(--das-text-soft)">User ID</span><span className="mt-0.5 block text-xs font-semibold text-(--das-text)">#{user.user_id}</span></span>
                                    </div>
                                    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-(--das-border) bg-(--das-surface-muted) p-3">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--app-theme-soft) text-(--app-theme-readable)"><Mail className="h-4 w-4" /></span>
                                        <span className="min-w-0"><span className="block text-[9px] font-semibold uppercase tracking-wide text-(--das-text-soft)">Email</span><span className="mt-0.5 block truncate text-[11px] font-medium text-(--das-text)">#{user.email}</span></span>
                                    </div>
                                    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-(--das-border) bg-(--das-surface-muted) p-3">
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--app-theme-soft) text-(--app-theme-readable)"><Images className="h-4 w-4" /></span>
                                        <span className="min-w-0"><span className="block text-[9px] font-semibold uppercase tracking-wide text-(--das-text-soft)">Saved images</span><span className="mt-0.5 block text-xs font-semibold text-(--das-text)">#{profiles.length}</span></span>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-col gap-2 border-t border-(--das-border) pt-4 sm:flex-row sm:justify-end">
                                    <button
                                        type="button"
                                        className="das-secondary-action inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-4 py-2 text-xs font-semibold transition"
                                        onClick={() => setShowModalProfiles(true)}
                                    >
                                        <Images className="h-4 w-4" />
                                        Profile history
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setShowProfileChooser(true)}
                                        className="das-primary-action inline-flex min-h-9 items-center justify-center gap-2 rounded-md border px-4 py-2 text-xs font-semibold transition"
                                    >
                                        <Camera className="h-4 w-4" />
                                        Change profile picture
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                </form>
            </ContentPanel>

            <Modal
                show={showProfileChooser}
                onClose={closeProfileChooser}
                title="Choose profile picture"
                width="2xl"
                fontColor={theme === "bg-skin-white" ? "text-white" : textColorActive}
                icon="fa fa-user-circle"
            >
                <div className="font-poppins">
                    <div className={`mb-5 grid grid-cols-2 rounded-lg p-1 ${isDark ? "bg-gray-900" : "bg-gray-100"}`}>
                        {[{ id: "avatars", label: "Choose avatar", icon: Images }, { id: "upload", label: "Upload image", icon: Upload }].map((tab) => {
                            const TabIcon = tab.icon;
                            return (
                                <button key={tab.id} type="button" onClick={() => setChooserTab(tab.id)} className={`inline-flex min-h-10.5 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${chooserTab === tab.id ? isDark ? "bg-gray-800 text-white shadow-sm" : "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
                                    <TabIcon className="h-4 w-4" /> {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {chooserTab === "avatars" ? (
                        <>
                            <div className="grid max-h-105 grid-cols-4 place-items-center gap-3 overflow-y-auto p-2 sm:grid-cols-6 md:grid-cols-8">
                                {avatarOptions.map((avatar, index) => (
                                    <button key={avatar.id} type="button" onClick={() => setSelectedAvatar(avatar.id)} className={`relative h-16 w-16 overflow-hidden rounded-full border-2 p-0 transition hover:-translate-y-0.5 hover:shadow-md sm:h-18 sm:w-18 ${selectedAvatar === avatar.id ? "border-blue-500 ring-2 ring-blue-200 ring-offset-2" : isDark ? "border-gray-700" : "border-gray-200"}`} aria-label={`Choose avatar ${index + 1}`}>
                                        <img src={avatar.src} alt="" loading="lazy" decoding="async" className="h-full w-full rounded-full object-cover" />
                                        {selectedAvatar === avatar.id && <CheckCircle2 className="absolute right-0 top-0 h-5 w-5 rounded-full bg-white text-blue-600" />}
                                    </button>
                                ))}
                            </div>
                            <div className={`mt-5 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end ${isDark ? "border-gray-800" : "border-gray-200"}`}>
                                <button type="button" onClick={closeProfileChooser} className={`min-h-10 rounded-md border px-4 py-2 text-sm font-semibold ${isDark ? "border-gray-700 bg-gray-900 text-gray-200" : "border-gray-200 bg-white text-gray-700"}`}>Cancel</button>
                                <button type="button" disabled={!selectedAvatar || loading} onClick={handleAvatarSubmit} className={`${buttonTheme} ${theme === "bg-skin-white" ? "text-white" : textColorActive} inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50`}>
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {loading ? "Applying..." : "Use selected avatar"}
                                </button>
                            </div>
                        </>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <label htmlFor="profile-image-upload" className={`flex min-h-65 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition ${isDark ? "border-gray-700 bg-gray-900/50 hover:border-gray-500" : "border-gray-300 bg-slate-50 hover:border-blue-400"}`}>
                                {profileImage ? <img src={profileImage} alt="New profile preview" className="h-40 w-40 rounded-full border-4 border-white object-cover shadow-md" /> : <><span className="grid h-14 w-14 place-items-center rounded-full bg-blue-50 text-blue-600"><Upload className="h-6 w-6" /></span><span className={`mt-4 text-sm font-semibold ${isDark ? "text-gray-200" : "text-gray-800"}`}>Choose an image from your device</span><span className="mt-1 text-xs text-gray-500">JPG, PNG, WebP or AVIF · maximum 5 MB</span></>}
                                <input id="profile-image-upload" type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" name="profile_image" onChange={handleImageChange} />
                            </label>
                            <div className={`mt-5 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end ${isDark ? "border-gray-800" : "border-gray-200"}`}>
                                <button type="button" onClick={closeProfileChooser} className={`min-h-10 rounded-md border px-4 py-2 text-sm font-semibold ${isDark ? "border-gray-700 bg-gray-900 text-gray-200" : "border-gray-200 bg-white text-gray-700"}`}>Cancel</button>
                                <button type="submit" disabled={!profileImage || loading} className={`${buttonTheme} ${theme === "bg-skin-white" ? "text-white" : textColorActive} inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50`}>
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {loading ? "Uploading..." : "Upload and use"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </Modal>

            <Modal
                theme={buttonTheme}
                show={showModalProfiles}
                onClose={() => setShowModalProfiles(false)}
                title="Profiles"
                width="xl"
                fontColor={theme === "bg-skin-white" ? "text-white" : textColor}
                onClick={handleProfileUpdate}
                icon="fa fa-images"
                btnIcon="fa fa-refresh"
                isDelete="delete"
            >
                <div className="font-poppins">
                    <div className={`mb-4 rounded-md border p-4 ${isDark ? "border-gray-800 bg-gray-900/40 text-gray-300" : "border-gray-200 bg-slate-50 text-gray-700"}`}>
                        <p className="text-sm font-semibold">Profile gallery</p>
                        <p className="mt-1 text-xs">Select an image, download it, delete it, or set it as your active profile.</p>
                    </div>

                    <div className={`grid max-h-150 gap-4 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 scrollbar-thumb-rounded-full scrollbar-track-rounded-full scrollbar scrollbar-thin ${scrollbarTheme} scrollbar-track-gray-200`}>
                        {profiles.length > 0 ? (
                            profiles.map((item) => {
                                const isSelected = item.id === profileUpdate || item.file_name === activeProfile;

                                return (
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        className={`group overflow-hidden rounded-md border text-left transition ${
                                            isSelected
                                                ? `border-[3px] ${borderTheme} shadow-md`
                                                : isDark
                                                    ? "border-gray-800 hover:border-gray-600"
                                                    : "border-gray-200 hover:border-sky-200"
                                        }`}
                                        key={item.id}
                                        onClick={(e) => handleUpdateProfile(e, item.id, item.file_name)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                handleUpdateProfile(e, item.id, item.file_name);
                                            }
                                        }}
                                    >
                                        <div className="relative aspect-square bg-gray-100">
                                            <img
                                                src={`/images/profile/${item.file_name}`}
                                                alt="User Avatar"
                                                className="h-full w-full object-cover"
                                            />
                                            {isSelected && (
                                                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                    Selected
                                                </span>
                                            )}
                                        </div>
                                        <div className={`${isDark ? "bg-black-table-color" : "bg-white"} p-3`}>
                                            <p className={`truncate text-xs font-mono ${isDark ? "text-gray-400" : "text-gray-500"}`}>{item.file_name}</p>
                                            <div className="mt-3 grid grid-cols-3 gap-2">
                                                <button
                                                    type="button"
                                                    className="inline-flex min-h-8.5 items-center justify-center rounded-md bg-sky-50 text-sky-700 transition hover:bg-sky-100"
                                                    onClick={(e) => handleProfileUpdate(e, item.id, "download")}
                                                    title="Download"
                                                >
                                                    <Download className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="inline-flex min-h-8.5 items-center justify-center rounded-md bg-red-50 text-red-700 transition hover:bg-red-100"
                                                    onClick={(e) => handleProfileUpdate(e, item.id, "delete")}
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="inline-flex min-h-8.5 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                                                    onClick={(e) => handleProfileUpdate(e, item.id, "update")}
                                                    title="Use profile"
                                                >
                                                    <RefreshCw className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className={`col-span-full rounded-md border p-8 text-center text-sm ${isDark ? "border-gray-800 text-gray-400" : "border-gray-200 text-gray-500"}`}>
                                No profiles available to display.
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default Profile;
