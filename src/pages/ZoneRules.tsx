import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { MapPin, Camera, Save, Trash2, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import type { CameraData, Zone } from '../api/types';

export function ZoneRules() {
    const [cameras, setCameras] = useState<CameraData[]>([]);
    const [cameraZones, setCameraZones] = useState<Record<string, Zone[]>>({});
    const [loading, setLoading] = useState(true);
    const [localInstructions, setLocalInstructions] = useState<Record<string, string>>({});
    const [savingId, setSavingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [savedId, setSavedId] = useState<string | null>(null);

    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const cams = await api.getCameras();
            setCameras(cams);
            const zonesMap: Record<string, Zone[]> = {};
            const instrMap: Record<string, string> = {};
            await Promise.all(cams.map(async (cam) => {
                try {
                    const zones = await api.getZones(cam.id);
                    if (zones.length > 0) {
                        zonesMap[cam.id] = zones;
                        zones.forEach((z: Zone) => {
                            instrMap[z.id] = z.instruction || '';
                        });
                    }
                } catch { /* no zones */ }
            }));
            setCameraZones(zonesMap);
            setLocalInstructions(instrMap);
        } catch (err) {
            console.error('Failed to load zones', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveInstruction = async (zoneId: string) => {
        setSavingId(zoneId);
        try {
            await api.updateZone(zoneId, { instruction: localInstructions[zoneId] || '' });
            setSavedId(zoneId);
            setTimeout(() => setSavedId(null), 2000);
        } catch (err) {
            console.error('Failed to save instruction', err);
            alert('Failed to save instruction');
        } finally {
            setSavingId(null);
        }
    };

    const handleDeleteZone = async (zoneId: string, cameraId: string) => {
        if (!confirm('Delete this zone and its instruction permanently?')) return;
        setDeletingId(zoneId);
        try {
            await api.deleteZone(zoneId);
            setCameraZones(prev => {
                const updated = { ...prev };
                updated[cameraId] = (updated[cameraId] || []).filter(z => z.id !== zoneId);
                if (updated[cameraId].length === 0) delete updated[cameraId];
                return updated;
            });
            setLocalInstructions(prev => {
                const updated = { ...prev };
                delete updated[zoneId];
                return updated;
            });
        } catch (err) {
            console.error('Failed to delete zone', err);
        } finally {
            setDeletingId(null);
        }
    };

    const totalZones = Object.values(cameraZones).reduce((sum, z) => sum + z.length, 0);

    return (
        <Layout>
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                {/* Header */}
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                        <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">ROI Zone Rules</h1>
                        <p className="text-slate-400 dark:text-neutral-500 text-sm">Configure detection instructions for each zone. These rules are injected into the AI engine during analysis.</p>
                    </div>
                </div>

                <div className="mt-1 mb-8 flex items-center gap-3 text-[10px] font-mono tracking-widest uppercase text-neutral-600">
                    <span>{cameras.length} CAMERA{cameras.length !== 1 ? 'S' : ''}</span>
                    <span className="text-neutral-700">·</span>
                    <span>{totalZones} ZONE{totalZones !== 1 ? 'S' : ''} CONFIGURED</span>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <span className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin"></span>
                    </div>
                ) : totalZones === 0 ? (
                    <div className="text-center py-24 border border-white/5 rounded-2xl bg-white/[0.02]">
                        <MapPin className="w-12 h-12 mx-auto mb-4 text-neutral-700" />
                        <p className="text-slate-500 dark:text-neutral-400 text-sm mb-1">No zones configured yet</p>
                        <p className="text-neutral-600 text-xs">Open a camera's live viewer from the dashboard and draw zones to get started.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {Object.entries(cameraZones).map(([camId, zones]) => {
                            const cam = cameras.find(c => c.id === camId);
                            return (
                                <div key={camId} className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                                    {/* Camera header */}
                                    <div className="flex items-center gap-3 px-5 py-4 bg-white/[0.03] border-b border-white/5">
                                        <Camera className="w-4 h-4 text-cyan-400" />
                                        <span className="text-white font-semibold text-sm">{cam?.name || `Camera ${camId.substring(0, 8)}`}</span>
                                        <span className="ml-auto text-neutral-600 text-xs font-mono">{zones.length} zone{zones.length !== 1 ? 's' : ''}</span>
                                    </div>

                                    {/* Zones */}
                                    <div className="divide-y divide-white/5">
                                        {zones.map(zone => (
                                            <div key={zone.id} className="px-5 py-4 group">
                                                {/* Zone info row */}
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 flex-shrink-0" style={{ backgroundColor: zone.color }} />
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-white text-sm font-medium">{zone.name}</span>
                                                        <span className="text-neutral-600 text-xs ml-2">{zone.points.length} pts</span>
                                                        {zone.created_at && <span className="text-neutral-700 text-xs ml-2">· {new Date(zone.created_at).toLocaleDateString()}</span>}
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteZone(zone.id, camId)}
                                                        disabled={deletingId === zone.id}
                                                        className="text-red-500/50 hover:text-red-400 p-1.5 rounded hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                                        title="Delete Zone"
                                                    >
                                                        {deletingId === zone.id
                                                            ? <span className="w-3.5 h-3.5 rounded-full border-2 border-red-400 border-t-transparent animate-spin inline-block" />
                                                            : <Trash2 className="w-3.5 h-3.5" />
                                                        }
                                                    </button>
                                                </div>

                                                {/* Instruction textarea */}
                                                <div className="ml-6">
                                                    <textarea
                                                        placeholder="e.g. Alert if any person enters this area after hours. Raise risk to HIGH immediately."
                                                        value={localInstructions[zone.id] || ''}
                                                        onChange={(e) => setLocalInstructions(prev => ({ ...prev, [zone.id]: e.target.value }))}
                                                        className="w-full bg-white dark:bg-[#0A0D2A] border border-slate-200 dark:border-[#1E2548] rounded-lg p-3 text-[12px] font-mono text-slate-600 dark:text-[#94A3B8] resize-none h-20 focus:outline-none focus:border-cyan-500/50 transition-colors placeholder:text-neutral-700"
                                                        maxLength={500}
                                                    />
                                                    <div className="flex items-center justify-between mt-2">
                                                        <span className="text-neutral-700 text-[10px] font-mono">
                                                            {(localInstructions[zone.id] || '').length}/500
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            {savedId === zone.id && (
                                                                <span className="text-emerald-400 text-[10px] font-mono tracking-wider animate-pulse">SAVED ✓</span>
                                                            )}
                                                            <button
                                                                onClick={() => handleSaveInstruction(zone.id)}
                                                                disabled={savingId === zone.id}
                                                                className="px-3 py-1.5 text-[10px] font-mono font-bold tracking-widest uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded hover:bg-emerald-500/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                                            >
                                                                {savingId === zone.id
                                                                    ? <span className="w-3 h-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin inline-block" />
                                                                    : <Save className="w-3 h-3" />
                                                                }
                                                                SAVE INSTRUCTION
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Footer hint */}
                {totalZones > 0 && (
                    <div className="mt-8 flex items-start gap-2 text-neutral-600 text-xs bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p>Instructions are injected as <span className="text-cyan-500 font-mono">ROI ZONE RULES</span> into the LLM system prompt when you click EXECUTE on a camera. The AI uses these rules to evaluate zone intrusions and adjust risk scores.</p>
                    </div>
                )}
            </div>
        </Layout>
    );
}
