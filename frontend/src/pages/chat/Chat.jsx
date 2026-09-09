import { useEffect, useRef, useState } from "react";
import { Bot, MessageSquarePlus, PanelLeft, Paperclip, Send, Sparkles, Trash2, User, X } from "lucide-react";
import api from "../../api";

const SUGGESTIONS = [
    ["Summarize a task", "Summarize the most important tasks I should focus on today."],
    ["Explore an idea", "Help me think through a new idea and turn it into a practical plan."],
    ["Write something", "Help me write a clear and professional message."],
];

const Chat = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [railOpen, setRailOpen] = useState(false);
    const composerRef = useRef(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    const sendMessage = async (event) => {
        event?.preventDefault();
        const message = input.trim();
        if (!message || loading) return;

        const nextMessages = [...messages, { role: "user", content: message }];
        setMessages(nextMessages);
        setInput("");
        setError("");
        setLoading(true);

        try {
            const res = await api.post("/chat", { message, history: messages });
            setMessages([...nextMessages, { role: "assistant", content: res.data.reply }]);
        } catch (requestError) {
            setError(requestError.response?.data?.detail || "The assistant could not respond. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const startNewChat = () => {
        setMessages([]);
        setInput("");
        setError("");
        setRailOpen(false);
        composerRef.current?.focus();
    };

    return (
        <section className="flex min-h-0 flex-1 bg-skin-bg p-3 font-body sm:p-5">
            <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-skin-border bg-skin-panel shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
                {railOpen && <button type="button" aria-label="Close conversations" className="absolute inset-0 z-10 bg-slate-950/20 lg:hidden" onClick={() => setRailOpen(false)} />}
                <aside className={`absolute inset-y-0 left-0 z-20 flex w-[min(82vw,280px)] flex-col border-r border-skin-border bg-skin-panel transition-transform duration-200 lg:static lg:translate-x-0 ${railOpen ? "translate-x-0" : "-translate-x-full"}`}>
                    <div className="flex items-center justify-between border-b border-skin-border px-4 py-4">
                        <div><p className="m-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-skin-accent">Workspace</p><h1 className="m-0 mt-1 text-base font-semibold text-skin-text">Conversations</h1></div>
                        <button type="button" aria-label="Close conversations" className="rounded-lg p-2 text-skin-dim hover:bg-skin-accent-soft lg:hidden" onClick={() => setRailOpen(false)}><X size={16} /></button>
                    </div>
                    <div className="p-3"><button type="button" className="flex w-full items-center justify-center gap-2 rounded-xl border border-skin-border px-3 py-2.5 text-xs font-semibold text-skin-text hover:border-skin-accent hover:bg-skin-accent-soft" onClick={startNewChat}><MessageSquarePlus size={15} />New conversation</button></div>
                    <div className="min-h-0 flex-1 px-2"><p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-skin-dim">Today</p><button type="button" className="flex w-full items-start gap-3 rounded-xl bg-skin-accent-soft px-3 py-3 text-left"><span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-skin-accent text-white"><Sparkles size={14} /></span><span className="min-w-0"><span className="block truncate text-xs font-semibold text-skin-text">New conversation</span><span className="mt-1 block truncate text-[11px] text-skin-dim">Start something useful</span></span></button></div>
                    <div className="border-t border-skin-border p-3"><div className="flex items-center gap-2 rounded-xl bg-skin-bg px-3 py-2.5"><Bot size={16} className="text-skin-accent" /><span className="min-w-0 flex-1 text-xs font-medium text-skin-text">AI assistant</span><span className="size-1.5 rounded-full bg-emerald-500" title="Online" /></div></div>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                    <header className="flex items-center justify-between border-b border-skin-border px-4 py-3 sm:px-6">
                        <div className="flex min-w-0 items-center gap-3"><button type="button" aria-label="Open conversations" className="rounded-lg p-2 text-skin-dim hover:bg-skin-accent-soft lg:hidden" onClick={() => setRailOpen(true)}><PanelLeft size={17} /></button><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-skin-accent-soft text-skin-accent"><Bot size={18} /></span><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="m-0 truncate text-sm font-semibold text-skin-text">AI assistant</h2><span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-600">Online</span></div><p className="m-0 mt-0.5 truncate text-[11px] text-skin-dim">A thoughtful place to work through ideas</p></div></div>
                        <button type="button" aria-label="Clear conversation" title="Clear conversation" className="rounded-lg p-2 text-skin-dim hover:bg-skin-accent-soft hover:text-skin-text" onClick={startNewChat}><Trash2 size={16} /></button>
                    </header>

                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
                        {messages.length === 0 ? <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center"><div className="mb-8"><span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-skin-accent text-white shadow-lg shadow-skin-accent/20"><Sparkles size={22} /></span><p className="m-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-skin-accent">Your thinking partner</p><h3 className="m-0 mt-2 max-w-lg text-3xl font-semibold leading-tight tracking-tight text-skin-text sm:text-4xl">What would you like to work through?</h3><p className="m-0 mt-3 max-w-xl text-sm leading-6 text-skin-dim">Ask a question, shape an idea, or get a fresh perspective on the work in front of you.</p></div><div className="grid gap-2 sm:grid-cols-3">{SUGGESTIONS.map(([title, prompt]) => <button key={title} type="button" className="group rounded-xl border border-skin-border bg-skin-bg p-4 text-left hover:-translate-y-0.5 hover:border-skin-accent hover:shadow-sm" onClick={() => { setInput(prompt); composerRef.current?.focus(); }}><span className="block text-xs font-semibold text-skin-text group-hover:text-skin-accent">{title}</span><span className="mt-2 block text-[11px] leading-5 text-skin-dim">{prompt}</span></button>)}</div></div> : <div className="mx-auto flex max-w-3xl flex-col gap-6">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>{message.role === "assistant" && <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-skin-accent-soft text-skin-accent"><Bot size={15} /></span>}<div className={`max-w-[min(85%,620px)] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-skin-accent text-white" : "rounded-bl-md bg-skin-bg text-skin-text"}`}>{message.content}</div>{message.role === "user" && <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-skin-bg text-skin-dim"><User size={15} /></span>}</div>)}{loading && <div className="flex items-center gap-3"><span className="flex size-8 items-center justify-center rounded-lg bg-skin-accent-soft text-skin-accent"><Bot size={15} /></span><div className="rounded-2xl rounded-bl-md bg-skin-bg px-4 py-3"><span className="flex gap-1"><span className="size-1.5 animate-bounce rounded-full bg-skin-dim [animation-delay:-0.2s]" /><span className="size-1.5 animate-bounce rounded-full bg-skin-dim [animation-delay:-0.1s]" /><span className="size-1.5 animate-bounce rounded-full bg-skin-dim" /></span></div></div>}<div ref={messagesEndRef} /></div>}
                    </div>

                    <div className="border-t border-skin-border px-4 pb-4 pt-3 sm:px-8"><form onSubmit={sendMessage} className="mx-auto max-w-3xl">{error && <div className="mb-2 flex items-center justify-between rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600"><span>{error}</span><button type="button" aria-label="Dismiss error" onClick={() => setError("")}><X size={14} /></button></div>}<div className="flex items-end gap-2 rounded-2xl border border-skin-border bg-skin-bg p-2 focus-within:border-skin-accent focus-within:ring-2 focus-within:ring-skin-accent/10"><button type="button" aria-label="Attach file" title="Attach file" className="mb-0.5 rounded-lg p-2 text-skin-dim hover:bg-skin-accent-soft hover:text-skin-text"><Paperclip size={17} /></button><textarea ref={composerRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) sendMessage(event); }} rows={1} placeholder="Message your assistant..." className="max-h-32 min-h-10 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm text-skin-text outline-none placeholder:text-skin-dim" /><button type="submit" aria-label="Send message" title="Send message" disabled={!input.trim() || loading} className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-skin-accent text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"><Send size={16} /></button></div><div className="mt-2 flex items-center justify-between px-1 text-[10px] text-skin-dim"><span>Press Enter to send</span><span>Assistant</span></div></form></div>
                </div>
            </div>
        </section>
    );
};

export default Chat;