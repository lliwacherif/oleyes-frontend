import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Lock, FileText, X } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { api } from '../api/client';
import type { ContextData } from '../api/types';

export function Settings() {
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [isContextModalOpen, setIsContextModalOpen] = useState(false);
    const { setSceneContext } = useSettings();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Context Form State
    const [contextData, setContextData] = useState<ContextData>({
        business_type: '',
        business_name: '',
        short_description: '',
        number_of_locations: '',
        estimated_number_of_cameras: '',
        business_size: '',
        camera_type: '',
        theft_detection: false,
        suspicious_behavior_detection: false,
        loitering_detection: false,
        employee_monitoring: false,
        customer_behavior_analytics: false,
    });

    useEffect(() => {
        if (isContextModalOpen) {
            fetchContextData();
        }
    }, [isContextModalOpen]);

    const fetchContextData = async () => {
        setLoading(true);
        try {
            const data = await api.getContext();
            if (data) {
                setContextData(data);
            }
        } catch (err) {
            console.error("Failed to load context data", err);
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Mocking password change since no API is available yet
        if (newPassword !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        alert('Password changed successfully');
        setIsPasswordModalOpen(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
    };

    const handleContextSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // we omit context_text because it's computed by backend/readonly
            const { context_text, ...payload } = contextData;

            try {
                // Try create first or update based on your API logic
                await api.updateContext(payload);
            } catch (err: any) {
                if (err.response?.status === 404) {
                    await api.createContext(payload as any);
                } else {
                    throw err;
                }
            }

            // re-fetch settings context locally to update other parts of the UI
            const newContext = await api.getContext();
            if (newContext) {
                if (newContext.context_text) {
                    setSceneContext(newContext.context_text);
                }

                // Update local form state too
                setContextData(newContext);
            }
            alert("Context successfully updated!");
        } catch (err: any) {
            setError(err.response?.data?.detail || err.message || 'Error saving context');
        } finally {
            setLoading(false);
        }
    };

    const renderInput = (label: string, field: keyof ContextData, placeholder: string = '', type = 'text') => (
        <div className="mb-4">
            <label className="block text-sm text-neutral-400 mb-1">{label}</label>
            <input
                type={type}
                value={(contextData[field] as string) || ''}
                onChange={(e) => setContextData(prev => ({ ...prev, [field]: e.target.value }))}
                className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500/50"
                placeholder={placeholder}
            />
        </div>
    );

    const renderToggle = (label: string, field: keyof ContextData) => (
        <div className="flex items-center justify-between py-2 mb-2 bg-black/10 px-4 rounded-xl border border-white/5">
            <span className="text-white text-sm">{label}</span>
            <button
                type="button"
                onClick={() => setContextData(prev => ({ ...prev, [field]: !prev[field] }))}
                className={`w-10 h-5 rounded-full transition-colors relative ${contextData[field] ? 'bg-emerald-500' : 'bg-white/20'}`}
            >
                <div className={`w-4 h-4 rounded-full shadow-md transform transition-transform absolute top-0.5 ${contextData[field] ? 'translate-x-5 bg-white' : 'translate-x-1 bg-neutral-400'}`} />
            </button>
        </div>
    );

    return (
        <Layout>
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Change Password Card */}
                    <button
                        onClick={() => setIsPasswordModalOpen(true)}
                        className="p-6 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 backdrop-blur-sm transition-all text-left group"
                    >
                        <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Lock className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-lg text-white mb-2">Change Password</h3>
                        <p className="text-neutral-400 text-sm">Update your account password to keep your account secure.</p>
                    </button>

                    {/* Context Card */}
                    <button
                        onClick={() => setIsContextModalOpen(true)}
                        className="p-6 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 backdrop-blur-sm transition-all text-left group"
                    >
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <FileText className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-lg text-white mb-2">Scene Context</h3>
                        <p className="text-neutral-400 text-sm">Configure the environment description for the AI engine.</p>
                    </button>
                </div>
            </div>

            {/* Password Modal */}
            {isPasswordModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-md relative">
                        <button
                            onClick={() => setIsPasswordModalOpen(false)}
                            className="absolute top-4 right-4 text-neutral-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="text-xl font-bold text-white mb-6">Change Password</h2>
                        <form onSubmit={handlePasswordSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-neutral-400 mb-1">Current Password</label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500/50"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-neutral-400 mb-1">New Password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500/50"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-neutral-400 mb-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500/50"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 rounded-xl transition-colors mt-6"
                            >
                                Update Password
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Context Modal */}
            {isContextModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-xl relative">
                        <button
                            onClick={() => setIsContextModalOpen(false)}
                            className="absolute top-4 right-4 text-neutral-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <h3 className="font-bold text-lg mb-2 text-white flex items-center gap-2">
                            Scene Context
                            <span className="text-xs font-normal text-neutral-400 px-2 py-0.5 rounded-full bg-white/10">Optional</span>
                        </h3>
                        <p className="text-sm text-neutral-400 mb-6">
                            Configure your business details and security priorities below.
                        </p>

                        {error && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        {loading ? (
                            <div className="flex justify-center items-center h-48">
                                <span className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"></span>
                            </div>
                        ) : (
                            <form onSubmit={handleContextSubmit} className="max-h-[60vh] overflow-y-auto pr-2 space-y-6 custom-scrollbar">
                                {/* Basic Details */}
                                <div>
                                    <h4 className="text-emerald-400 font-semibold mb-3 border-b border-white/10 pb-2">Business Details</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {renderInput('Business Name', 'business_name', 'Enter Business Name')}
                                        {renderInput('Business Type', 'business_type', 'e.g., Supermarket')}
                                        {renderInput('Business Size', 'business_size', 'Small, Medium, Large')}
                                        {renderInput('Number of Locations', 'number_of_locations', 'e.g., 1', 'number')}
                                    </div>
                                    {renderInput('Description', 'short_description', 'A local grocery store...')}
                                </div>

                                {/* Camera Details */}
                                <div>
                                    <h4 className="text-emerald-400 font-semibold mb-3 border-b border-white/10 pb-2">Camera Setup</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {renderInput('Estimated Cameras', 'estimated_number_of_cameras', 'e.g., 15', 'number')}
                                        {renderInput('Camera Type', 'camera_type', 'IP Cameras')}
                                    </div>
                                </div>

                                {/* Security Priorities */}
                                <div>
                                    <h4 className="text-emerald-400 font-semibold mb-3 border-b border-white/10 pb-2">Security Priorities</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                                        {renderToggle('Theft Detection', 'theft_detection')}
                                        {renderToggle('Suspicious Behavior', 'suspicious_behavior_detection')}
                                        {renderToggle('Loitering Detection', 'loitering_detection')}
                                        {renderToggle('Employee Monitoring', 'employee_monitoring')}
                                        {renderToggle('Customer Analytics', 'customer_behavior_analytics')}
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-between items-center border-t border-white/10 mt-6">
                                    <div className="bg-black/20 px-4 py-2 rounded-lg border border-white/5 text-xs text-neutral-400 max-w-sm truncate" title={contextData.context_text}>
                                        Generated Context: {contextData.context_text ? contextData.context_text.substring(0, 50) + "..." : "None"}
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </Layout>
    );
}
