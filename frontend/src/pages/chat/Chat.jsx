import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Bot, MessageSquarePlus, PanelLeft, ArrowUp, Plus, ChevronDown, Sparkles, Trash2, User, X, Ellipsis, PenIcon, Archive, Pin } from "lucide-react";
import api from "../../api";
import MarkdownMessage from "./MarkdownMessage";
import { formatToastMessage, useToast } from "../../context/ToastContext";
import Modal from "../../components/modal/Modal";
import SecondaryButton from "../../components/button/SecondaryButton";
import DangerButton from "../../components/button/DangerButton";
import PrimaryButton from "../../components/button/PrimaryButton";


// `label` is a function so Pin can read as Unpin once a conversation is pinned.
const CONVERSATION_MENU_ITEMS = [
    { action: "rename", label: () => "Rename", icon: PenIcon },
    { action: "pin", label: (conversation) => (conversation.pinned ? "Unpin" : "Pin"), icon: Pin },
    { action: "archive", label: () => "Archive", icon: Archive },
];

const CONFIRM_ACTIONS = {
    archive: {
        title: "Archive conversation",
        icon: "fa fa-box-archive",
        body: "This removes the conversation from your list. Its messages are kept.",
        label: "Archive",
        danger: false,
    },
    delete: {
        title: "Delete conversation",
        icon: "fa fa-trash",
        body: "This permanently deletes the conversation and its stored messages. This cannot be undone.",
        label: "Delete",
        danger: true,
    },
};


const SUGGESTIONS = [
    ["Summarize a task", "Summarize the most important tasks I should focus on today."],
    ["Explore an idea", "Help me think through a new idea and turn it into a practical plan."],
    ["Write something", "Help me write a clear and professional message."],
];

async function requestErrorMessage(error, fallback) {
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

const Chat = () => {
    const MAX_MESSAGE_LENGTH = 2000;
    const MAX_TITLE_LENGTH = 80;
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [railOpen, setRailOpen] = useState(false);
    const composerRef = useRef(null);
    const messagesEndRef = useRef(null);
    const panelRef = useRef(null);
    const [conversationId, setConversationId] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [panelHeight, setPanelHeight] = useState(null);
    const [model, setModel] = useState("gemini-3.6-flash");
    const [responseLength, setResponseLength] = useState("medium");
    const { handleToast } = useToast();
    const [openMenuId, setOpenMenuId] = useState(null);
    const [pendingAction, setPendingAction] = useState(null);
    const [renaming, setRenaming] = useState(null);

    useEffect(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    useEffect(() => {
        if (openMenuId === null) return undefined;

        const closeOnOutside = (event) => {
            if (!event.target.closest("[data-conversation-menu]")) setOpenMenuId(null);
        };
        const closeOnEscape = (event) => {
            if (event.key === "Escape") setOpenMenuId(null);
        };

        document.addEventListener("mousedown", closeOnOutside);
        document.addEventListener("keydown", closeOnEscape);

        return () => {
            document.removeEventListener("mousedown", closeOnOutside);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [openMenuId]);

    useLayoutEffect(() => {
        const panel = panelRef.current;
        const container = panel?.closest("#app-content");

        if (!panel || !container) return undefined;

        const measure = () => {
            const styles = getComputedStyle(container);
            const offsetWithin =
                panel.getBoundingClientRect().top -
                container.getBoundingClientRect().top +
                container.scrollTop;
            const gapBelow =
                (parseFloat(styles.paddingBottom) || 0) +
                (parseFloat(getComputedStyle(panel.parentElement).paddingBottom) || 0);

            setPanelHeight(Math.max(container.clientHeight - offsetWithin - gapBelow, 360));
        };

        measure();

        const observer = new ResizeObserver(measure);

        observer.observe(container);
        observer.observe(panel.parentElement);

        return () => observer.disconnect();
    }, []);

    const fetchConversations = () => {
        api.get("/chat/conversations")
        .then((response) => setConversations(response.data))
        .catch(async (error) => {
            handleToast(await requestErrorMessage(error, "Unable to load conversations."), "error");
        });
    };

    useEffect(() => {
        fetchConversations();
    }, []);

    const openConversation = async (id) => {
        try {
            const res = await api.get(`/chat/conversations/${id}`);
            setMessages(res.data.messages);
            setConversationId(res.data.conversation_id);
            setError("");
            setRailOpen(false);
        } catch (requestError) {
            handleToast(
                await requestErrorMessage(requestError, "Unable to open that conversation."),
                "error",
            );
        }
    };

    const formatUpdatedAt = (value) => {
        if (!value) return "";

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? ""
            : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    };

    const showTypingReply = async (reply, previousMessages, truncated = false, usage = null) => {
        const characters = Array.from(reply);
        const TICKS = 60;
        const chunk = Math.max(1, Math.ceil(characters.length / TICKS));
        let visibleText = "";

        for (let index = 0; index < characters.length; index += chunk) {
            visibleText += characters.slice(index, index + chunk).join("");

            setMessages([
                ...previousMessages,
                {
                    role: "assistant",
                    content: visibleText,
                    truncated: truncated && index + chunk >= characters.length,
                    usage: index + chunk >= characters.length ? usage : null,

                },
            ]);

            await new Promise((resolve) => setTimeout(resolve, 20));
        }
    };

    const sendMessage = async (event) => {
        event?.preventDefault();
        const message = input.trim();
        if (!message || loading) return;

        if (message.length > MAX_MESSAGE_LENGTH) {
            setError(`Use ${MAX_MESSAGE_LENGTH} characters or fewer.`);
            return;
        }
        const nextMessages = [...messages, { role: "user", content: message }];
        setMessages(nextMessages);
        setInput('');
        setError('');
        setLoading(true);

        try {
            const res = await api.post("/chat", { 
                message, conversation_id: 
                conversationId, model, 
                response_length: responseLength 
            });
            setConversationId(res.data.conversation_id);
            await showTypingReply(res.data.reply, nextMessages, res.data.truncated, res.data.usage);
            fetchConversations();
        } catch (requestError) {
            console.error(requestError);

            const detail = requestError.response?.data?.detail;
            const errorMessage = Array.isArray(detail)
                ? detail.map((item) => item.msg).join(" ")
                : typeof detail === "string"
                    ? detail
                    : "The assistant could not respond. Please try again.";

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const startNewChat = () => {
        setMessages([]);
        setInput("");
        setError("");
        setRailOpen(false);
        setConversationId(null);
        composerRef.current?.focus();
    };

    // One request shape serves every rail action; `title` is only read by rename.
    const runConversationAction = async (id, action, title = null) => {
        if (loading) return;
        setLoading(true);

        try {
            const response = await api.post("/conversation-settings", {
                conversation_id: id,
                action,
                ...(title === null ? {} : { title }),
            });

            if (response.data) {
                handleToast(
                    response.data.message || "Conversation updated.",
                    response.data.status || "success"
                );
            }
        } catch (error) {
            handleToast(
                await requestErrorMessage(error, "Unable to " + action + " the conversation."),
                "error"
            );
        } finally {
            setOpenMenuId(null);
            fetchConversations();
            setLoading(false);
        }
    };

    // Actions routed through the confirm dialog: archive and delete.
    const runPendingAction = async () => {
        if (!pendingAction) return;

        const { id, action } = pendingAction;

        setPendingAction(null);
        await runConversationAction(id, action);

        if (action === "delete" && id === conversationId) startNewChat();
    };

    const openRename = (conversation) => {
        setOpenMenuId(null);
        setRenaming({ id: conversation.id, title: conversation.title || "" });
    };

    const submitRename = async (event) => {
        event?.preventDefault();

        if (!renaming) return;

        const title = renaming.title.trim();

        if (!title) return;

        const { id } = renaming;

        setRenaming(null);
        await runConversationAction(id, "rename", title);
    };


    return (
        <section
            ref={panelRef}
            style={panelHeight ? { height: `${panelHeight}px` } : undefined}
            className="flex min-h-0 flex-1 bg-skin-bg p-3 font-body sm:p-5"
        >
            <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-skin-border bg-skin-panel shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
                {railOpen && <button type="button" aria-label="Close conversations" className="absolute inset-0 z-10 bg-slate-950/20 lg:hidden" onClick={() => setRailOpen(false)} />}
                <aside className={`absolute inset-y-0 left-0 z-20 flex w-[min(82vw,280px)] flex-col border-r border-skin-border bg-skin-panel transition-transform duration-200 lg:static lg:translate-x-0 ${railOpen ? "translate-x-0" : "-translate-x-full"}`}>
                    <div className="flex items-center justify-between border-b border-skin-border px-4 py-4">
                        <div><p className="m-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-skin-accent">Workspace</p><h1 className="m-0 mt-1 text-base font-semibold text-skin-text">Conversations</h1></div>
                        <button type="button" aria-label="Close conversations" className="rounded-lg p-2 text-skin-dim hover:bg-skin-accent-soft lg:hidden" onClick={() => setRailOpen(false)}><X size={16} /></button>
                    </div>
                    <div className="p-3"><button type="button" className="flex w-full items-center justify-center gap-2 rounded-xl border border-skin-border px-3 py-2.5 text-xs font-semibold text-skin-text hover:border-skin-accent hover:bg-skin-accent-soft" onClick={startNewChat}><MessageSquarePlus size={15} />New conversation</button></div>
                    <div className="min-h-0 flex-1 overflow-y-auto px-2">
                        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-skin-dim">Recent</p>
                        {conversations.length === 0 ? (
                            <p className="px-3 py-2 text-[11px] text-skin-dim">No conversations yet.</p>
                        ) : (
                            <ul className="m-0 flex list-none flex-col gap-1 p-0">
                                {conversations.map((conversation) => (
                                    <li
                                        key={conversation.id}
                                        className={`group relative flex items-stretch rounded-xl ${conversation.id === conversationId ? "bg-skin-accent-soft" : "hover:bg-skin-accent-soft"}`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => openConversation(conversation.id)}
                                            aria-current={conversation.id === conversationId ? "true" : undefined}
                                            className="flex min-w-0 flex-1 items-start gap-3 rounded-xl bg-transparent px-3 py-3 text-left"
                                        >
                                            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-skin-accent text-white">
                                                <Sparkles size={14} />
                                            </span>
                                            <span className="min-w-0">
                                                <span className="flex min-w-0 items-center gap-1.5">
                                                    {conversation.pinned && <Pin size={11} className="shrink-0 text-skin-accent" aria-label="Pinned" />}
                                                    <span className="truncate text-xs font-semibold text-skin-text">{conversation.title || "New conversation"}</span>
                                                </span>
                                                <span className="mt-1 block truncate text-[11px] text-skin-dim">{formatUpdatedAt(conversation.updated_at)}</span>
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            data-conversation-menu
                                            aria-label="Conversation options"
                                            aria-haspopup="menu"
                                            aria-expanded={openMenuId === conversation.id}
                                            onClick={() => setOpenMenuId(openMenuId === conversation.id ? null : conversation.id)}
                                            className={`mr-1 mt-2.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-transparent text-skin-dim transition-all duration-200 hover:text-skin-text focus-visible:opacity-100 ${
                                                openMenuId === conversation.id
                                                    ? "opacity-100"
                                                    : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                                            }`}
                                        >
                                            <Ellipsis size={16} className="mt-3" />
                                        </button>

                                        {openMenuId === conversation.id && (
                                            <div
                                                role="menu"
                                                data-conversation-menu
                                                className="absolute right-1 top-full z-50 flex w-40 flex-col rounded-[10px] border border-skin-border bg-skin-panel py-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
                                            >
                                                {CONVERSATION_MENU_ITEMS.map(({ action, label, icon: Icon }) => (
                                                    <button
                                                        key={action}
                                                        type="button"
                                                        role="menuitem"
                                                        onClick={() => {
                                                            if (action === "rename") return openRename(conversation);

                                                            if (action in CONFIRM_ACTIONS) {
                                                                setOpenMenuId(null);
                                                                return setPendingAction({ id: conversation.id, action });
                                                            }

                                                            return runConversationAction(conversation.id, action);
                                                        }}
                                                        className="flex items-center gap-2.5 bg-transparent px-3 py-2 text-left text-xs font-medium text-skin-text hover:bg-skin-accent-soft"
                                                    >
                                                        <Icon size={14} />
                                                        {label(conversation)}
                                                    </button>
                                                ))}
                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    onClick={() => {
                                                        setOpenMenuId(null);
                                                        setPendingAction({ id: conversation.id, action: "delete" });
                                                    }}
                                                    className="mt-1 flex items-center gap-2.5 border-t border-skin-border bg-transparent px-3 py-2 pt-2.5 text-left text-xs font-medium text-skin-danger hover:bg-skin-danger-soft"
                                                >
                                                    <Trash2 size={14} />
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="border-t border-skin-border p-3">
                        <div className="flex items-center gap-2 rounded-xl bg-skin-bg px-3 py-2.5"><Bot size={16} className="text-skin-accent" /><span className="min-w-0 flex-1 text-xs font-medium text-skin-text">AI assistant</span><span className="size-1.5 rounded-full bg-emerald-500" title="Online" /></div></div>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                    <header className="flex items-center justify-between border-b border-skin-border px-4 py-3 sm:px-6">
                        <div className="flex min-w-0 items-center gap-3"><button type="button" aria-label="Open conversations" className="rounded-lg p-2 text-skin-dim hover:bg-skin-accent-soft lg:hidden" onClick={() => setRailOpen(true)}><PanelLeft size={17} /></button><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-skin-accent-soft text-skin-accent"><Bot size={18} /></span><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="m-0 truncate text-sm font-semibold text-skin-text">AI assistant</h2><span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-600">Online</span></div><p className="m-0 mt-0.5 truncate text-[11px] text-skin-dim">A thoughtful place to work through ideas</p></div></div>
                        <button type="button" aria-label="Clear conversation" title="Clear conversation" className="rounded-lg p-2 text-skin-dim hover:bg-skin-accent-soft hover:text-skin-text" onClick={startNewChat}><Trash2 size={16} /></button>
                    </header>
                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
                        {messages.length === 0 ? <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center"><div className="mb-8"><span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-skin-accent text-white shadow-lg shadow-skin-accent/20"><Sparkles size={22} /></span><p className="m-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-skin-accent">Your thinking partner</p><h3 className="m-0 mt-2 max-w-lg text-3xl font-semibold leading-tight tracking-tight text-skin-text sm:text-4xl">What would you like to work through?</h3><p className="m-0 mt-3 max-w-xl text-sm leading-6 text-skin-dim">Ask a question, shape an idea, or get a fresh perspective on the work in front of you.</p></div><div className="grid gap-2 sm:grid-cols-3">{SUGGESTIONS.map(([title, prompt]) => <button key={title} type="button" className="group rounded-xl border border-skin-border bg-skin-bg p-4 text-left hover:-translate-y-0.5 hover:border-skin-accent hover:shadow-sm" onClick={() => { setInput(prompt); composerRef.current?.focus(); }}><span className="block text-xs font-semibold text-skin-text group-hover:text-skin-accent">{title}</span><span className="mt-2 block text-[11px] leading-5 text-skin-dim">{prompt}</span></button>)}</div></div> : <div className="mx-auto flex max-w-3xl flex-col gap-6">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>{message.role === "assistant" && <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-skin-accent-soft text-skin-accent"><Bot size={15} /></span>}<div className={`max-w-[min(85%,620px)] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-skin-accent text-white" : "rounded-bl-md bg-skin-bg text-skin-text"}`}>{message.role === "assistant" ? <MarkdownMessage content={message.content} /> : <span className="whitespace-pre-wrap">{message.content}</span>}{message.truncated && <p className="m-0 mt-2 border-t border-skin-border pt-2 text-[11px] text-skin-dim">Response was cut short by the length limit — try Long.</p>}{message.usage && <p className="m-0 mt-2 border-t border-skin-border pt-2 text-[11px] text-skin-dim">{message.usage.cached ? "Cached — no tokens used" : `${message.usage.prompt_tokens} in · ${message.usage.output_tokens} out · ${message.usage.total_tokens} total${message.usage.calls > 1 ? ` · ${message.usage.calls} calls` : ""}`}</p>}</div>{message.role === "user" && <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-skin-bg text-skin-dim"><User size={15} /></span>}</div>)}{loading && <div className="flex items-center gap-3"><span className="flex size-8 items-center justify-center rounded-lg bg-skin-accent-soft text-skin-accent"><Bot size={15} /></span><div className="rounded-2xl rounded-bl-md bg-skin-bg px-4 py-3"><span className="flex gap-1"><span className="size-1.5 animate-bounce rounded-full bg-skin-dim [animation-delay:-0.2s]" /><span className="size-1.5 animate-bounce rounded-full bg-skin-dim [animation-delay:-0.1s]" /><span className="size-1.5 animate-bounce rounded-full bg-skin-dim" /></span></div></div>}<div ref={messagesEndRef} /></div>}
                    </div>

                    <div className="px-4 pb-4 pt-3 sm:px-8">
                        <form onSubmit={sendMessage} className="mx-auto max-w-3xl">
                            {error && (
                                <div role="alert" className="mb-2 flex items-center justify-between rounded-lg bg-skin-danger-soft px-3 py-2 text-xs text-skin-danger">
                                    <span>{error}</span>
                                    <button type="button" aria-label="Dismiss error" onClick={() => setError("")}><X size={14} /></button>
                                </div>
                            )}
                            <div className="rounded-[26px] border border-skin-border bg-skin-bg p-3 shadow-sm focus-within:border-skin-accent focus-within:ring-2 focus-within:ring-skin-accent/20">
                                <textarea
                                    ref={composerRef}
                                    value={input}
                                    onChange={(event) => {
                                        setInput(event.target.value);
                                        setError("");
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                                            sendMessage(event);
                                        }
                                    }}
                                    rows={2}
                                    maxLength={MAX_MESSAGE_LENGTH}
                                    aria-label="Your message"
                                    placeholder="Ask for follow-up changes"
                                    className="block w-full resize-none bg-transparent px-1 py-1 text-[15px] text-skin-text outline-none placeholder:text-skin-dim"
                                />
                                <div className="mt-2 flex items-center gap-2">
                                    <button
                                        type="button"
                                        disabled
                                        aria-label="Attachments unavailable"
                                        title="Attachments are not available yet"
                                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-skin-dim disabled:cursor-not-allowed"
                                    >
                                        <Plus size={20} strokeWidth={1.5} />
                                    </button>
                                    <div className="relative ml-auto min-w-0">
                                        <select
                                            aria-label="Model and response length"
                                            value={`${model}|${responseLength}`}
                                            onChange={(event) => {
                                                const [nextModel, nextLength] = event.target.value.split("|");
                                                setModel(nextModel);
                                                setResponseLength(nextLength);
                                            }}
                                            disabled={loading}
                                            className="w-full min-w-0 appearance-none truncate rounded-lg bg-transparent py-2 pl-2 pr-7 text-xs text-skin-text outline-none focus-visible:ring-2 focus-visible:ring-skin-accent/40 disabled:opacity-50 sm:text-sm"
                                        >
                                            {[
                                                ["gemini-3.6-flash", "Gemini 3.6 Flash"],
                                            ].flatMap(([id, label]) =>
                                                ["short", "medium", "long"].map((length) => (
                                                    <option key={`${id}|${length}`} value={`${id}|${length}`} className="bg-skin-panel text-skin-text">
                                                        {label} {length[0].toUpperCase() + length.slice(1)}
                                                    </option>
                                                ))
                                            )}
                                        </select>
                                        <ChevronDown size={15} aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-skin-dim" />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={!input.trim() || loading}
                                        aria-label="Send message"
                                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-skin-accent text-theme-contrast transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-skin-accent disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <ArrowUp size={20} strokeWidth={1.8} />
                                    </button>
                                </div>
                            </div>
                            <p className="mt-0.5 text-right text-[10px] text-skin-dim">
                                {input.length} / {MAX_MESSAGE_LENGTH} characters
                            </p>
                        </form>
                    </div>
                </div>
            </div>
            <Modal
                show={pendingAction !== null}
                onClose={() => setPendingAction(null)}
                title={pendingAction ? CONFIRM_ACTIONS[pendingAction.action].title : ""}
                icon={pendingAction ? CONFIRM_ACTIONS[pendingAction.action].icon : undefined}
            >
                <p className="m-0 text-[13px] text-skin-dim">
                    {pendingAction ? CONFIRM_ACTIONS[pendingAction.action].body : ""}
                </p>
                <div className="mt-3.5 flex justify-end gap-2">
                    <SecondaryButton onClick={() => setPendingAction(null)} disabled={loading}>
                        Cancel
                    </SecondaryButton>
                    {pendingAction?.action && CONFIRM_ACTIONS[pendingAction.action].danger ? (
                        <DangerButton onClick={runPendingAction} disabled={loading}>
                            {CONFIRM_ACTIONS[pendingAction.action].label}
                        </DangerButton>
                    ) : (
                        <PrimaryButton type="button" onClick={runPendingAction} disabled={loading}>
                            {pendingAction ? CONFIRM_ACTIONS[pendingAction.action].label : ""}
                        </PrimaryButton>
                    )}
                </div>
            </Modal>

            <Modal
                show={renaming !== null}
                onClose={() => setRenaming(null)}
                title="Rename conversation"
                icon="fa fa-pen"
            >
                <form onSubmit={submitRename}>
                    <label htmlFor="conversation-title" className="m-0 block text-[13px] text-skin-dim">
                        Conversation title
                    </label>
                    <input
                        id="conversation-title"
                        type="text"
                        autoFocus
                        maxLength={MAX_TITLE_LENGTH}
                        value={renaming?.title ?? ""}
                        onChange={(event) => setRenaming({ ...renaming, title: event.target.value })}
                        className="mt-2 w-full rounded-lg border border-skin-border bg-skin-bg px-3 py-2 text-[13px] text-skin-text outline-none focus:border-skin-accent"
                    />
                    <p className="m-0 mt-1.5 text-right text-[11px] text-skin-dim">
                        {(renaming?.title ?? "").length}/{MAX_TITLE_LENGTH}
                    </p>
                    <div className="mt-3.5 flex justify-end gap-2">
                        <SecondaryButton onClick={() => setRenaming(null)} disabled={loading}>
                            Cancel
                        </SecondaryButton>
                        <PrimaryButton type="submit" disabled={loading || !(renaming?.title ?? "").trim()}>
                            Rename
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>

        </section>
    );
};

export default Chat;