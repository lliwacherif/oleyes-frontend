import React from 'react';
import { LogOut, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import Logo from '../assets/Logo-oleyes-holding-2.png';


interface LayoutProps {
    children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
    const { logout } = useAuth();
    return (
        <div className="min-h-screen bg-[#060818] text-neutral-200 font-sans selection:bg-cyan-500/30 selection:text-cyan-200 overflow-x-hidden">
            {/* Background gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[20%] left-[-10%] w-[1200px] h-[1200px] bg-blue-900/10 rounded-full blur-[150px]" />
                <div className="absolute top-[40%] right-[-10%] w-[800px] h-[800px] bg-indigo-900/10 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 flex flex-col min-h-screen">
                <header className="border-b border-[#1E2548] bg-[#0A0D2A]/80 backdrop-blur-xl sticky top-0 z-50">
                    <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link to="/" className="opacity-90 hover:opacity-100 transition-opacity">
                                <img src={Logo} alt="OLEYES Logo" className="h-8 w-auto object-contain brightness-110 contrast-125" />
                            </Link>
                            <div className="h-6 w-px bg-[#1E2548]" />
                            <div className="hidden sm:block text-[11px] text-neutral-400 uppercase tracking-widest pl-2 font-medium">
                                SOC COMMAND CENTER // V1.0.4
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-neutral-400">
                            <div className="flex items-center gap-2 px-4 py-1.5 rounded bg-[#061813] border border-[#10B981] shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                                <div className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                <span className="text-[10px] uppercase font-semibold text-[#10B981] tracking-wider">System Online</span>
                            </div>
                            <div className="flex items-center gap-3 ml-2">
                                <Link
                                    to="/settings"
                                    className="p-2 inline-flex items-center justify-center rounded bg-[#4F46E5]/20 border border-[#4F46E5]/40 text-[#818CF8] hover:bg-[#4F46E5]/40 transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                                    aria-label="Settings"
                                >
                                    <SettingsIcon className="w-4 h-4" />
                                </Link>
                                <button
                                    onClick={logout}
                                    className="px-4 py-1.5 inline-flex items-center justify-center gap-2 rounded bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white hover:brightness-110 transition-all font-semibold text-[11px] uppercase tracking-wider relative overflow-hidden shadow-[0_0_15px_rgba(59,130,246,0.4)]"
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

                <footer className="border-t border-[#1E2548] py-8 text-center text-[10px] text-[#64748B] uppercase tracking-[0.2em] bg-[#0A0D2A]/80">
                    [ SYS_END_OF_DOCUMENT ] // @2025 NEXBUILD
                </footer>
            </div>
        </div>
    );
}
