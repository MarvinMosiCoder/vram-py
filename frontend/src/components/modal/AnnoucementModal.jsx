import { BellRing, CheckCircle2, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";

const AnnouncementsModal = ({
    show,
    onClose,
    children,
    title,
    modalLoading,
    width = "lg",
    theme,
    fontColor,
    loading,
    isDisabled,
    onClick,
    withButton,
    currentIndex = 0,
    total = 1,
    isRead,
    onPrev,
    onNext,
    createdAt,
}) => {
    if (!show) {
        return null;
    }

    const maxWidth = {
        md: "sm:max-w-md",
        lg: "sm:max-w-lg",
        xl: "sm:max-w-xl",
        "2xl": "sm:max-w-2xl",
    }[width] || "sm:max-w-lg";
    const safeTotal = Math.max(Number(total) || 1, 1);
    const safeIndex = Math.min(Math.max(Number(currentIndex) || 0, 0), safeTotal - 1);
    const progress = ((safeIndex + 1) / safeTotal) * 100;

    return (
        <>
            {modalLoading ? (
                <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="rounded-md bg-transparent p-5">
                        <main className="flex items-center justify-center">
                            <Loader2 className="h-14 w-14 animate-spin text-white" />
                        </main>
                    </div>
                </div>
            ) : (
                <div className="fixed inset-0 z-100 overflow-y-auto bg-black/50 px-3 py-5 backdrop-blur-sm sm:px-5">
                    <div
                        className={`mx-auto flex min-h-full w-full items-center justify-center ${maxWidth}`}
                    >
                        <section
                            className="w-full max-h-[90vh] overflow-hidden rounded-md border border-gray-200 bg-white font-poppins text-gray-900 shadow-2xl"
                            role="dialog"
                            aria-modal="true"
                            aria-label={title || "Announcement"}
                        >
                            <div className={`${theme} relative overflow-hidden px-5 py-5`}>
                                <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                                    <div
                                        className="h-full bg-white transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>

                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex min-w-0 gap-3">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white/15 text-white ring-1 ring-white/20">
                                            <BellRing className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/75">
                                                <span>{safeTotal > 1 ? `Update ${safeIndex + 1} of ${safeTotal}` : "Update"}</span>
                                                {isRead === false && (
                                                    <span className="inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
                                                        NEW
                                                    </span>
                                                )}
                                            </p>
                                            <h2 className={`${fontColor} mt-1 wrap-break text-xl font-semibold leading-7`}>
                                                {title || "Announcement"}
                                            </h2>
                                            {createdAt && (
                                                <p className="mt-0.5 text-xs text-white/70">{createdAt}</p>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={(e) => (onClose ? onClose(e, "close") : onClick?.(e, "dismiss"))}
                                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white/90 transition hover:bg-white/15 hover:text-white"
                                        aria-label="Close announcement"
                                        title="Close"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            <main className="max-h-[56vh] overflow-y-auto px-5 py-5 text-sm leading-6 text-gray-700">
                                <div className="announcement-content">
                                    {children}
                                </div>
                            </main>

                            {withButton && (
                                <div className="flex flex-col-reverse gap-2 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs font-medium text-gray-500">
                                        Unread announcement
                                    </p>
                                    <button
                                        type="button"
                                        disabled={isDisabled || loading}
                                        onClick={(e) => onClick?.(e, "submit")}
                                        className={`${theme} inline-flex min-h-10.5 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60`}
                                        >
                                        {loading ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <CheckCircle2 className="h-4 w-4" />
                                        )}
                                        {loading ? "Please wait..." : safeIndex + 1 < safeTotal ? "Got it, next" : "Got it"}
                                    </button>
                                </div>
                            )}

                            {!withButton && (onPrev || onNext) && safeTotal > 1 && (
                                <div className="flex items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
                                    <button
                                        type="button"
                                        onClick={onPrev}
                                        disabled={safeIndex === 0}
                                        className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Previous
                                    </button>
                                    <div className="flex items-center gap-1.5">
                                        {Array.from({ length: safeTotal }).map((_, dotIndex) => (
                                            <span
                                                key={dotIndex}
                                                className={`h-1.5 rounded-full transition-all ${
                                                    dotIndex === safeIndex ? `${theme} w-4` : "w-1.5 bg-gray-300"
                                                }`}
                                            />
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onNext}
                                        disabled={safeIndex + 1 >= safeTotal}
                                        className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            )}
        </>
    );
};

export default AnnouncementsModal;
