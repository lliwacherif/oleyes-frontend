import React from 'react';
import { LogOut, Settings as SettingsIcon, MapPin, Sun, Moon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Link } from 'react-router-dom';
import Logo from '../assets/Logo-oleyes-icon.png';


interface LayoutProps {
    children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
    const { logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#060818] text-neutral-800 dark:text-neutral-200 font-sans selection:bg-cyan-500/30 selection:text-cyan-200 overflow-x-hidden">
            {/* Background gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[20%] left-[-10%] w-[1200px] h-[1200px] bg-blue-100/40 dark:bg-blue-900/10 rounded-full blur-[150px]" />
                <div className="absolute top-[40%] right-[-10%] w-[800px] h-[800px] bg-indigo-100/40 dark:bg-indigo-900/10 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 flex flex-col min-h-screen">
                <header className="border-b border-slate-200 dark:border-[#1E2548] bg-white/80 dark:bg-[#0A0D2A]/80 backdrop-blur-xl sticky top-0 z-50">
                    <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link to="/" className="opacity-90 hover:opacity-100 transition-opacity">
                                <img src={Logo} alt="OLEYES Logo" className="h-8 w-auto object-contain dark:brightness-110 dark:contrast-125" />
                            </Link>
                            <div className="h-6 w-px bg-slate-200 dark:bg-[#1E2548]" />
                            <div className="hidden sm:block text-[11px] text-slate-500 dark:text-neutral-400 uppercase tracking-widest pl-2 font-medium">
                                SOC COMMAND CENTER // V1.0.4
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-neutral-400">
                            <div className="flex items-center gap-2 px-4 py-1.5 rounded bg-emerald-50 dark:bg-[#061813] border border-emerald-300 dark:border-[#10B981] shadow-sm dark:shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                                <div className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                <span className="text-[10px] uppercase font-semibold text-[#10B981] tracking-wider">System Online</span>
                            </div>
                            <div className="flex items-center gap-3 ml-2">
                                <Link
                                    to="/zone-rules"
                                    className="p-2 inline-flex items-center justify-center rounded bg-cyan-100 dark:bg-cyan-500/20 border border-cyan-300 dark:border-cyan-500/40 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-200 dark:hover:bg-cyan-500/40 transition-all shadow-sm dark:shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                                    aria-label="Zone Rules"
                                    title="ROI Zone Rules"
                                >
                                    <MapPin className="w-4 h-4" />
                                </Link>
                                <Link
                                    to="/settings"
                                    className="p-2 inline-flex items-center justify-center rounded bg-indigo-100 dark:bg-[#4F46E5]/20 border border-indigo-300 dark:border-[#4F46E5]/40 text-indigo-600 dark:text-[#818CF8] hover:bg-indigo-200 dark:hover:bg-[#4F46E5]/40 transition-all shadow-sm dark:shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                                    aria-label="Settings"
                                >
                                    <SettingsIcon className="w-4 h-4" />
                                </Link>
                                <button
                                    onClick={toggleTheme}
                                    className="p-2 inline-flex items-center justify-center rounded bg-amber-100 dark:bg-indigo-500/20 border border-amber-300 dark:border-indigo-500/40 text-amber-600 dark:text-indigo-400 hover:bg-amber-200 dark:hover:bg-indigo-500/40 transition-all shadow-sm dark:shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                                    aria-label="Toggle Theme"
                                >
                                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={logout}
                                    className="px-4 py-1.5 inline-flex items-center justify-center gap-2 rounded bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white hover:brightness-110 transition-all font-semibold text-[11px] uppercase tracking-wider relative overflow-hidden shadow-md dark:shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span className="hidden sm:inline">SIGN OUT</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 container mx-auto px-6 py-8">
                    {children}
                </main>

                <footer className="border-t border-slate-200 dark:border-[#1E2548] py-8 text-center text-[10px] text-slate-400 dark:text-[#64748B] uppercase tracking-[0.2em] bg-white/80 dark:bg-[#0A0D2A]/80">
                    [ SYS_END_OF_DOCUMENT ] // @2025 NEXBUILD
                </footer>
            </div>
        </div>
    );
}
