import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api/client';
import type { YoloStreamMessage, LogicOutput, YoloFrameEvent, CameraData, Zone, ZonePoint, ZoneAlert } from '../api/types';
import { Search, Play, AlertCircle, ShieldAlert, Activity, Users, StopCircle, Video, Eye, X, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

const renderParsedSummary = (text: string) => {
    if (!text) return null;

    const eventsPattern = /EVENTS:\s*(.*?)(?=TIMELINE \(recent history\):|CURRENT STATE:|$)/s;
    const timelinePattern = /TIMELINE \(recent history\):\s*(.*?)(?=CURRENT STATE:|$)/s;
    const currentStatePattern = /CURRENT STATE:\s*(.*?)$/s;

    const eventsMatch = text.match(eventsPattern);
    const timelineMatch = text.match(timelinePattern);
    const currStateMatch = text.match(currentStatePattern);

    const renderEvents = (eventsStr: string) => {
        const lines = eventsStr.split('- ALERT:').filter(l => l.trim().length > 0);
        if (lines.length === 0) return <div className="text-[#64748B]">NO SIGNIFICANT ALERTS</div>;
        return (
            <div className="space-y-1">
                {lines.map((l, i) => (
                    <div key={i} className="flex gap-2 text-amber-400 bg-amber-950/20 p-2 border border-amber-900/30 rounded-sm">
                        <span className="text-amber-500 font-bold">!</span>
                        <span className="leading-relaxed">{l.trim()}</span>
                    </div>
                ))}
            </div>
        );
    };

    const renderTimeline = (timelineStr: string) => {
        const lines = timelineStr.split(/(?=T-\d+\.\d+s:)/).filter(l => l.trim().length > 0);
        return (
            <div className="space-y-2 mt-2">
                {lines.map((l, i) => {
                    const match = l.match(/^(T-\d+\.\d+s:)\s*(.*)/);
                    if (!match) return <div key={i} className="text-[#94A3B8]">{l}</div>;
                    return (
                        <div key={i} className="flex flex-col sm:flex-row gap-2 border-l-2 border-[#1E2548] pl-3 py-1 bg-[#121738]/30">
                            <span className="text-cyan-400 shrink-0 font-bold">{match[1]}</span>
                            <span className="text-[#94A3B8] leading-relaxed">{match[2]}</span>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderCurrent = (currStr: string) => {
        const entities = currStr.split(/(?=[A-Z][a-zA-Z\s]*#\d+:)/).filter(l => l.trim().length > 0);
        if (entities.length <= 1) return <div className="text-emerald-400 mt-2 whitespace-pre-wrap leading-relaxed">{currStr.trim()}</div>;

        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {entities.map((l, i) => (
                    <div key={i} className="bg-[#10B981]/10 text-emerald-400 p-2 rounded-sm border border-[#10B981]/20">
                        {l.trim()}
                    </div>
                ))}
            </div>
        );
    };

    if (!eventsMatch && !timelineMatch && !currStateMatch) {
        return <div className="whitespace-pre-wrap leading-relaxed pl-2 text-[#94A3B8]">{text}</div>;
    }

    return (
        <div className="font-mono text-[10px] space-y-5 uppercase">
            {eventsMatch && (
                <div>
                    <div className="text-[#06B6D4] font-bold mb-2 border-b border-[#06B6D4]/30 pb-1 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4]" />
                        DETECTED EVENTS
                    </div>
                    {renderEvents(eventsMatch[1])}
                </div>
            )}
            {timelineMatch && (
                <div>
                    <div className="text-[#06B6D4] font-bold mb-2 border-b border-[#06B6D4]/30 pb-1 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4]" />
                        TIMELINE (RECENT HISTORY)
                    </div>
                    {renderTimeline(timelineMatch[1])}
                </div>
            )}
            {currStateMatch && (
                <div>
                    <div className="text-[#06B6D4] font-bold mb-2 border-b border-[#06B6D4]/30 pb-1 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
                        CURRENT STATE
                    </div>
                    {renderCurrent(currStateMatch[1])}
                </div>
            )}
        </div>
    );
};

// Skeleton types & constants
interface SkeletonKeypoint { x: number; y: number; conf: number; }
interface SkeletonPerson { track_id: number; bbox: [number, number, number, number]; keypoints: SkeletonKeypoint[]; }
interface SkeletonFrame { persons: SkeletonPerson[]; frame_index: number; }

const SKELETON_EDGES: [number, number, string][] = [
    [0, 1, "#06B6D4"], [0, 2, "#06B6D4"],     // nose→eyes (cyan)
    [1, 3, "#06B6D4"], [2, 4, "#06B6D4"],     // eyes→ears (cyan)
    [5, 6, "#10B981"],                          // shoulder→shoulder (green)
    [5, 7, "#8B5CF6"], [7, 9, "#8B5CF6"],     // left arm (purple)
    [6, 8, "#3B82F6"], [8, 10, "#3B82F6"],    // right arm (blue)
    [5, 11, "#10B981"], [6, 12, "#10B981"],   // torso (green)
    [11, 12, "#10B981"],                        // hip→hip (green)
    [11, 13, "#EF4444"], [13, 15, "#EF4444"], // left leg (red)
    [12, 14, "#F97316"], [14, 16, "#F97316"], // right leg (orange)
];
const MIN_CONF = 0.3;

export function YoloDetector({ sceneContext }: { sceneContext?: string }) {
    const [jobId, setJobId] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [logicData, setLogicData] = useState<LogicOutput | null>(null);
    const [llmAnalysis, setLlmAnalysis] = useState<any | null>(null);
    const [currentBatch, setCurrentBatch] = useState<YoloFrameEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeCameras, setActiveCameras] = useState<CameraData[]>([]);
    const [viewingCameraId, setViewingCameraId] = useState<string | null>(null);

    // Zone Definitions Overlay State
    const [zones, setZones] = useState<Zone[]>([]);
    const [isDrawingZone, setIsDrawingZone] = useState(false);
    const [currentZonePoints, setCurrentZonePoints] = useState<ZonePoint[]>([]);
    const [isSavingZone, setIsSavingZone] = useState(false);
    const [videoNatRes, setVideoNatRes] = useState({w: 1920, h: 1080});
    const [zoneAlerts, setZoneAlerts] = useState<ZoneAlert[]>([]);
    const [mousePos, setMousePos] = useState<ZonePoint | null>(null);
    const streamImgRef = useRef<HTMLImageElement>(null);
    const streamSvgRef = useRef<SVGSVGElement>(null);

    // Skeleton overlay state
    const [skeletonActive, setSkeletonActive] = useState(false);
    const [skeletonData, setSkeletonData] = useState<SkeletonFrame | null>(null);
    const skeletonSourceRef = useRef<EventSource | null>(null);

    // Logic Engine accordion state
    const [isLogicExpanded, setIsLogicExpanded] = useState(false);

    useEffect(() => {
        if (viewingCameraId) {
            api.getZones(viewingCameraId).then(setZones).catch(console.error);
        } else {
            setZones([]);
            // Clean up skeleton when closing camera
            skeletonSourceRef.current?.close();
            skeletonSourceRef.current = null;
            setSkeletonData(null);
            setSkeletonActive(false);
            setIsDrawingZone(false);
            setCurrentZonePoints([]);
        }
    }, [viewingCameraId]);

    // Skeleton cleanup on unmount
    useEffect(() => {
        return () => { skeletonSourceRef.current?.close(); };
    }, []);

    const toggleSkeleton = (cameraId: string) => {
        if (skeletonActive) {
            skeletonSourceRef.current?.close();
            skeletonSourceRef.current = null;
            setSkeletonData(null);
            setSkeletonActive(false);
            return;
        }
        const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const token = localStorage.getItem('access_token');
        const src = new EventSource(`${API}/api/v1/cameras/${cameraId}/skeleton?token=${token}`);
        src.onmessage = (e) => {
            try { setSkeletonData(JSON.parse(e.data)); } catch {}
        };
        src.onerror = () => {
            src.close();
            skeletonSourceRef.current = null;
            setSkeletonActive(false);
        };
        skeletonSourceRef.current = src;
        setSkeletonActive(true);
    };

    const svgCoordsFromEvent = (e: React.MouseEvent<SVGSVGElement>): ZonePoint => {
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();
        return {
            x: Math.round(((e.clientX - rect.left) / rect.width) * videoNatRes.w),
            y: Math.round(((e.clientY - rect.top) / rect.height) * videoNatRes.h),
        };
    };
    const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!isDrawingZone) return;
        const pt = svgCoordsFromEvent(e);
        if (currentZonePoints.length >= 3) {
            const first = currentZonePoints[0];
            const dist = Math.hypot(pt.x - first.x, pt.y - first.y);
            const snapRadius = Math.max(videoNatRes.w, videoNatRes.h) * 0.02;
            if (dist < snapRadius) {
                handleSaveZone();
                return;
            }
        }
        setCurrentZonePoints(prev => [...prev, pt]);
    };
    const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!isDrawingZone) return;
        setMousePos(svgCoordsFromEvent(e));
    };
    const handleSvgRightClick = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!isDrawingZone || currentZonePoints.length === 0) return;
        e.preventDefault();
        setCurrentZonePoints(prev => prev.slice(0, -1));
    };
    const handleUndoPoint = () => {
        setCurrentZonePoints(prev => prev.slice(0, -1));
    };

    const handleSaveZone = async () => {
        if (currentZonePoints.length < 3) {
            alert("A zone must have at least 3 points.");
            return;
        }
        if (!viewingCameraId) return;

        setIsSavingZone(true);
        try {
            const zName = `Zone ${zones.length + 1}`;
            const newZone = await api.createZone({
                camera_id: viewingCameraId,
                name: zName,
                points: currentZonePoints,
                color: "#EF4444",
                instruction: "",
            });
            setZones(prev => [...prev, newZone]);
        } catch (err) {
            console.error("Failed to save zone:", err);
            alert("Failed to save zone");
        } finally {
            setIsSavingZone(false);
            setIsDrawingZone(false);
            setCurrentZonePoints([]);
        }
    };

    const handleDeleteZone = async (zoneId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await api.deleteZone(zoneId);
            setZones(prev => prev.filter(z => z.id !== zoneId));
        } catch (err) {
            console.error("Failed to delete zone", err);
        }
    };

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



    const startDetection = async (targetUrl: string, cameraId?: string) => {
        if (!targetUrl) return;

        setIsLoading(true);
        setError(null);
        setJobId(null);
        setStatus('queued');
        setCurrentBatch([]);
        setLogicData(null);
        setLlmAnalysis(null);
        setZoneAlerts([]);

        try {
            const cleanUrl = targetUrl.trim();
            const resp = await api.detectRtsp(cleanUrl, sceneContext, cameraId);

            setJobId(resp.job_id);
            setStatus(resp.status);
        } catch (err: any) {
            console.error("Detection Error:", err);
            if (err.response?.data?.detail) {
                const detail = err.response.data.detail;
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

    const startDetectionRtmp = async (streamKey: string, cameraId?: string) => {
        if (!streamKey) return;

        setIsLoading(true);
        setError(null);
        setJobId(null);
        setStatus('queued');
        setCurrentBatch([]);
        setLogicData(null);
        setLlmAnalysis(null);
        setZoneAlerts([]);

        try {
            const parts = streamKey.split('/');
            const cleanKey = parts[parts.length - 1].trim();
            const resp = await api.detectRtmp(cleanKey, sceneContext, cameraId);

            setJobId(resp.job_id);
            setStatus(resp.status);
        } catch (err: any) {
            console.error("Detection Error (RTMP):", err);
            if (err.response?.data?.detail) {
                const detail = err.response.data.detail;
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


    const handleStop = () => {
        setIsLoading(false);
        setStatus('stopped');

        if (sourceRef.current) {
            sourceRef.current.close();
            sourceRef.current = null;
        }

        if (jobId) {
            api.stopJob(jobId).catch(err => {
                console.error("Failed to stop job backend:", err);
            });
        }
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

                // x. Zone Alerts — replace instead of accumulating
                if (data.zone_alerts !== undefined) {
                    setZoneAlerts(data.zone_alerts.length > 0 ? data.zone_alerts : []);
                }

                // 3. LLM Analysis (every 8 frames or when backend sends it)
                if (data.analysis) {
                    setLlmAnalysis(data.analysis);
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
                                        <div className="text-[#64748B] truncate max-w-[200px] sm:max-w-[300px]">
                                            {cam.stream_protocol === 'RTMP'
                                                ? `RTMP: ${cam.stream_key}`
                                                : cam.rtsp_url}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 self-start sm:self-auto">
                                    <button
                                        type="button"
                                        onClick={() => setViewingCameraId(cam.id)}
                                        className="px-3 py-2 bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]/30 rounded hover:bg-[#06B6D4]/20 transition-colors flex items-center gap-2"
                                    >
                                        <Eye className="w-3 h-3" />
                                        VIEW
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (cam.stream_protocol === 'RTMP' && cam.stream_key) {
                                                startDetectionRtmp(cam.stream_key, cam.id);
                                            } else {
                                                startDetection(cam.rtsp_url, cam.id);
                                            }
                                        }}
                                        disabled={isLoading}
                                        className="px-4 py-2 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 rounded hover:bg-[#10B981]/20 disabled:opacity-50 transition-colors flex items-center gap-2"
                                    >
                                        <Play className="w-3 h-3" />
                                        EXECUTE
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Status Indicator */}
            {(status === 'running' || status === 'done' || status === 'stopped' || status === 'failed' || status === 'error') && (
                <div className="flex items-center gap-3 mb-8 bg-[#1E2548]/30 border border-[#1E2548] rounded px-3 py-1.5 self-start relative z-10 w-full sm:w-auto">
                    <div className="flex items-center gap-3">
                        <span className="text-[#64748B] font-mono text-[10px] uppercase tracking-widest pl-1 hidden sm:inline">SYS_STATUS //</span>
                        <span className={`text-[10px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded-sm ${status === 'running' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20'}`}>
                            [ {status === 'running' ? 'PROCESSING' : status} ]
                        </span>
                    </div>
                    {isLoading && (
                        <button
                            type="button"
                            onClick={handleStop}
                            className="bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-500/50 rounded px-4 py-1 ml-auto sm:ml-4 font-mono text-[10px] tracking-widest uppercase transition-all flex items-center gap-2"
                        >
                            <StopCircle className="w-3.5 h-3.5" />
                            ABORT
                        </button>
                    )}
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
                                            let analysisData = { risk_score: 0, risk_level: 'UNKNOWN', label: 'Analyzing...', explanation: '' };

                                            if (typeof llmAnalysis === 'string') {
                                                // Handle partial JSON streams token-by-token
                                                const scoreMatch = llmAnalysis.match(/"risk_score"\s*:\s*(\d+)/);
                                                if (scoreMatch) analysisData.risk_score = parseInt(scoreMatch[1]);

                                                const levelMatch = llmAnalysis.match(/"risk_level"\s*:\s*"([^"]+)"/);
                                                if (levelMatch) analysisData.risk_level = levelMatch[1].toUpperCase();

                                                const labelMatch = llmAnalysis.match(/"label"\s*:\s*"([^"]+)"/);
                                                if (labelMatch) analysisData.label = labelMatch[1];

                                                const explMatch = llmAnalysis.match(/"explanation"\s*:\s*"([^"]+)"/);
                                                if (explMatch) analysisData.explanation = explMatch[1];
                                            } else if (llmAnalysis && typeof llmAnalysis === 'object') {
                                                analysisData = { ...analysisData, ...llmAnalysis };
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
                                    {/* ZONE ALERT — single banner */}
                                    <AnimatePresence>
                                        {zoneAlerts.length > 0 && (
                                            <motion.div 
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-[8px] px-5 py-3 font-mono text-[11px] mb-4 flex items-center gap-3 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                                            >
                                                <AlertCircle className="w-4 h-4 text-[#EF4444] animate-pulse flex-shrink-0" />
                                                <span className="text-[#FCA5A5] flex-1">{zoneAlerts[0].message}</span>
                                                <span className="text-[#EF4444]/40 text-[9px] flex-shrink-0">FRAME_{zoneAlerts[0].frame}</span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <button 
                                        onClick={() => setIsLogicExpanded(!isLogicExpanded)}
                                        className="w-full flex items-center justify-between mb-4 group focus:outline-none"
                                    >
                                        <h3 className="text-[14px] font-bold tracking-widest flex items-center gap-2 text-white uppercase transition-colors group-hover:text-cyan-400">
                                            <ShieldAlert className="w-4 h-4" />
                                            LOGIC ENGINE ANALYSIS
                                        </h3>
                                        <div className="p-1 rounded bg-[#10B981]/10 border border-[#10B981]/20 group-hover:bg-[#10B981]/20 transition-colors">
                                            {isLogicExpanded ? <ChevronUp className="w-4 h-4 text-[#10B981]" /> : <ChevronDown className="w-4 h-4 text-[#10B981]" />}
                                        </div>
                                    </button>

                                    <AnimatePresence>
                                        {isLogicExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="bg-[#0A0D2A]/40 border border-[#1E2548] rounded-[8px] p-5 font-mono text-[10px] relative shadow-inner mb-6">
                                                    <div className="text-[#06B6D4] font-bold mb-3 tracking-widest">[ SYS.LOGIC_SUMMARY ]</div>
                                                    <div className="text-neutral-500 mb-2">&gt;</div>
                                                    <div className="text-[#94A3B8] leading-relaxed pt-2">
                                                        {logicData.summary_text ? renderParsedSummary(logicData.summary_text) : null}

                                                        {logicData.scene_text && logicData.scene_text !== logicData.summary_text && (
                                                            <div className={logicData.summary_text ? "mt-4 pt-4 border-t border-[#1E2548]/50" : ""}>
                                                                {(() => {
                                                                    const isParsed = logicData.scene_text.includes('EVENTS:') || logicData.scene_text.includes('TIMELINE');
                                                                    if (isParsed) {
                                                                        return renderParsedSummary(logicData.scene_text);
                                                                    } else {
                                                                        return (
                                                                            <div className="text-[#64748B]">
                                                                                <span className="text-[#06B6D4] font-bold mb-1 block">SCENE_CONTEXT:</span>
                                                                                {logicData.scene_text}
                                                                            </div>
                                                                        );
                                                                    }
                                                                })()}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
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
                                            &gt; {typeof llmAnalysis === 'string' ? (
                                                <ReactMarkdown
                                                    components={{
                                                        strong: ({ node, ...props }) => <span className="text-cyan-300 font-bold" {...props} />,
                                                        em: ({ node, ...props }) => <span className="text-emerald-400 font-bold" {...props} />,
                                                        p: ({ node, ...props }) => <span {...props} />,
                                                    }}
                                                >
                                                    {llmAnalysis}
                                                </ReactMarkdown>
                                            ) : (
                                                <span className="text-cyan-100">{llmAnalysis.explanation || llmAnalysis.label || "Monitoring situation..."}</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Critical Events Grid */}
                                {(logicData?.armed_subjects?.length > 0 || logicData?.fighting_pairs?.length > 0) && (
                                    <div className="bg-[#1a0f14] rounded-sm p-4 border border-red-500/40 shadow-[inset_0_0_15px_rgba(239,68,68,0.1)] mb-4">
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
                            </div>
                        )}

                        {/* Bottom Side-by-Side Grid: Batch Log & Tracked Entities */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Detailed Batch Processing Log (Left/Main, Col-Span 2) */}
                            <div className="lg:col-span-2 flex flex-col h-full">
                                {currentBatch.length > 0 ? (
                                    <div className="bg-[#0A0D2A]/40 rounded-[8px] border border-[#1E2548] shadow-inner overflow-hidden flex flex-col flex-1 max-h-[300px]">
                                        <div className="border-b border-[#1E2548] px-5 py-4 flex items-center justify-between shrink-0 bg-[#060818]/60">
                                            <h3 className="text-[#94A3B8] font-bold text-[11px] tracking-widest flex items-center gap-2 uppercase">
                                                <span className="text-neutral-500">&gt;_</span> PROCESSING BATCH LOG
                                            </h3>
                                            <span className="text-[10px] font-mono text-[#64748B] bg-[#1E2548]/50 px-2 py-0.5 rounded-sm tracking-widest uppercase">
                                                BUFFER: {currentBatch.length}
                                            </span>
                                        </div>

                                        <div className="p-4 space-y-2 flex-1 overflow-y-auto custom-scrollbar">
                                            {currentBatch.map((frame, i) => (
                                                <div key={i} className="flex gap-4 pb-2 font-mono text-[9px] uppercase leading-relaxed border-b border-[#1E2548]/30 last:border-0 last:pb-0">
                                                    <span className="text-[#64748B] shrink-0 select-none bg-black/40 px-1 rounded h-max py-0.5">
                                                        [{String(frame.frame_index).padStart(5, '0')}]
                                                    </span>
                                                    <span className="text-[#10B981] break-words flex-1">
                                                        {frame.scene_text || `NO_METADATA_EXTRACTED_FOR_FRAME`}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-[#0A0D2A]/40 rounded-[8px] border border-[#1E2548] flex items-center justify-center flex-1 min-h-[150px] text-[#64748B] text-xs font-mono tracking-widest uppercase">
                                        INITIALIZING CAMERA BATCHES...
                                    </div>
                                )}
                            </div>

                            {/* Tracked Entities (Right, Col-Span 1) */}
                            <div className="lg:col-span-1 flex flex-col h-full">
                                {((logicData?.objects?.length ?? 0) > 0) ? (
                                    <div className="bg-[#0A0D2A]/40 rounded-[8px] border border-[#1E2548] shadow-inner flex flex-col flex-1 max-h-[300px]">
                                        <div className="px-4 py-4 shrink-0 border-b border-[#1E2548] bg-[#060818]/60 flex justify-between items-center">
                                            <div className="flex items-center gap-2 text-white font-bold text-[10px] tracking-widest uppercase">
                                                <Users className="w-3.5 h-3.5 text-[#A855F7]" /> [ ENTITIES ]
                                            </div>
                                            <span className="text-white bg-[#A855F7]/40 px-2 py-0.5 text-[9px] rounded-sm font-mono tracking-widest uppercase shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                                                {logicData?.objects?.length || 0} TRACKED
                                            </span>
                                        </div>

                                        {/* Tabular Header */}
                                        <div className="grid grid-cols-12 text-[8px] font-bold text-neutral-500 uppercase px-3 pt-3 pb-2 shrink-0 tracking-widest border-b border-[#1E2548]/50">
                                            <div className="col-span-6">ID(ZONE)</div>
                                            <div className="col-span-3 text-center">VEL</div>
                                            <div className="col-span-3 text-right">DWELL</div>
                                        </div>

                                        <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar px-3 py-2">
                                            {(logicData?.objects || []).map((obj: any) => (
                                                <div key={obj.track_id} className="grid grid-cols-12 text-[10px] font-mono items-center transition-all group/row font-semibold bg-[#121738]/30 hover:bg-[#121738]/60 p-1.5 rounded border border-[#1E2548]/30">
                                                    <div className="col-span-6 flex items-center gap-1.5 tracking-wider truncate pr-1">
                                                        <span className="text-white">#{obj.track_id}</span>
                                                        <span className="text-[#64748B] text-[8px] truncate">({obj.zone || '-'})</span>
                                                    </div>
                                                    <div className="col-span-3 text-[#06B6D4] text-center">
                                                        {obj.speed.toFixed(1)}
                                                    </div>
                                                    <div className="col-span-3 text-right text-[#EAB308]">
                                                        {obj.loiter_seconds}s
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-[#0A0D2A]/40 rounded-[8px] border border-[#1E2548] flex items-center justify-center flex-1 min-h-[150px] text-[#64748B] text-[10px] text-center px-4 font-mono tracking-widest uppercase">
                                        NO ACTIVE TRACKED ENTITIES
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Live Camera Feed Modal / PiP */}
            {createPortal(
                <AnimatePresence>
                    {viewingCameraId && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-12 pointer-events-none">
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-[2px] pointer-events-auto cursor-pointer"
                            onClick={() => setViewingCameraId(null)}
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="relative w-full h-full max-w-[1500px] max-h-[900px] z-[101] bg-[#0A0D2A]/95 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col rounded-xl border border-[#1E2548] pointer-events-auto overflow-hidden border-cyan-500/50"
                            onClick={(e) => e.stopPropagation()}
                        >
                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-500 to-[#10B981] z-50 pointer-events-none" />

                        {/* Header */}
                        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-[#1E2548] bg-[#060818]/90 z-40 relative shadow-md gap-3">
                            <h3 className="text-white font-mono font-bold tracking-widest flex items-center gap-2 text-[12px]">
                                <Video className="w-4 h-4 text-cyan-400 animate-pulse" />
                                [ CAM_{viewingCameraId.substring(0, 4)} ] - REGION OF INTEREST (ROI) ZONE CONFIG
                            </h3>
                            
                            <div className="flex items-center gap-3 self-end sm:self-auto">
                                {!isDrawingZone ? (
                                    <button
                                        onClick={() => { setIsDrawingZone(true); setCurrentZonePoints([]); }}
                                        className="text-amber-400 px-4 py-2 rounded flex items-center gap-2 font-mono text-[11px] font-bold tracking-widest uppercase transition-all bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20"
                                    >
                                        DRAW NEW ZONE
                                    </button>
                                ) : (
                                    <>
                                        <span className="text-cyan-400 font-mono text-[10px] tracking-wider hidden sm:inline">
                                            {currentZonePoints.length} PTS
                                        </span>
                                        <button
                                            onClick={handleUndoPoint}
                                            disabled={currentZonePoints.length === 0}
                                            className="text-amber-400 px-3 py-2 rounded flex items-center gap-2 font-mono text-[11px] font-bold tracking-widest uppercase transition-all bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 disabled:opacity-30"
                                        >
                                            UNDO
                                        </button>
                                        <button
                                            onClick={() => { setIsDrawingZone(false); setCurrentZonePoints([]); setMousePos(null); }}
                                            className="text-neutral-400 px-3 py-2 rounded flex items-center gap-2 font-mono text-[11px] font-bold tracking-widest uppercase transition-all bg-neutral-500/10 border border-neutral-500/30 hover:bg-neutral-500/20"
                                        >
                                            CANCEL
                                        </button>
                                        <button
                                            onClick={handleSaveZone}
                                            disabled={isSavingZone || currentZonePoints.length < 3}
                                            className="text-emerald-400 px-3 py-2 rounded flex items-center gap-2 font-mono text-[11px] font-bold tracking-widest uppercase transition-all bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-30"
                                        >
                                            SAVE ZONE ({currentZonePoints.length} PTS)
                                        </button>
                                    </>
                                )}
                                <div className="w-px h-6 bg-[#1E2548]" />
                                <button
                                    onClick={() => toggleSkeleton(viewingCameraId!)}
                                    className={`px-3 py-2 rounded flex items-center gap-2 font-mono text-[11px] font-bold tracking-widest uppercase transition-all border ${
                                        skeletonActive
                                            ? 'bg-purple-500/20 text-purple-400 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                                            : 'bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]/30 hover:bg-[#A855F7]/20'
                                    }`}
                                >
                                    {skeletonActive ? 'SKELETON ON' : 'SKELETON'}
                                </button>
                                <div className="w-px h-6 bg-[#1E2548]" />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setViewingCameraId(null);
                                    }}
                                    className="text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-4 py-2 rounded flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-widest uppercase transition-all border border-red-500/20"
                                    title="Close Feed"
                                >
                                    <span className="hidden sm:inline">CLOSE</span>
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Video / SVG Container */}
                        <div className="flex-1 bg-black/95 relative flex items-center justify-center overflow-hidden w-full h-full p-4 sm:p-8">
                            {/* Inner flex box bounded by parent padding */}
                            <div className="relative w-full h-full max-w-full max-h-full flex items-center justify-center bg-[#050505] border border-[#1E2548] shadow-2xl rounded overflow-hidden">
                                <img
                                    ref={streamImgRef}
                                    src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/cameras/${viewingCameraId}/live?token=${localStorage.getItem('access_token')}`}
                                    alt="Live Camera Feed"
                                    className="absolute inset-0 w-full h-full object-contain select-none shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                                    onLoad={(e) => {
                                        const t = e.currentTarget;
                                        setVideoNatRes(prev => 
                                            (prev.w === (t.naturalWidth || 1920) && prev.h === (t.naturalHeight || 1080)) 
                                                ? prev 
                                                : {w: t.naturalWidth || 1920, h: t.naturalHeight || 1080}
                                        );
                                    }}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        (e.target as HTMLImageElement).nextElementSibling?.nextElementSibling?.classList.remove('hidden');
                                    }}
                                />
                                
                                {/* SVG Interactive Overlay */}
                                <svg
                                    ref={streamSvgRef}
                                    preserveAspectRatio="xMidYMid meet"
                                    viewBox={`0 0 ${videoNatRes.w} ${videoNatRes.h}`}
                                    className={`absolute inset-0 w-full h-full z-30 transition-colors ${
                                        isDrawingZone ? 'cursor-crosshair' : 'pointer-events-none'
                                    }`}
                                    onClick={isDrawingZone ? handleSvgClick : undefined}
                                    onMouseMove={isDrawingZone ? handleSvgMouseMove : undefined}
                                    onMouseLeave={() => setMousePos(null)}
                                    onContextMenu={handleSvgRightClick}
                                >
                                    {/* Existing Saved Zones */}
                                    {zones.map(z => (
                                        <g key={z.id} className="group pointer-events-auto">
                                            <polygon
                                                points={z.points.map(p => `${p.x},${p.y}`).join(' ')}
                                                fill={`${z.color}30`}
                                                stroke={z.color}
                                                strokeWidth="3"
                                                className="transition-all duration-300 group-hover:fill-opacity-60 cursor-pointer"
                                            />
                                            <text
                                                x={z.points.reduce((s, p) => s + p.x, 0) / z.points.length}
                                                y={z.points.reduce((s, p) => s + p.y, 0) / z.points.length}
                                                fill="white"
                                                fontSize="18"
                                                fontWeight="bold"
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                fontFamily="monospace"
                                                className="pointer-events-none select-none"
                                                style={{ textShadow: '0 0 8px rgba(0,0,0,0.9)' }}
                                            >
                                                {z.name}
                                            </text>
                                            {z.points[0] && !isDrawingZone && (
                                                <g
                                                    transform={`translate(${z.points[0].x}, ${z.points[0].y - 30})`}
                                                    onClick={(e) => handleDeleteZone(z.id!, e as any)}
                                                    className="cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <rect x="-40" y="-15" width="80" height="30" rx="4" fill="#ef4444" />
                                                    <text x="0" y="0" fill="white" fontSize="14" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" fontFamily="monospace">DELETE</text>
                                                </g>
                                            )}
                                        </g>
                                    ))}

                                    {/* Skeleton overlay */}
                                    {skeletonData?.persons.map(person => (
                                        <g key={`skel-${person.track_id}`}>
                                            {SKELETON_EDGES.map(([from, to, color], ei) => {
                                                const a = person.keypoints[from];
                                                const b = person.keypoints[to];
                                                if (!a || !b || a.conf < MIN_CONF || b.conf < MIN_CONF) return null;
                                                return (
                                                    <line
                                                        key={`e-${person.track_id}-${ei}`}
                                                        x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                                                        stroke={color} strokeWidth="4" strokeLinecap="round"
                                                        opacity="0.85" className="pointer-events-none"
                                                    />
                                                );
                                            })}
                                            {person.keypoints.map((kp, ki) => {
                                                if (kp.conf < MIN_CONF) return null;
                                                return (
                                                    <circle
                                                        key={`j-${person.track_id}-${ki}`}
                                                        cx={kp.x} cy={kp.y} r="5"
                                                        fill="white" stroke="rgba(0,0,0,0.5)" strokeWidth="1.5"
                                                        className="pointer-events-none"
                                                    />
                                                );
                                            })}
                                        </g>
                                    ))}

                                    {/* Drawing: Ghost polygon preview (points + mouse) */}
                                    {isDrawingZone && currentZonePoints.length > 0 && (
                                        <>
                                            {(() => {
                                                const previewPts = mousePos
                                                    ? [...currentZonePoints, mousePos]
                                                    : currentZonePoints;
                                                return previewPts.length >= 2 ? (
                                                    <polygon
                                                        points={previewPts.map(p => `${p.x},${p.y}`).join(' ')}
                                                        fill="rgba(239, 68, 68, 0.15)"
                                                        stroke="#ef4444"
                                                        strokeWidth="2.5"
                                                        strokeDasharray="12 6"
                                                        className="pointer-events-none"
                                                    />
                                                ) : null;
                                            })()}
                                            {/* Solid lines between placed points */}
                                            {currentZonePoints.length >= 2 && currentZonePoints.map((p, i) => {
                                                if (i === 0) return null;
                                                const prev = currentZonePoints[i - 1];
                                                return (
                                                    <line
                                                        key={`edge-${i}`}
                                                        x1={prev.x} y1={prev.y}
                                                        x2={p.x} y2={p.y}
                                                        stroke="#ef4444"
                                                        strokeWidth="3"
                                                        className="pointer-events-none"
                                                    />
                                                );
                                            })}
                                            {/* Rubber-band line from last point to cursor */}
                                            {mousePos && currentZonePoints.length > 0 && (
                                                <line
                                                    x1={currentZonePoints[currentZonePoints.length - 1].x}
                                                    y1={currentZonePoints[currentZonePoints.length - 1].y}
                                                    x2={mousePos.x}
                                                    y2={mousePos.y}
                                                    stroke="#ef4444"
                                                    strokeWidth="2"
                                                    strokeDasharray="8 4"
                                                    opacity="0.7"
                                                    className="pointer-events-none"
                                                />
                                            )}
                                            {/* Closing line preview (last point to first, dashed) */}
                                            {currentZonePoints.length >= 3 && (
                                                <line
                                                    x1={currentZonePoints[currentZonePoints.length - 1].x}
                                                    y1={currentZonePoints[currentZonePoints.length - 1].y}
                                                    x2={currentZonePoints[0].x}
                                                    y2={currentZonePoints[0].y}
                                                    stroke="#ef4444"
                                                    strokeWidth="1.5"
                                                    strokeDasharray="4 4"
                                                    opacity="0.3"
                                                    className="pointer-events-none"
                                                />
                                            )}
                                            {/* Vertex circles with numbers */}
                                            {currentZonePoints.map((p, i) => (
                                                <g key={`v-${i}`} className="pointer-events-none">
                                                    <circle cx={p.x} cy={p.y} r="12" fill="#ef4444" stroke="white" strokeWidth="3" />
                                                    <text x={p.x} y={p.y} fill="white" fontSize="12" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" fontFamily="monospace">
                                                        {i + 1}
                                                    </text>
                                                </g>
                                            ))}
                                            {/* Snap-to-close indicator on first point */}
                                            {currentZonePoints.length >= 3 && mousePos && (() => {
                                                const first = currentZonePoints[0];
                                                const dist = Math.hypot(mousePos.x - first.x, mousePos.y - first.y);
                                                const snapRadius = Math.max(videoNatRes.w, videoNatRes.h) * 0.02;
                                                if (dist < snapRadius) {
                                                    return (
                                                        <circle
                                                            cx={first.x} cy={first.y} r="20"
                                                            fill="rgba(16, 185, 129, 0.4)"
                                                            stroke="#10B981"
                                                            strokeWidth="3"
                                                            className="pointer-events-none animate-pulse"
                                                        />
                                                    );
                                                }
                                                return null;
                                            })()}
                                            {/* Cursor crosshair + coords */}
                                            {mousePos && (
                                                <g className="pointer-events-none">
                                                    <line x1={mousePos.x - 15} y1={mousePos.y} x2={mousePos.x + 15} y2={mousePos.y} stroke="white" strokeWidth="1" opacity="0.5" />
                                                    <line x1={mousePos.x} y1={mousePos.y - 15} x2={mousePos.x} y2={mousePos.y + 15} stroke="white" strokeWidth="1" opacity="0.5" />
                                                    <rect x={mousePos.x + 18} y={mousePos.y - 14} width="110" height="24" rx="3" fill="rgba(0,0,0,0.8)" />
                                                    <text x={mousePos.x + 24} y={mousePos.y + 1} fill="#06B6D4" fontSize="13" fontFamily="monospace" className="select-none">
                                                        {mousePos.x}, {mousePos.y}
                                                    </text>
                                                </g>
                                            )}
                                        </>
                                    )}
                                    {/* Drawing mode: initial crosshair when no points yet */}
                                    {isDrawingZone && currentZonePoints.length === 0 && mousePos && (
                                        <g className="pointer-events-none">
                                            <line x1={mousePos.x - 20} y1={mousePos.y} x2={mousePos.x + 20} y2={mousePos.y} stroke="#ef4444" strokeWidth="1.5" opacity="0.6" />
                                            <line x1={mousePos.x} y1={mousePos.y - 20} x2={mousePos.x} y2={mousePos.y + 20} stroke="#ef4444" strokeWidth="1.5" opacity="0.6" />
                                            <circle cx={mousePos.x} cy={mousePos.y} r="6" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.6" />
                                            <rect x={mousePos.x + 18} y={mousePos.y - 14} width="110" height="24" rx="3" fill="rgba(0,0,0,0.8)" />
                                            <text x={mousePos.x + 24} y={mousePos.y + 1} fill="#06B6D4" fontSize="13" fontFamily="monospace">{mousePos.x}, {mousePos.y}</text>
                                        </g>
                                    )}
                                </svg>

                                {/* Drawing instructions overlay */}
                                {isDrawingZone && (
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 bg-black/90 border border-cyan-500/30 rounded-lg px-5 py-2.5 font-mono text-[11px] text-cyan-300 tracking-wider flex items-center gap-4 shadow-[0_0_20px_rgba(0,0,0,0.8)] pointer-events-none select-none">
                                        <span>CLICK to place points</span>
                                        <span className="text-neutral-600">|</span>
                                        <span>RIGHT-CLICK to undo</span>
                                        <span className="text-neutral-600">|</span>
                                        <span className="text-emerald-400">{currentZonePoints.length >= 3 ? 'CLICK 1st point to close' : `${3 - currentZonePoints.length} more pts needed`}</span>
                                    </div>
                                )}

                                <div className="hidden absolute inset-0 flex flex-col items-center justify-center text-[#64748B] font-mono text-sm text-center px-4 z-20">
                                    <AlertCircle className="w-6 h-6 text-red-500/50 mb-2" />
                                    <span className="text-[12px]">CONNECTION FAILED OR STREAM OFFLINE</span>
                                </div>
                            </div>
                        </div>
                        </motion.div>
                    </div>
                )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}
