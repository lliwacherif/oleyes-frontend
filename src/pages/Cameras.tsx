import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { api } from '../api/client';
import type { CameraData } from '../api/types';
import { Video, Save, Loader2, AlertCircle, RefreshCw, Eye, EyeOff, Trash2, Copy, Check } from 'lucide-react';

export function Cameras() {
    const [cameras, setCameras] = useState<CameraData[]>([]);
    const [estimatedCount, setEstimatedCount] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError('');

            // Fetch user context for estimated camera count
            let contextCount = 0;
            try {
                const context = await api.getContext();
                if (context && context.estimated_cameras) {
                    const parsed = parseInt(context.estimated_cameras, 10);
                    if (!isNaN(parsed) && parsed > 0) {
                        contextCount = parsed;
                    }
                }
            } catch (err: any) {
                console.log("Could not fetch context or context not found:", err.message);
            }
            setEstimatedCount(contextCount);

            // Fetch saved cameras
            try {
                const fetchedCameras = await api.getCameras();
                setCameras(fetchedCameras || []);
            } catch (err: any) {
                console.log("Could not fetch cameras or endpoint not ready:", err.message);
                setCameras([]);
            }

        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to load camera data');
        } finally {
            setLoading(false);
        }
    };

    const displayCount = Math.max(cameras.length, estimatedCount, 1);

    // New decomposed state arrays
    const [connectionTypes, setConnectionTypes] = useState<{ [index: number]: 'RTSP' | 'RTMP' }>({});
    const [rtspIps, setRtspIps] = useState<{ [index: number]: string }>({});
    const [rtspPorts, setRtspPorts] = useState<{ [index: number]: string }>({});
    const [rtspUsers, setRtspUsers] = useState<{ [index: number]: string }>({});
    const [rtspPasses, setRtspPasses] = useState<{ [index: number]: string }>({});
    const [rtspPaths, setRtspPaths] = useState<{ [index: number]: string }>({});
    const [rtmpKeys, setRtmpKeys] = useState<{ [index: number]: string }>({});
    
    const [inputActive, setInputActive] = useState<{ [index: number]: boolean }>({});
    const [previewVisible, setPreviewVisible] = useState<{ [index: number]: boolean }>({});
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    useEffect(() => {
        const newTypes: { [index: number]: 'RTSP' | 'RTMP' } = {};
        const newIps: { [index: number]: string } = {};
        const newPorts: { [index: number]: string } = {};
        const newUsers: { [index: number]: string } = {};
        const newPasses: { [index: number]: string } = {};
        const newPaths: { [index: number]: string } = {};
        const newKeys: { [index: number]: string } = {};
        const newActive: { [index: number]: boolean } = {};

        cameras.forEach((cam, i) => {
            const url = cam.rtsp_url || '';
            newActive[i] = cam.is_active;

            if (cam.stream_protocol === 'RTMP') {
                newTypes[i] = 'RTMP';
                newKeys[i] = cam.stream_key || '';
            } else {
                newTypes[i] = 'RTSP';
                try {
                    const parsed = new URL(url);
                    newIps[i] = parsed.hostname;
                    newPorts[i] = parsed.port || '554';
                    newUsers[i] = decodeURIComponent(parsed.username);
                    newPasses[i] = decodeURIComponent(parsed.password);
                    newPaths[i] = parsed.pathname + parsed.search;
                } catch (e) {
                    const match = url.match(/rtsp:\/\/(?:([^:]+):([^@]+)@)?([^:/]+)(?::(\d+))?(\/.*)?/);
                    if (match) {
                        newUsers[i] = decodeURIComponent(match[1] || '');
                        newPasses[i] = decodeURIComponent(match[2] || '');
                        newIps[i] = match[3] || '';
                        newPorts[i] = match[4] || '554';
                        newPaths[i] = match[5] || '';
                    } else {
                        newIps[i] = url;
                    }
                }
            }
        });

        setConnectionTypes(newTypes);
        setRtspIps(newIps);
        setRtspPorts(newPorts);
        setRtspUsers(newUsers);
        setRtspPasses(newPasses);
        setRtspPaths(newPaths);
        setRtmpKeys(newKeys);
        setInputActive(newActive);
    }, [cameras]);

    const handleFieldChange = (setter: React.Dispatch<React.SetStateAction<any>>, index: number, value: any) => {
        setter((prev: any) => ({ ...prev, [index]: value }));
    };

    const togglePreview = (index: number) => {
        setPreviewVisible(prev => ({ ...prev, [index]: !prev[index] }));
    };

    const handleActiveToggle = async (index: number) => {
        const currentActive = !!inputActive[index];
        const newActive = !currentActive;
        setInputActive(prev => ({ ...prev, [index]: newActive }));

        // If it's an existing camera, auto-save the toggle
        const existingCam = cameras[index];
        if (existingCam) {
            await handleSave(index, newActive);
        }
    };

    const handleSave = async (index: number, forcedActiveState?: boolean) => {
        const type = connectionTypes[index] || 'RTSP';
        let urlToSave = '';
        let keyToSave: string | null = null;
        if (type === 'RTMP') {
            const rawKey = rtmpKeys[index] || '';
            if (!rawKey.trim()) return;
            const parts = rawKey.split('/');
            keyToSave = parts[parts.length - 1].trim();
        } else {
            const ip = (rtspIps[index] || '').trim();
            if (!ip) return;
            const port = (rtspPorts[index] || '554').trim();
            const user = (rtspUsers[index] || '').trim();
            const pass = (rtspPasses[index] || '').trim();
            let path = (rtspPaths[index] || '').trim();
            if (path && !path.startsWith('/')) path = '/' + path;
            const credentials = user && pass ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : '';
            urlToSave = `rtsp://${credentials}${ip}:${port}${path}`;
        }

        const activeToSave = forcedActiveState !== undefined ? forcedActiveState : !!inputActive[index];
        const existingCam = cameras[index];
        const camName = `Camera ${index + 1}`;

        if (type === 'RTSP' && !urlToSave.trim() && !existingCam) return;
        if (type === 'RTMP' && !keyToSave && !existingCam) return;

        try {
            setSaving(camName);
            let updatedCam: CameraData;

            if (existingCam) {
                // Update
                updatedCam = await api.updateCamera(existingCam.id, {
                    name: camName,
                    rtsp_url: urlToSave,
                    stream_protocol: type,
                    stream_key: keyToSave,
                    is_active: activeToSave
                });

                setCameras(prev => {
                    const next = [...prev];
                    next[index] = updatedCam;
                    return next;
                });
            } else {
                // Create
                updatedCam = await api.createCamera({
                    name: camName,
                    rtsp_url: urlToSave,
                    stream_protocol: type,
                    stream_key: keyToSave,
                    is_active: activeToSave
                });

                setCameras(prev => {
                    const next = [...prev];
                    next[index] = updatedCam;
                    return next;
                });
            }

        } catch (err: any) {
            console.error("Failed to save camera", err);
            // Revert active toggle on failure
            setInputActive(prev => ({ ...prev, [index]: !prev[index] }));
            alert(`Failed to save ${camName}. Please check if the backend is updated.`);
        } finally {
            setSaving(null);
        }
    };

    const handleDelete = async (index: number) => {
        const existingCam = cameras[index];
        if (!existingCam) return; // Cannot delete something not saved
        
        const confirmDelete = window.confirm(`Are you sure you want to delete ${existingCam.name}?`);
        if (!confirmDelete) return;

        try {
            setSaving(`Deleting Camera ${index + 1}`);
            await api.deleteCamera(existingCam.id);
            fetchData();
        } catch (err: any) {
            console.error("Failed to delete camera", err);
            alert(`Failed to delete camera. Please check if the backend is updated.`);
        } finally {
            setSaving(null);
        }
    };

    return (
        <Layout>
            <div className="w-full max-w-4xl mx-auto py-8">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-[#10B981]/20 border border-[#10B981]/30 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                        <Video className="w-8 h-8 text-[#10B981]" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-neutral-500 font-mono tracking-wider">
                            CAMERAS CONNECTIVITY
                        </h1>
                        <p className="text-sm font-mono tracking-widest text-[#10B981] uppercase mt-1">
                            [{displayCount} STREAM SLOTS CONFIGURED]
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-900/40 border border-red-500/50 rounded-xl flex items-center gap-3 backdrop-blur-sm shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                        <span className="text-red-200 font-medium text-sm">{error}</span>
                    </div>
                )}

                <div className="bg-white/60 dark:bg-[#0A0D2A]/60 rounded-2xl border border-slate-200 dark:border-[#1E2548] backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
                    <div className="p-6 border-b border-slate-200 dark:border-[#1E2548] flex justify-between items-center bg-gradient-to-r from-[#10B981]/5 to-transparent">
                        <h2 className="text-neutral-900 dark:text-white font-mono font-bold tracking-widest text-sm flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 text-[#10B981]" />
                            RTSP STREAM CONFIGURATION
                        </h2>
                        {loading && <Loader2 className="w-5 h-5 text-[#10B981] animate-spin" />}
                    </div>

                    <div className="p-6 space-y-4">
                        {loading && cameras.length === 0 ? (
                            <div className="text-center py-12 text-slate-500 dark:text-[#64748B] font-mono text-sm tracking-widest animate-pulse">
                                INITIALIZING CAMERA MATRIX...
                            </div>
                        ) : (
                            Array.from({ length: displayCount }).map((_, i) => {
                                const cam = cameras[i];
                                const isActive = !!inputActive[i];
                                const isSaving = saving === `Camera ${i + 1}`;

                                return (
                                    <div key={cam?.id || `new-${i}`} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl bg-slate-50/80 dark:bg-[#060818]/80 border border-slate-200 dark:border-[#1E2548] hover:border-[#10B981]/30 transition-colors group">
                                        <div className="w-full sm:w-32 shrink-0">
                                            <span className="text-xs font-mono tracking-widest font-bold text-slate-600 dark:text-[#94A3B8] uppercase group-hover:text-neutral-900 dark:text-white transition-colors">
                                                CAMERA {String(i + 1).padStart(2, '0')}
                                            </span>
                                        </div>

                                        <div className="flex-1 w-full flex flex-col gap-3 relative">
                                            {/* Protocol Toggle */}
                                            <div className="flex bg-slate-100 dark:bg-[#121738] rounded-lg p-1 w-max border border-slate-200 dark:border-[#1E2548]">
                                                {(['RTSP', 'RTMP'] as const).map(type => (
                                                    <button
                                                        key={type}
                                                        onClick={() => handleFieldChange(setConnectionTypes, i, type)}
                                                        className={`px-4 py-1.5 text-xs font-mono font-bold tracking-widest rounded transition-all ${
                                                            (connectionTypes[i] || 'RTSP') === type
                                                                ? 'bg-[#10B981]/20 text-[#10B981] shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                                                : 'text-slate-500 dark:text-[#64748B] hover:text-slate-600 dark:text-[#94A3B8]'
                                                        }`}
                                                    >
                                                        {type}
                                                    </button>
                                                ))}
                                            </div>

                                            {(connectionTypes[i] || 'RTSP') === 'RTSP' ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-100/50 dark:bg-[#121738]/50 p-3 rounded-lg border border-slate-200 dark:border-[#1E2548]">
                                                    <input
                                                        type="text" placeholder="IP Address (e.g. 192.168.1.100)"
                                                        value={rtspIps[i] || ''} onChange={e => handleFieldChange(setRtspIps, i, e.target.value)}
                                                        className="bg-white dark:bg-[#0A0D2A] border border-slate-200 dark:border-[#1E2548] focus:border-[#10B981]/50 rounded-md px-3 py-2 text-xs font-mono text-slate-800 dark:text-[#E2E8F0] placeholder-[#475569] outline-none"
                                                    />
                                                    <input
                                                        type="text" placeholder="Port (e.g. 554)"
                                                        value={rtspPorts[i] || ''} onChange={e => handleFieldChange(setRtspPorts, i, e.target.value)}
                                                        className="bg-white dark:bg-[#0A0D2A] border border-slate-200 dark:border-[#1E2548] focus:border-[#10B981]/50 rounded-md px-3 py-2 text-xs font-mono text-slate-800 dark:text-[#E2E8F0] placeholder-[#475569] outline-none"
                                                    />
                                                    <input
                                                        type="text" placeholder="Username (Optional)"
                                                        value={rtspUsers[i] || ''} onChange={e => handleFieldChange(setRtspUsers, i, e.target.value)}
                                                        className="bg-white dark:bg-[#0A0D2A] border border-slate-200 dark:border-[#1E2548] focus:border-[#10B981]/50 rounded-md px-3 py-2 text-xs font-mono text-slate-800 dark:text-[#E2E8F0] placeholder-[#475569] outline-none"
                                                    />
                                                    <input
                                                        type="password" placeholder="Password (Optional)"
                                                        value={rtspPasses[i] || ''} onChange={e => handleFieldChange(setRtspPasses, i, e.target.value)}
                                                        className="bg-white dark:bg-[#0A0D2A] border border-slate-200 dark:border-[#1E2548] focus:border-[#10B981]/50 rounded-md px-3 py-2 text-xs font-mono text-slate-800 dark:text-[#E2E8F0] placeholder-[#475569] outline-none"
                                                        autoComplete="new-password"
                                                    />
                                                    <input
                                                        type="text" placeholder="Stream Path (e.g. /cam/realmonitor?channel=1&subtype=0)"
                                                        value={rtspPaths[i] || ''} onChange={e => handleFieldChange(setRtspPaths, i, e.target.value)}
                                                        className="bg-white dark:bg-[#0A0D2A] border border-slate-200 dark:border-[#1E2548] focus:border-[#10B981]/50 rounded-md px-3 py-2 text-xs font-mono text-slate-800 dark:text-[#E2E8F0] placeholder-[#475569] outline-none sm:col-span-2 lg:col-span-4"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex bg-slate-100/50 dark:bg-[#121738]/50 p-3 rounded-lg border border-slate-200 dark:border-[#1E2548]">
                                                        <input
                                                            type="text" placeholder="Stream Key (e.g. cam1)"
                                                            value={rtmpKeys[i] || ''} onChange={e => handleFieldChange(setRtmpKeys, i, e.target.value)}
                                                            className="flex-1 bg-white dark:bg-[#0A0D2A] border border-slate-200 dark:border-[#1E2548] focus:border-[#10B981]/50 rounded-md px-3 py-2 text-[10px] sm:text-xs font-mono text-slate-800 dark:text-[#E2E8F0] placeholder-[#475569] outline-none"
                                                        />
                                                    </div>
                                                    
                                                    {/* Instruction Box */}
                                                    <div className="bg-[#10B981]/5 border border-[#10B981]/20 rounded-lg p-3 relative group/copy">
                                                        <p className="text-slate-600 dark:text-[#94A3B8] text-[11px] mb-2 font-mono">
                                                            Enter this Custom URL into your camera's RTMP settings:
                                                        </p>
                                                        <div className="flex items-center gap-2">
                                                            <code className="flex-1 bg-slate-200 dark:bg-black/40 text-[#10B981] p-2 rounded text-[10px] sm:text-xs font-mono break-all selection:bg-[#10B981]/30">
                                                                rtmp://{import.meta.env.VITE_RTMP_SERVER_IP || 'localhost'}:1935/live/{(rtmpKeys[i] || 'cam1').trim()}
                                                            </code>
                                                            <button 
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(`rtmp://${import.meta.env.VITE_RTMP_SERVER_IP || window.location.hostname}:1935/live/${(rtmpKeys[i] || 'cam1').trim()}`);
                                                                    setCopiedIndex(i);
                                                                    setTimeout(() => setCopiedIndex(null), 2000);
                                                                }}
                                                                className="shrink-0 p-2 bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20 rounded transition-colors"
                                                                title="Copy URL"
                                                            >
                                                                {copiedIndex === i ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Save Button */}
                                            <div className="flex justify-end mt-1">
                                                <button
                                                    onClick={() => handleSave(i)}
                                                    disabled={isSaving || (!cam && ((connectionTypes[i] || 'RTSP') === 'RTMP' ? !(rtmpKeys[i] || '').trim() : !(rtspIps[i] || '').trim()))}
                                                    className="px-4 py-2 rounded-md bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] hover:bg-[#10B981]/20 disabled:opacity-50 disabled:hover:bg-[#10B981]/10 transition-colors flex items-center justify-center gap-2 font-mono text-[10px] font-bold tracking-widest uppercase"
                                                    title="Save Config"
                                                >
                                                    {isSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> SAVING...</> : <><Save className="w-3.5 h-3.5" /> SAVE CONFIG</>}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="w-full sm:w-auto shrink-0 flex items-center justify-between sm:justify-start gap-3">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleActiveToggle(i)}
                                                    disabled={!cam && ((connectionTypes[i] || 'RTSP') === 'RTMP' ? !(rtmpKeys[i] || '').trim() : !(rtspIps[i] || '').trim())}
                                                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none border border-slate-200 dark:border-[#1E2548] shadow-inner ${isActive ? 'bg-[#10B981]/20' : 'bg-slate-100 dark:bg-[#121738] disabled:opacity-50'}`}
                                                >
                                                    <span className={`inline-block h-5 w-5 transform rounded-full transition-transform ${isActive ? 'translate-x-8 bg-[#10B981] shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'translate-x-1 bg-[#64748B]'}`} />
                                                </button>

                                                <div className="w-16 text-center">
                                                    <span className={`text-[10px] font-mono tracking-widest font-bold uppercase ${isActive ? 'text-[#10B981]' : 'text-slate-500 dark:text-[#64748B]'}`}>
                                                        {isActive ? 'ACTIVE' : 'OFFLINE'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Preview Toggle Button */}
                                            {cam && (
                                                <button
                                                    onClick={() => togglePreview(i)}
                                                    className={`p-1.5 rounded-md border transition-colors flex items-center justify-center ${previewVisible[i] ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'bg-slate-200/50 dark:bg-[#1E2548]/50 border-slate-200 dark:border-[#1E2548] text-slate-600 dark:text-[#94A3B8] hover:text-neutral-900 dark:text-white hover:bg-slate-200 dark:bg-[#1E2548]'}`}
                                                    title={previewVisible[i] ? "Hide Preview" : "Show Preview"}
                                                >
                                                    {previewVisible[i] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            )}

                                            {/* Delete Button */}
                                            {cam && (
                                                <button
                                                    onClick={() => handleDelete(i)}
                                                    disabled={isSaving}
                                                    className="p-1.5 rounded-md border border-red-900/50 bg-red-900/10 text-red-500/70 hover:text-red-400 hover:bg-red-900/30 transition-colors flex items-center justify-center disabled:opacity-50"
                                                    title="Delete Camera"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                        
                                        {/* Collapsible Preview Box */}
                                        {cam && previewVisible[i] && (
                                            <div className="w-full mt-4 bg-white dark:bg-black rounded-lg border border-slate-200 dark:border-[#1E2548] overflow-hidden aspect-video relative flex items-center justify-center">
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 dark:text-[#64748B] font-mono text-sm">
                                                    <AlertCircle className="w-6 h-6 mb-2 opacity-50" />
                                                    <span className="text-[10px] opacity-50">NO SIGNAL / CONNECTING...</span>
                                                </div>
                                                <img
                                                    src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/cameras/${cam.id}/live?token=${localStorage.getItem('access_token')}`}
                                                    alt={`Preview ${cam.name}`}
                                                    className="w-full h-full object-contain relative z-10"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                    }}
                                                    onLoad={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'block';
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="mt-8 p-5 bg-white/40 dark:bg-[#0A0D2A]/40 border border-slate-200/80 dark:border-[#1E2548]/80 rounded-2xl backdrop-blur-md shadow-inner">
                    <h3 className="text-slate-600 dark:text-[#94A3B8] font-mono text-xs font-bold tracking-widest uppercase mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.8)]" />
                        Common RTSP Formats Reference
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
                        <div className="p-3 bg-slate-50/50 dark:bg-[#060818]/50 border border-slate-200/50 dark:border-[#1E2548]/50 rounded text-slate-600 dark:text-[#CBD5E1]">
                            <span className="text-cyan-400 font-bold block mb-1">HIKVISION</span>
                            rtsp://admin:pass@IP:554/Streaming/Channels/101
                        </div>
                        <div className="p-3 bg-slate-50/50 dark:bg-[#060818]/50 border border-slate-200/50 dark:border-[#1E2548]/50 rounded text-slate-600 dark:text-[#CBD5E1]">
                            <span className="text-cyan-400 font-bold block mb-1">DAHUA</span>
                            rtsp://admin:pass@IP:554/cam/realmonitor?channel=1&amp;subtype=0
                        </div>
                        <div className="p-3 bg-slate-50/50 dark:bg-[#060818]/50 border border-slate-200/50 dark:border-[#1E2548]/50 rounded text-slate-600 dark:text-[#CBD5E1]">
                            <span className="text-cyan-400 font-bold block mb-1">TP-LINK TAPO</span>
                            rtsp://admin:pass@IP:554/stream1
                        </div>
                        <div className="p-3 bg-slate-50/50 dark:bg-[#060818]/50 border border-slate-200/50 dark:border-[#1E2548]/50 rounded text-slate-600 dark:text-[#CBD5E1]">
                            <span className="text-cyan-400 font-bold block mb-1">GENERIC / ONVIF</span>
                            rtsp://IP:554/live/ch0
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
