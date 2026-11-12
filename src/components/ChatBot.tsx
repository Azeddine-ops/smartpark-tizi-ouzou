"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, SendHorizonal, Sparkles, X } from "lucide-react";
import { postJSON } from "@/lib/client";

interface Msg {
  role: "user" | "bot";
  text: string;
  chips?: string[];
}

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing, open]);

  async function greet() {
    setTyping(true);
    const res = await postJSON<{ text: string; chips: string[] }>("/api/chat", { message: "" });
    setTimeout(() => {
      setMsgs([{ role: "bot", text: res.text, chips: res.chips }]);
      setChips(res.chips);
      setTyping(false);
    }, 450);
  }

  function toggle() {
    setOpen((o) => {
      if (!o && msgs.length === 0) void greet();
      return !o;
    });
  }

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || typing) return;
    setMsgs((m) => [...m, { role: "user", text: clean }]);
    setInput("");
    setTyping(true);
    try {
      const res = await postJSON<{ text: string; chips: string[] }>("/api/chat", { message: clean });
      setTimeout(() => {
        setMsgs((m) => [...m, { role: "bot", text: res.text, chips: res.chips }]);
        setChips(res.chips);
        setTyping(false);
      }, 600);
    } catch {
      setTyping(false);
      setMsgs((m) => [...m, { role: "bot", text: "Oups, petit souci technique. Réessayez !" }]);
    }
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={toggle}
        aria-label="Assistant Sahbi"
        className="fixed bottom-20 right-4 z-50 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-950 shadow-[0_8px_32px_rgba(34,211,238,0.45)] transition-transform hover:scale-105 lg:bottom-6 lg:right-6"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-7 w-7" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="glass fixed bottom-36 right-4 z-50 flex h-[480px] w-[350px] flex-col overflow-hidden rounded-3xl shadow-2xl sm:w-[380px] lg:bottom-24 lg:right-6"
          >
            {/* En-tête */}
            <div className="flex items-center gap-3 border-b border-white/5 bg-white/[0.03] px-4 py-3">
              <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-950">
                <Bot className="h-5 w-5" />
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b1120] bg-emerald-400" />
              </span>
              <div className="flex-1">
                <p className="font-display text-sm font-semibold text-slate-100">
                  Sahbi <span className="text-emerald-300">·</span> Assistant
                </p>
                <p className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Sparkles className="h-3 w-3 text-emerald-400" />
                  Orientation nouveaux utilisateurs — en ligne
                </p>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {msgs.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[85%] rounded-2xl rounded-br-sm bg-emerald-400/15 px-3.5 py-2.5 text-[13px] text-emerald-100"
                        : "glass-soft max-w-[88%] whitespace-pre-line rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-200"
                    }
                  >
                    {m.text}
                  </div>
                </motion.div>
              ))}
              {typing && (
                <div className="flex justify-start">
                  <div className="glass-soft flex gap-1.5 rounded-2xl rounded-bl-sm px-4 py-3">
                    {[0, 1, 2].map((d) => (
                      <motion.span
                        key={d}
                        className="h-1.5 w-1.5 rounded-full bg-emerald-300"
                        animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                        transition={{ repeat: Infinity, duration: 0.9, delay: d * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              )}
              {!typing && chips.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {chips.map((c) => (
                    <button
                      key={c}
                      onClick={() => void send(c)}
                      className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-medium text-emerald-200 transition-colors hover:bg-emerald-400/20"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Saisie */}
            <form
              className="flex items-center gap-2 border-t border-white/5 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Posez votre question…"
                className="h-10 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-[13px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-400/40"
              />
              <button
                type="submit"
                className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-950 transition-transform hover:scale-105"
                aria-label="Envoyer"
              >
                <SendHorizonal className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
