import React, { useEffect, useMemo, useState } from "react";
import { Link, router } from "@inertiajs/react";
import axios from "axios";
import { ArrowLeft, Check, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, ShieldCheck, X } from "lucide-react";
import getAppName from "../../Components/SystemSettings/ApplicationName";
import getAppLogo from "../../Components/SystemSettings/ApplicationLogo";
import LoginDetails from "../../Components/SystemSettings/LoginDetails";

const Requirement = ({ active, children }) => (
    <div className={`flex items-center gap-2 text-sm ${active ? "text-emerald-600" : "text-gray-500"}`}>
        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${active ? "bg-emerald-50" : "bg-gray-100"}`}>
            {active ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        </span>
        <span>{children}</span>
    </div>
);

const ResetPasswordEmail = ({ email }) => {
    const [loading, setLoading] = useState(false);
    const [passwordMismatch, setPasswordMismatch] = useState(false);
    const [forms, setForms] = useState({
        email: email || "",
        new_password: "",
        confirm_password: "",
    });
    const [appname, setAppname] = useState("");
    const [loginBgColor, setLoginBgColor] = useState("");
    const [lfc, setLfc] = useState("");
    const [lbi, setLbi] = useState("");
    const [applogo, setApplogo] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    useEffect(() => {
        getAppName().then((appName) => setAppname(appName));
        getAppLogo().then((appLogo) => setApplogo(appLogo));
        LoginDetails().then((detail) => {
            setLoginBgColor(detail.login_bg_color);
            setLfc(detail.login_font_color);
            setLbi(detail.login_bg_image);
        });
    }, []);

    const passwordState = useMemo(() => {
        const password = forms.new_password;
        const checks = {
            Uppercase: /[A-Z]/.test(password),
            Length: password.length >= 8,
            Number: /\d/.test(password),
            Character: /[!@#$%^&*(),.?":{}|<>;]/.test(password),
        };
        const passedCount = Object.values(checks).filter(Boolean).length;
        const label = passedCount <= 1 ? "Weak" : passedCount <= 3 ? "Strong" : "Excellent";
        const color = label === "Excellent" ? "bg-emerald-500" : label === "Strong" ? "bg-amber-500" : "bg-red-500";
        const textColor = label === "Excellent" ? "text-emerald-600" : label === "Strong" ? "text-amber-600" : "text-red-600";

        return {
            checks,
            passedCount,
            label,
            color,
            textColor,
            isExcellent: passedCount === 4,
        };
    }, [forms.new_password]);

    const isDisabled =
        loading ||
        !forms.email ||
        !forms.new_password ||
        !forms.confirm_password ||
        !passwordState.isExcellent ||
        forms.new_password !== forms.confirm_password;

    useEffect(() => {
        setPasswordMismatch(Boolean(forms.confirm_password) && forms.new_password !== forms.confirm_password);
    }, [forms.new_password, forms.confirm_password]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForms((prevForms) => ({
            ...prevForms,
            [name]: value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await axios.post("/send_resetpass_email/reset", forms);
            const Toast = Swal.mixin({
                toast: true,
                position: "top-end",
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
                didOpen: (toast) => {
                    toast.onmouseenter = Swal.stopTimer;
                    toast.onmouseleave = Swal.resumeTimer;
                },
            });

            if (response.data.status == "success") {
                Toast.fire({
                    icon: "success",
                    title: "Password reset successful",
                }).then(() => {
                    router.visit("/login");
                });
            } else {
                Toast.fire({
                    icon: "error",
                    title: response.data.message || "Request expired, please request another one",
                });
            }
        } catch (error) {
            const Toast = Swal.mixin({
                toast: true,
                position: "top-end",
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
                didOpen: (toast) => {
                    toast.onmouseenter = Swal.stopTimer;
                    toast.onmouseleave = Swal.resumeTimer;
                },
            });
            Toast.fire({
                icon: "error",
                title: "An error occurred. Please try again.",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-gray-950 font-poppins text-gray-900">
            <div className="grid min-h-screen lg:grid-cols-[minmax(420px,46%)_1fr]">
                <section className={`relative hidden overflow-hidden ${loginBgColor || "bg-skin-blue"} p-10 text-white lg:flex`}>
                    {lbi && <img src={lbi} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,23,42,.94),rgba(19,75,112,.72))]" />
                    <div className="relative z-10 flex min-h-full w-full flex-col justify-between">
                        <Link href="/login" className="flex items-center gap-3">
                            {applogo ? (
                                <img src={applogo} alt="App Logo" className="h-11 w-11 rounded-xl bg-white/10 object-contain p-1.5 ring-1 ring-white/20" />
                            ) : (
                                <div className="h-11 w-11 animate-pulse rounded-xl bg-white/15" />
                            )}
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/60">Admin Console</p>
                                <p className="text-xl font-bold">{appname || "VRAM"}</p>
                            </div>
                        </Link>

                        <div className="max-w-xl">
                            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 backdrop-blur">
                                <ShieldCheck className="h-4 w-4" />
                                Create a stronger password
                            </p>
                            <h1 className="text-5xl font-bold leading-tight">Set a new password and keep your account protected.</h1>
                            <p className="mt-5 max-w-lg text-base leading-7 text-white/72">
                                Use a unique password with uppercase letters, numbers, and special characters.
                            </p>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-sm text-white/75">
                            <div className="rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur">
                                <p className="text-2xl font-bold text-white">8+</p>
                                <p>Characters</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur">
                                <p className="text-2xl font-bold text-white">A-Z</p>
                                <p>Uppercase</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur">
                                <p className="text-2xl font-bold text-white">#</p>
                                <p>Special symbol</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="flex min-h-screen items-center justify-center bg-gray-50 px-5 py-8 sm:px-8">
                    <div className="w-full max-w-lg">
                        <div className="mb-8 flex items-center gap-3 lg:hidden">
                            {applogo ? (
                                <img src={applogo} alt="App Logo" className="h-11 w-11 rounded-xl object-contain" />
                            ) : (
                                <div className="h-11 w-11 animate-pulse rounded-xl bg-gray-200" />
                            )}
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Admin Console</p>
                                <p className="text-xl font-bold text-gray-950">{appname || "VRAM"}</p>
                            </div>
                        </div>

                        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-custom sm:p-8">
                            <Link href="/login" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-gray-500 transition hover:text-skin-blue">
                                <ArrowLeft className="h-4 w-4" />
                                Back to login
                            </Link>

                            <div className="mb-7">
                                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-skin-blue">Reset password</p>
                                <h2 className="mt-2 text-3xl font-bold text-gray-950">Choose your new password</h2>
                                <p className="mt-2 text-sm leading-6 text-gray-500">
                                    Your new password must pass every requirement before it can be saved.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <input type="hidden" name="email" value={forms.email} />

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-gray-700">New password</label>
                                    <div className="flex items-center rounded-lg border border-gray-300 bg-white px-3 transition focus-within:border-skin-blue focus-within:ring-4 focus-within:ring-skin-blue/10">
                                        <LockKeyhole className="h-4 w-4 text-gray-400" />
                                        <input
                                            className="min-h-[46px] flex-1 border-0 bg-transparent px-3 text-sm outline-none"
                                            type={showNewPassword ? "text" : "password"}
                                            name="new_password"
                                            value={forms.new_password}
                                            onChange={handleChange}
                                            placeholder="Enter new password"
                                            autoComplete="new-password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword((value) => !value)}
                                            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                                            aria-label={showNewPassword ? "Hide password" : "Show password"}
                                        >
                                            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>

                                    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                                        <div className="mb-3 flex items-center justify-between">
                                            <span className="text-sm font-semibold text-gray-700">Password strength</span>
                                            <span className={`text-sm font-bold ${passwordState.textColor}`}>{passwordState.label}</span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-1">
                                            {[0, 1, 2, 3].map((index) => (
                                                <div
                                                    key={index}
                                                    className={`h-1.5 rounded-full ${index < passwordState.passedCount ? passwordState.color : "bg-gray-200"}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-2 rounded-lg border border-gray-200 p-3">
                                    <Requirement active={passwordState.checks.Uppercase}>Contains an uppercase letter</Requirement>
                                    <Requirement active={passwordState.checks.Length}>At least 8 characters long</Requirement>
                                    <Requirement active={passwordState.checks.Number}>Contains a number</Requirement>
                                    <Requirement active={passwordState.checks.Character}>Contains a special character</Requirement>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-gray-700">Confirm password</label>
                                    <div className="flex items-center rounded-lg border border-gray-300 bg-white px-3 transition focus-within:border-skin-blue focus-within:ring-4 focus-within:ring-skin-blue/10">
                                        <KeyRound className="h-4 w-4 text-gray-400" />
                                        <input
                                            className="min-h-[46px] flex-1 border-0 bg-transparent px-3 text-sm outline-none"
                                            type={showConfirmPassword ? "text" : "password"}
                                            name="confirm_password"
                                            value={forms.confirm_password}
                                            onChange={handleChange}
                                            placeholder="Confirm new password"
                                            autoComplete="new-password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword((value) => !value)}
                                            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                        >
                                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    {passwordMismatch && (
                                        <span className="mt-2 block text-sm font-medium text-red-600">
                                            Passwords do not match.
                                        </span>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={isDisabled}
                                    className={`${lfc || "bg-skin-blue"} inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:opacity-90 focus:outline-none focus:ring-4 focus:ring-skin-blue/20 disabled:cursor-not-allowed disabled:opacity-60`}
                                >
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                                    {loading ? "Changing password..." : "Change password"}
                                </button>
                            </form>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
};

export default ResetPasswordEmail;
