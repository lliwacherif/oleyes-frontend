import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import type { YoloStreamMessage, LogicOutput, YoloFrameEvent, CameraData } from '../api/types';
import { Search, Play, AlertCircle, ShieldAlert, Activity, Users, StopCircle, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

export function YoloDetector({ sceneContext }: { sceneContext?: string }) {
    const [url, setUrl] = useState('');
    const [jobId, setJobId] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [logicData, setLogicData] = useState<LogicOutput | null>(null);
    const [llmAnalysis, setLlmAnalysis] = useState<string | null>(null);
    const [currentBatch, setCurrentBatch] = useState<YoloFrameEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeCameras, setActiveCameras] = useState<CameraData[]>([]);

    const sourceRef = useRef<EventSource | null>(null);

    // Fetch active cameras
    useEffect(() => {
        const loadCameras = async () => {
            try {
                const fetched = await api.getCameras();
                if (fetched) {
                    setActiveCameras(fetched.filter(c => c.is_active));
                }
            } catch (err) {
                console.error("Failed to load generic cameras", err);
            }
        };
        loadCameras();
    }, []);

    // AI Polling Logic
    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval> | null = null;

        if (status === 'running' && logicData) {
            // Poll every 5 seconds
            intervalId = setInterval(async () => {
                try {
                    const prompt = `
SURVEILLANCE DATA:
${JSON.stringify({ ...logicData, objects: logicData.objects.slice(0, 5) })} 
${sceneContext ? `SCENE CONTEXT: ${sceneContext}` : ''}

TASK: 
1. Key behavior analysis.
2. Assess risk level (LOW/MEDIUM/HIGH) and numeric score (0-100).
3. Determine the label (e.g., Safe, Theft Suspected, Violence, Suspicious).
4. OUTPUT MUST BE PURE JSON format:
{"risk_score": <number>, "risk_level": "<HIGH/MEDIUM/LOW>", "label": "<string>", "explanation": "<string>"}
`;

                    const response = await api.chat({
                        messages: [
                            { role: 'system', content: 'You are a tactical security AI. Output ONLY JSON.' },
                            { role: 'user', content: prompt }
                        ],
                        scene_context: sceneContext
                    });

                    if (response && response.content) {
                        setLlmAnalysis(response.content);
                    }
                } catch (err) {
                    console.error("AI Polling Error:", err);
                }
            }, 5000);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [status, logicData, sceneContext]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        startDetection(url);
    };

    const startDetection = async (targetUrl: string) => {
        if (!targetUrl) return;

        setIsLoading(true);
        setError(null);
        setJobId(null);
        setStatus('queued');
        setCurrentBatch([]);
        setLogicData(null);
        setLlmAnalysis(null);

        try {
            // Trim and ensure protocol
            const cleanUrl = targetUrl.trim();
            const validUrl = cleanUrl.startsWith('http') || cleanUrl.startsWith('rtsp') ? cleanUrl : `https://${cleanUrl}`;

            const resp = await api.detectYoutube(validUrl, sceneContext);
            setJobId(resp.job_id);
            setStatus(resp.status);
        } catch (err: any) {
            console.error("Detection Error:", err);
            // Extract detailed validation error from FastAPI
            if (err.response?.data?.detail) {
                const detail = err.response.data.detail;
                // If detail is an array (Pydantic validation error), formatting it
                if (Array.isArray(detail)) {
                    setError(`Validation Error: ${detail.map((e: any) => e.msg).join(', ')}`);
                } else {
                    setError(`Error: ${detail}`);
                }
            } else {
                setError('Failed to start detection job.');
            }
            setIsLoading(false);
        }
    };

    const handleStop = async () => {
        if (jobId) {
            try {
                await api.stopJob(jobId);
            } catch (err) {
                console.error("Failed to stop job backend:", err);
            }
        }
        if (sourceRef.current) {
            sourceRef.current.close();
            sourceRef.current = null;
        }
        setIsLoading(false);
        setStatus('stopped');
    };

    // Helper for AI text removed as per new implementation

    useEffect(() => {
        if (!jobId) return;

        console.log(`Starting monitoring for Job ${jobId}`);
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const streamUrl = `${API_BASE}/api/v1/vision/jobs/${jobId}/stream`;

        // Cleanup old source if exists
        if (sourceRef.current) {
            sourceRef.current.close();
        }

        const source = new EventSource(streamUrl);
        sourceRef.current = source;

        source.onmessage = (event) => {
            try {
                const data: YoloStreamMessage = JSON.parse(event.data);

                setStatus(data.status);

                // 1. Batched Frames (every 4 frames)
                if (data.last_event?.batch) {
                    setCurrentBatch(data.last_event.batch);
                }

                // 2. Logic Data
                if (data.logic) {
                    setLogicData(data.logic);
                }

                // 3. LLM Analysis (every 8 frames)
                if (data.analysis?.text) {
                    setLlmAnalysis(data.analysis.text);
                }

                // 4. Stop Condition
                if (data.status === 'done' || data.status === 'failed' || data.status === 'error') {
                    source.close();
                    sourceRef.current = null;
                    setIsLoading(false);
                }
            } catch (err) {
                console.error("Error parsing SSE data", err);
            }
        };

        source.onerror = (err) => {
            console.error("SSE Error:", err);
            source.close();
            sourceRef.current = null;
            setIsLoading((loading) => {
                if (loading) setError("Stream connection interrupted");
                return false;
            });
        };

        return () => {
            if (sourceRef.current) {
                sourceRef.current.close();
            }
        };
    }, [jobId]);

    return (
        <div className="bg-[#0A0D2A]/60 p-6 rounded-2xl border border-[#1E2548] backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col h-full relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 to-transparent opacity-100 pointer-events-none rounded-2xl" />

            <div className="mb-8 relative z-10">
                <h2 className="text-[22px] font-bold flex items-center gap-3 text-white tracking-wide uppercase">
                    <Search className="text-cyan-400 w-6 h-6" />
                    VISION INTERFACE
                </h2>
                <div className="text-[10px] font-mono text-[#64748B] tracking-[0.15em] mt-3 uppercase">
                    [ MODULE : OBJECT_DETECTION_ENGINE ]
                </div>
            </div>

            {/* Active Cameras Section */}
            {activeCameras.length > 0 && (
                <div className="mb-6 relative z-10 bg-[#060818]/80 border border-[#1E2548] rounded-[8px] p-4 shadow-inner overflow-hidden">
                    <h3 className="text-[#94A3B8] font-mono text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
                        ACTIVE CAMERAS
                    </h3>
                    <div className="space-y-3 max-h-[160px] overflow-y-auto custom-scrollbar pr-2">
                        {activeCameras.map(cam => (
                            <div key={cam.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#0A0D2A]/50 border border-[#1E2548]/50 rounded text-[11px] font-mono hover:border-[#10B981]/30 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <Video className="w-4 h-4 text-[#10B981]" />
                                    <div>
                                        <div className="text-white font-bold">{cam.name}</div>
                                        <div className="text-[#64748B] truncate max-w-[200px] sm:max-w-[300px]" title={cam.rtsp_url}>
                                            {cam.rtsp_url}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => startDetection(cam.rtsp_url)}
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 rounded hover:bg-[#10B981]/20 disabled:opacity-50 transition-colors flex items-center gap-2 self-start sm:self-auto"
                                >
                                    <Play className="w-3 h-3" />
                                    EXECUTE
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 mb-6 relative z-10">
                <div className="relative flex-1 group/input">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        <span className="text-cyan-500/50 group-focus-within/input:text-cyan-400 font-mono text-xs transition-colors">&gt;_</span>
                    </div>
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://www.youtube.com/shorts/..."
                        className="w-full bg-[#121738] border border-[#1E2548] rounded pl-10 pr-4 py-3 text-[#94A3B8] font-mono text-xs focus:outline-none focus:border-cyan-500/50 transition-all shadow-inner"
                    />
                </div>
                {isLoading ? (
                    <button
                        type="button"
                        onClick={handleStop}
                        className="bg-red-900/20 border border-red-500/50 hover:bg-red-900/40 text-red-400 px-8 py-3 rounded font-mono text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-3 min-w-[140px]"
                    >
                        <StopCircle className="w-3.5 h-3.5" />
                        ABORT
                    </button>
                ) : (
                    <button
                        type="submit"
                        disabled={!url}
                        className="bg-[#041A3B] border border-[#1E3A8A] hover:bg-[#1E3A8A]/50 disabled:border-[#1E2548] disabled:text-[#64748B] disabled:bg-transparent text-cyan-400 px-8 py-3 rounded font-mono text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-3 min-w-[140px]"
                    >
                        <Play className="w-3.5 h-3.5" />
                        EXECUTE
                    </button>
                )}
            </form>

            {/* Status Indicator */}
            {(status === 'running' || status === 'done' || status === 'stopped' || status === 'failed' || status === 'error') && (
                <div className="flex items-center gap-3 mb-8 bg-[#1E2548]/30 border border-[#1E2548] rounded px-3 py-1.5 self-start relative z-10">
                    <span className="text-[#64748B] font-mono text-[10px] uppercase tracking-widest pl-1">SYS_STATUS //</span>
                    <span className={`text-[10px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded-sm ${status === 'running' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20'}`}>
                        [ {status === 'running' ? 'PROCESSING' : status} ]
                    </span>
                </div>
            )}

            <AnimatePresence mode="wait">
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 flex items-center gap-3 mb-6 relative z-10"
                    >
                        <AlertCircle className="w-5 h-5" />
                        {error}
                    </motion.div>
                )}

                {(status === 'running' || status === 'done' || status === 'stopped' || status === 'failed' || status === 'error') && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 relative z-10">
                        {/* Logic Engine Dashboard */}
                        {logicData && (
                            <div className="bg-[#0A0D2A]/80 rounded-2xl border border-[#1E2548] p-6 shadow-inner">

                                {/* Situation Classification (Moved to Top) */}
                                {llmAnalysis && (
                                    <div className="mb-6 bg-[#0A0A0B] rounded-sm p-4 border border-[#2A2A35] flex flex-col justify-center shadow-inner">
                                        <h4 className="text-neutral-400 font-mono text-xs tracking-widest mb-4 flex items-center justify-center gap-2 uppercase border-b border-[#2A2A35] pb-2 text-center">
                                            <Activity className="w-4 h-4 text-cyan-500" /> SITUATION_STATUS <Activity className="w-4 h-4 text-cyan-500" />
                                        </h4>

                                        {(() => {
                                            let analysisData = { risk_score: 0, risk_level: 'UNKNOWN', label: 'Analyzing...' };
                                            try {
                                                const jsonMatch = llmAnalysis.match(/\{[\s\S]*\}/);
                                                if (jsonMatch) {
                                                    const parsed = JSON.parse(jsonMatch[0]);
                                                    analysisData = { ...analysisData, ...parsed };
                                                }
                                            } catch (e) {
                                                console.warn("Could not parse LLM JSON", e);
                                            }

                                            // Color Mapping based on RISK LEVEL or LABEL
                                            const getStatusColor = (level: string, label: string) => {
                                                const l = level.toUpperCase();
                                                const lbl = label.toLowerCase();

                                                if (l === 'HIGH' || lbl.includes('violence') || lbl.includes('theft') || lbl.includes('weapon'))
                                                    return {
                                                        border: 'border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]',
                                                        bg: 'bg-red-950/40',
                                                        accent: 'text-red-500'
                                                    };
                                                if (l === 'MEDIUM' || lbl.includes('suspicious'))
                                                    return {
                                                        border: 'border-amber-500 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]',
                                                        bg: 'bg-amber-950/40',
                                                        accent: 'text-amber-500'
                                                    };
                                                if (l === 'LOW' || lbl.includes('safe'))
                                                    return {
                                                        border: 'border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]',
                                                        bg: 'bg-emerald-950/40',
                                                        accent: 'text-emerald-500'
                                                    };

                                                return {
                                                    border: 'border-[#2A2A35] text-neutral-400',
                                                    bg: 'bg-[#0A0A0B]',
                                                    accent: 'text-neutral-500'
                                                };
                                            };

                                            const style = getStatusColor(analysisData.risk_level, analysisData.label);

                                            return (
                                                <div className={`mt-2 p-6 rounded-sm border ${style.border} ${style.bg} flex flex-col items-center justify-center text-center gap-3 relative overflow-hidden bg-opacity-70 backdrop-blur-sm`}>
                                                    {analysisData.risk_level === 'LOW' && (
                                                        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(16,185,129,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px] pointer-events-none" />
                                                    )}
                                                    <div className="text-xs font-mono opacity-80 uppercase tracking-widest relative z-10 w-full flex justify-between px-4">
                                                        <span>DEFCON</span>
                                                        <span className={style.accent}>LV_{analysisData.risk_score}</span>
                                                    </div>
                                                    <span className="text-2xl font-bold uppercase tracking-widest font-mono relative z-10">{analysisData.label}</span>
                                                    <div className="text-sm font-mono font-bold px-4 py-1.5 rounded-sm bg-[#050505] border border-current relative z-10">
                                                        [ {analysisData.risk_level} RISK ]
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Logic Engine Analysis Block */}
                                <div className="mb-6">
                                    <h3 className="text-[14px] font-bold tracking-widest mb-4 flex items-center gap-2 text-white uppercase">
                                        <ShieldAlert className="w-4 h-4 text-white" />
                                        LOGIC ENGINE ANALYSIS
                                    </h3>
                                    <div className="bg-[#0A0D2A]/40 border border-[#1E2548] rounded-[8px] p-5 font-mono text-[10px] overflow-hidden relative shadow-inner">
                                        <div className="text-[#06B6D4] font-bold mb-3 tracking-widest">[ SYS.LOGIC_SUMMARY ]</div>
                                        <div className="text-neutral-500 mb-2">&gt;</div>
                                        <div className="text-[#94A3B8] leading-relaxed pl-2 uppercase">
                                            {logicData.summary_text}
                                            {logicData.scene_text && (
                                                <div className="mt-2 text-[#64748B]">
                                                    {logicData.scene_text}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Tactical Assessment */}
                                {llmAnalysis && (
                                    <div className="mb-6 bg-[#0A0D2A]/40 border border-[#1E2548] rounded-[8px] p-5 shadow-inner">
                                        <div className="flex items-center justify-between mb-4 border-b border-[#1E2548] pb-4">
                                            <h4 className="text-[#10B981] font-bold text-[11px] tracking-widest flex items-center gap-2 uppercase">
                                                <span className="text-neutral-500">&gt;_</span> TACTICAL ASSESSMENT <span className="text-neutral-500 ml-2">[JSON_OUT]</span>
                                            </h4>
                                            <div className="flex items-center gap-2 px-2 py-0.5 rounded-sm bg-[#06B6D4]/10 border border-[#06B6D4]/20">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#06B6D4] shadow-[0_0_5px_rgba(6,182,212,0.8)]" />
                                                <span className="text-[9px] font-mono tracking-widest text-[#06B6D4] uppercase">
                                                    {status === 'running' ? 'PROCESSING' : status}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="font-mono text-[10px] leading-relaxed text-[#94A3B8] whitespace-pre-wrap pl-2 uppercase">
                                            &gt; <ReactMarkdown
                                                components={{
                                                    strong: ({ node, ...props }) => <span className="text-cyan-300 font-bold" {...props} />,
                                                    em: ({ node, ...props }) => <span className="text-emerald-400 font-bold" {...props} />,
                                                    p: ({ node, ...props }) => <span {...props} />,
                                                }}
                                            >
                                                {llmAnalysis}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                )}

                                {/* Logic Details Grid */}
                                <div className="grid grid-cols-1 gap-4 mt-4">
                                    {(logicData?.armed_subjects?.length > 0 || logicData?.fighting_pairs?.length > 0) && (
                                        <div className="bg-[#1a0f14] rounded-sm p-4 border border-red-500/40 shadow-[inset_0_0_15px_rgba(239,68,68,0.1)]">
                                            <h4 className="text-red-400 font-mono text-xs tracking-widest mb-3 flex items-center gap-2 uppercase">
                                                <Activity className="w-4 h-4" /> [CRITICAL_EVENTS_DETECTED]
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {(logicData.armed_subjects || []).map((subj, i) => (
                                                    <div key={`armed-${i}`} className="text-red-300 font-mono text-xs bg-red-950/40 p-2 border border-red-500/30">
                                                        <span className="text-red-500 font-bold mr-2">!</span> ARMED: {subj}
                                                    </div>
                                                ))}
                                                {(logicData.fighting_pairs || []).map((pair, i) => (
                                                    <div key={`fight-${i}`} className="text-amber-300 font-mono text-xs bg-amber-950/40 p-2 border border-amber-500/30">
                                                        <span className="text-amber-500 font-bold mr-2">!</span> FIGHT: {pair}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}



                                    {/* Tracked Entities */}
                                    {(logicData?.objects?.length > 0) && (
                                        <div className="bg-[#0A0D2A]/40 rounded-[8px] p-5 border border-[#1E2548] shadow-inner flex flex-col">
                                            <h4 className="text-white font-bold text-[11px] tracking-widest mb-4 flex items-center justify-between border-b border-[#1E2548] pb-4">
                                                <div className="flex items-center gap-2 uppercase">
                                                    <Users className="w-4 h-4 text-[#A855F7]" /> [ TRACKED_ENTITIES ]
                                                </div>
                                                <span className="text-white bg-[#A855F7]/40 px-3 py-1 text-[10px] rounded-sm font-mono tracking-widest uppercase">
                                                    COUNT : {logicData.objects.length}
                                                </span>
                                            </h4>

                                            {/* Tabular Header */}
                                            <div className="grid grid-cols-12 text-[9px] font-medium text-neutral-500 mb-3 uppercase px-4 pt-2">
                                                <div className="col-span-6">ID(ZONE)</div>
                                                <div className="col-span-3">VELOCITY</div>
                                                <div className="col-span-3 text-right">DWELL_TM</div>
                                            </div>

                                            <div className="space-y-3 overflow-y-auto max-h-[200px] custom-scrollbar px-4 pb-2">
                                                {(logicData.objects || []).map((obj) => (
                                                    <div key={obj.track_id} className="grid grid-cols-12 text-[11px] font-mono items-center transition-all group/row font-semibold">
                                                        <div className="col-span-6 flex items-center gap-1.5 tracking-wider">
                                                            <span className="text-white">#{obj.track_id}</span>
                                                            <span className="text-[#64748B]">({obj.zone})</span>
                                                        </div>
                                                        <div className="col-span-3 text-[#06B6D4]">
                                                            {obj.speed.toFixed(1)} <span className="text-[10px] text-[#64748B]">m/s</span>
                                                        </div>
                                                        <div className="col-span-3 text-right text-[#EAB308]">
                                                            {obj.loiter_seconds} <span className="text-[10px] text-[#64748B]">sec</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        )}

                        {/* Detailed Batch Processing Log */}
                        {currentBatch.length > 0 && (
                            <div className="bg-[#0A0D2A]/40 rounded-[8px] border border-[#1E2548] shadow-inner mt-6 overflow-hidden">
                                <div className="border-b border-[#1E2548] px-5 py-4 flex items-center justify-between">
                                    <h3 className="text-[#94A3B8] font-bold text-[11px] tracking-widest flex items-center gap-2 uppercase">
                                        <span className="text-neutral-500">&gt;_</span> PROCESSING BATCH LOG
                                    </h3>
                                    <span className="text-[10px] font-mono text-[#64748B] bg-[#1E2548]/50 px-3 py-1 rounded-sm tracking-widest uppercase">
                                        BUFFER: {currentBatch.length} FRAMES
                                    </span>
                                </div>

                                <div className="p-5 space-y-2 h-[200px] overflow-y-auto custom-scrollbar">
                                    {currentBatch.map((frame, i) => (
                                        <div key={i} className="flex gap-4 pb-1 mb-1 font-mono text-[9px] uppercase leading-relaxed">
                                            <span className="text-[#64748B] shrink-0 select-none">
                                                [{String(frame.frame_index).padStart(5, '0')}]:
                                            </span>
                                            <span className="text-[#10B981] break-words flex-1">
                                                {frame.scene_text || `NO_METADATA_EXTRACTED_FOR_FRAME`}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
