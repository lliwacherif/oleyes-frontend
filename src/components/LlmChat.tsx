import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api/client';
import type { Message } from '../api/types';
import { Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

export function LlmChat({ sceneContext }: { sceneContext?: string }) {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'system', content: 'You are a helpful AI assistant for the CCTV Orchestrator.' },
        { role: 'assistant', content: 'Hello! I am your AI assistant. How can I help you regarding the surveillance system?' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMsg: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        try {
            // We send the whole history
            const response = await api.chat({
                messages: [...messages, userMsg].filter(m => m.role !== 'assistant' || true), // Keep all for context
                scene_context: sceneContext // Send the scene context
            });

            const aiMsg: Message = { role: 'assistant', content: response.content };
            setMessages(prev => [...prev, aiMsg]);
        } catch (err) {
            console.error(err);
            const errorMsg: Message = { role: 'assistant', content: "I'm sorry, I encountered an error connecting to the backend." };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="bg-[#0A0D2A]/60 p-1 rounded-2xl border border-[#1E2548] backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col h-full min-h-[600px] overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 to-transparent pointer-events-none rounded-2xl" />

            {/* Header */}
            <div className="px-5 py-4 border-b border-[#1E2548] flex items-center justify-between bg-transparent relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-[#A855F7]/20 border border-[#A855F7]/30 rounded flex items-center justify-center shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                        <Sparkles className="w-4 h-4 text-[#A855F7]" />
                    </div>
                    <div>
                        <h2 className="font-bold text-sm tracking-wide text-white">AI OVERWATCH</h2>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
                            <span className="text-[8px] font-mono text-[#64748B] uppercase tracking-[0.2em]">GPT - OSS - 120B :: ONLINE</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-transparent relative z-10">
                {messages.map((msg, idx) => {
                    if (msg.role === 'system') return null;
                    return (
                        <div
                            key={idx}
                            className={cn(
                                "flex gap-3 max-w-[90%]",
                                msg.role === 'user' ? "ml-auto" : "mr-auto"
                            )}
                        >
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 rounded bg-[#A855F7]/10 border border-[#A855F7]/20 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(168,85,247,0.1)]">
                                    <Sparkles className="w-4 h-4 text-[#A855F7]" />
                                </div>
                            )}

                            <div className={cn(
                                "px-4 py-3 text-[11px] leading-relaxed",
                                msg.role === 'user'
                                    ? "bg-[#1E3A8A]/30 text-blue-100 border border-[#1E3A8A]/50 rounded-lg rounded-tr-sm shadow-sm"
                                    : "bg-transparent text-[#CBD5E1] border border-[#1E2548] rounded-lg rounded-tl-sm shadow-sm"
                            )}>
                                {msg.content}
                            </div>
                        </div>
                    );
                })}

                {isTyping && (
                    <div className="flex gap-3 mr-auto">
                        <div className="w-8 h-8 rounded bg-[#A855F7]/10 border border-[#A855F7]/20 flex items-center justify-center shrink-0">
                            <Sparkles className="w-4 h-4 text-[#A855F7]" />
                        </div>
                        <div className="bg-transparent border border-[#1E2548] p-4 rounded-lg rounded-tl-sm flex gap-1.5 items-center h-10">
                            <div className="w-1.5 h-1.5 bg-[#A855F7]/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 bg-[#A855F7]/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 bg-[#A855F7]/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
                <div ref={scrollRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 border-t border-[#1E2548] bg-transparent relative z-10">
                <div className="relative flex items-center group/chat">
                    <span className="absolute left-4 font-mono text-xs text-[#64748B] group-focus-within/chat:text-[#94A3B8] pointer-events-none transition-colors">
                        &gt;
                    </span>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="QUERY_AI_OVERWATCH..."
                        className="w-full bg-[#121738] border border-[#1E2548] rounded pl-8 pr-4 py-4 font-mono text-xs text-[#E2E8F0] placeholder-[#64748B] focus:outline-none focus:border-cyan-500/50 transition-all shadow-inner"
                    />
                </div>
            </form>
        </div>
    );
}
