import React, { useEffect, useState } from "react";
import { Link, router, useForm } from "@inertiajs/react";
import { ArrowLeft, Loader2, Mail, Send, ShieldCheck } from "lucide-react";
import getAppName from "../../Components/SystemSettings/ApplicationName";
import getAppLogo from "../../Components/SystemSettings/ApplicationLogo";
import LoginDetails from "../../Components/SystemSettings/LoginDetails";

const ResetPassword = () => {
    const [appname, setAppname] = useState("");
    const [loginBgColor, setLoginBgColor] = useState("");
    const [lfc, setLfc] = useState("");
    const [lbi, setLbi] = useState("");
    const [applogo, setApplogo] = useState("");

    useEffect(() => {
        getAppName().then((appName) => setAppname(appName));
        getAppLogo().then((appLogo) => setApplogo(appLogo));
        LoginDetails().then((detail) => {
            setLoginBgColor(detail.login_bg_color);
            setLfc(detail.login_font_color);
            setLbi(detail.login_bg_image);
        });
    }, []);

    const { data, setData, post, processing, errors, reset } = useForm({
        email: "",
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        post("/send_resetpass_email", {
            onSuccess: () => {
                reset();
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
                    icon: "success",
                    title: "Email sent, please check your inbox",
                }).then(() => {
                    router.visit("/login");
                });
            },
        });
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
                                Secure password recovery
                            </p>
                            <h1 className="text-5xl font-bold leading-tight">Recover access with a verified email link.</h1>
                            <p className="mt-5 max-w-lg text-base leading-7 text-white/72">
                                Enter the email tied to your account and VRAM will send reset instructions to that inbox.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm text-white/75">
                            <div className="rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur">
                                <p className="text-2xl font-bold text-white">Email</p>
                                <p>Verified reset flow</p>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur">
                                <p className="text-2xl font-bold text-white">Secure</p>
                                <p>One request at a time</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="flex min-h-screen items-center justify-center bg-gray-50 px-5 py-8 sm:px-8">
                    <div className="w-full max-w-md">
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
                                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-skin-blue">Forgot password</p>
                                <h2 className="mt-2 text-3xl font-bold text-gray-950">Send reset instructions</h2>
                                <p className="mt-2 text-sm leading-6 text-gray-500">
                                    We will send a password reset link to the email registered on your account.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-gray-700">Email address</label>
                                    <div className="flex items-center rounded-lg border border-gray-300 bg-white px-3 transition focus-within:border-skin-blue focus-within:ring-4 focus-within:ring-skin-blue/10">
                                        <Mail className="h-4 w-4 text-gray-400" />
                                        <input
                                            className=" flex-1 border-0 bg-transparent px-3 text-sm outline-none"
                                            name="email"
                                            type="email"
                                            value={data.email}
                                            onChange={(e) => setData("email", e.target.value)}
                                            placeholder="name@example.com"
                                            autoComplete="email"
                                        />
                                    </div>
                                    {errors.email && <span className="mt-2 block text-sm font-medium text-red-600">{errors.email}</span>}
                                </div>

                                <button
                                    type="submit"
                                    className={`${lfc || "bg-skin-blue"} inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:opacity-90 focus:outline-none focus:ring-4 focus:ring-skin-blue/20 disabled:cursor-not-allowed disabled:opacity-70`}
                                    disabled={processing}
                                >
                                    {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                    {processing ? "Sending instructions..." : "Send reset link"}
                                </button>
                            </form>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
};

export default ResetPassword;
