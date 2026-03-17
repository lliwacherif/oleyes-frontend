import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { api } from '../api/client';
import type { CameraData } from '../api/types';
import { Video, Save, Loader2, AlertCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';

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
                // We don't fail the whole page if backend isn't ready
                setCameras([]);
            }

        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to load camera data');
        } finally {
            setLoading(false);
        }
    };

    // Prepare the list of camera rows based on max of (fetched cameras, estimated count)
    const displayCount = Math.max(cameras.length, estimatedCount, 1); // At least 1 slot

    // Create a working state arrays for the form inputs
    const [inputUrls, setInputUrls] = useState<{ [index: number]: string }>({});
    const [inputActive, setInputActive] = useState<{ [index: number]: boolean }>({});
    const [previewVisible, setPreviewVisible] = useState<{ [index: number]: boolean }>({});

    // Sync input states when fetched cameras change
    useEffect(() => {
        const newUrls: { [index: number]: string } = {};
        const newActive: { [index: number]: boolean } = {};
        cameras.forEach((cam, i) => {
            newUrls[i] = cam.rtsp_url;
            newActive[i] = cam.is_active;
        });
        setInputUrls(newUrls);
        setInputActive(newActive);
    }, [cameras]);

    const handleUrlChange = (index: number, value: string) => {
        setInputUrls(prev => ({ ...prev, [index]: value }));
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
        const urlToSave = inputUrls[index] || '';
        const activeToSave = forcedActiveState !== undefined ? forcedActiveState : !!inputActive[index];
        const existingCam = cameras[index];
        const camName = `Camera ${index + 1}`;

        if (!urlToSave.trim() && !existingCam) return; // Don't create empty cameras

        try {
            setSaving(camName);
            let updatedCam: CameraData;

            if (existingCam) {
                // Update
                updatedCam = await api.updateCamera(existingCam.id, {
                    name: camName,
                    rtsp_url: urlToSave,
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

    return (
        <Layout>
            <div className="w-full max-w-4xl mx-auto py-8">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-[#10B981]/20 border border-[#10B981]/30 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                        <Video className="w-8 h-8 text-[#10B981]" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-500 font-mono tracking-wider">
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

                <div className="bg-[#0A0D2A]/60 rounded-2xl border border-[#1E2548] backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
                    <div className="p-6 border-b border-[#1E2548] flex justify-between items-center bg-gradient-to-r from-[#10B981]/5 to-transparent">
                        <h2 className="text-white font-mono font-bold tracking-widest text-sm flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 text-[#10B981]" />
                            RTSP STREAM CONFIGURATION
                        </h2>
                        {loading && <Loader2 className="w-5 h-5 text-[#10B981] animate-spin" />}
                    </div>

                    <div className="p-6 space-y-4">
                        {loading && cameras.length === 0 ? (
                            <div className="text-center py-12 text-[#64748B] font-mono text-sm tracking-widest animate-pulse">
                                INITIALIZING CAMERA MATRIX...
                            </div>
                        ) : (
                            Array.from({ length: displayCount }).map((_, i) => {
                                const cam = cameras[i];
                                const isActive = !!inputActive[i];
                                const isSaving = saving === `Camera ${i + 1}`;

                                return (
                                    <div key={cam?.id || `new-${i}`} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl bg-[#060818]/80 border border-[#1E2548] hover:border-[#10B981]/30 transition-colors group">
                                        <div className="w-full sm:w-32 shrink-0">
                                            <span className="text-xs font-mono tracking-widest font-bold text-[#94A3B8] uppercase group-hover:text-white transition-colors">
                                                CAMERA {String(i + 1).padStart(2, '0')}
                                            </span>
                                        </div>

                                        <div className="flex-1 w-full relative">
                                            <input
                                                type="text"
                                                value={inputUrls[i] || ''}
                                                onChange={(e) => handleUrlChange(i, e.target.value)}
                                                placeholder="rtsp://admin:pass@192.168.1.100:554/stream1"
                                                className="w-full bg-[#121738] border border-[#1E2548] focus:border-[#10B981]/50 rounded-lg pl-4 pr-12 py-3 font-mono text-xs text-[#E2E8F0] placeholder-[#64748B] focus:outline-none transition-all shadow-inner"
                                            />
                                            {/* Save Button */}
                                            <button
                                                onClick={() => handleSave(i)}
                                                disabled={isSaving || (!inputUrls[i] && !cam)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20 disabled:opacity-50 disabled:hover:bg-[#10B981]/10 transition-colors"
                                                title="Save URL"
                                            >
                                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        <div className="w-full sm:w-auto shrink-0 flex items-center justify-between sm:justify-start gap-3">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleActiveToggle(i)}
                                                    disabled={!cam && !inputUrls[i]}
                                                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none border border-[#1E2548] shadow-inner ${isActive ? 'bg-[#10B981]/20' : 'bg-[#121738] disabled:opacity-50'}`}
                                                >
                                                    <span className={`inline-block h-5 w-5 transform rounded-full transition-transform ${isActive ? 'translate-x-8 bg-[#10B981] shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'translate-x-1 bg-[#64748B]'}`} />
                                                </button>

                                                <div className="w-16 text-center">
                                                    <span className={`text-[10px] font-mono tracking-widest font-bold uppercase ${isActive ? 'text-[#10B981]' : 'text-[#64748B]'}`}>
                                                        {isActive ? 'ACTIVE' : 'OFFLINE'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Preview Toggle Button */}
                                            {cam && (
                                                <button
                                                    onClick={() => togglePreview(i)}
                                                    className={`p-1.5 rounded-md border transition-colors flex items-center justify-center ${previewVisible[i] ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'bg-[#1E2548]/50 border-[#1E2548] text-[#94A3B8] hover:text-white hover:bg-[#1E2548]'}`}
                                                    title={previewVisible[i] ? "Hide Preview" : "Show Preview"}
                                                >
                                                    {previewVisible[i] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            )}
                                        </div>
                                        
                                        {/* Collapsible Preview Box */}
                                        {cam && previewVisible[i] && (
                                            <div className="w-full mt-4 bg-black rounded-lg border border-[#1E2548] overflow-hidden aspect-video relative flex items-center justify-center">
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-[#64748B] font-mono text-sm">
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

                <div className="mt-8 p-5 bg-[#0A0D2A]/40 border border-[#1E2548]/80 rounded-2xl backdrop-blur-md shadow-inner">
                    <h3 className="text-[#94A3B8] font-mono text-xs font-bold tracking-widest uppercase mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.8)]" />
                        Common RTSP Formats Reference
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
                        <div className="p-3 bg-[#060818]/50 border border-[#1E2548]/50 rounded text-[#CBD5E1]">
                            <span className="text-cyan-400 font-bold block mb-1">HIKVISION</span>
                            rtsp://admin:pass@IP:554/Streaming/Channels/101
                        </div>
                        <div className="p-3 bg-[#060818]/50 border border-[#1E2548]/50 rounded text-[#CBD5E1]">
                            <span className="text-cyan-400 font-bold block mb-1">DAHUA</span>
                            rtsp://admin:pass@IP:554/cam/realmonitor?channel=1&amp;subtype=0
                        </div>
                        <div className="p-3 bg-[#060818]/50 border border-[#1E2548]/50 rounded text-[#CBD5E1]">
                            <span className="text-cyan-400 font-bold block mb-1">TP-LINK TAPO</span>
                            rtsp://admin:pass@IP:554/stream1
                        </div>
                        <div className="p-3 bg-[#060818]/50 border border-[#1E2548]/50 rounded text-[#CBD5E1]">
                            <span className="text-cyan-400 font-bold block mb-1">GENERIC / ONVIF</span>
                            rtsp://IP:554/live/ch0
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
