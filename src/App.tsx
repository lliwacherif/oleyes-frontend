import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { YoloDetector } from './components/YoloDetector';
import { LlmChat } from './components/LlmChat';
import { Bot, X, Video } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Onboarding } from './pages/Onboarding';
import { Settings } from './pages/Settings';
import { Cameras } from './pages/Cameras';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { ProtectedRoute } from './components/ProtectedRoute';

function Dashboard() {
  const { sceneContext } = useSettings();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="w-full max-w-[1600px] mx-auto relative">

        {/* Horizontal System Status Bar & Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0A0D2A]/80 border border-[#1E2548] shadow-sm backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
              <span className="text-[9px] font-medium text-neutral-500 tracking-widest uppercase">BACKEND: <span className="text-[#10B981] font-bold">ACTIVE</span></span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0A0D2A]/80 border border-[#1E2548] shadow-sm backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.8)]" />
              <span className="text-[9px] font-medium text-neutral-500 tracking-widest uppercase">VISION: <span className="text-cyan-400 font-bold">YOLOv11</span></span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0A0D2A]/80 border border-[#1E2548] shadow-sm backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A855F7] shadow-[0_0_5px_rgba(168,85,247,0.8)]" />
              <span className="text-[9px] font-medium text-neutral-500 tracking-widest uppercase">LLM: <span className="text-[#A855F7] font-bold">GPT-OSS-120B</span></span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/cameras')}
              className="flex items-center gap-2 px-4 py-2 bg-[#10B981]/10 hover:bg-[#10B981]/20 border border-[#10B981]/30 text-[#10B981] rounded shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all font-mono text-[10px] uppercase font-bold tracking-widest"
            >
              <Video className="w-4 h-4" />
              CAMERAS CONNECTIVITY
            </button>
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-[#A855F7]/10 hover:bg-[#A855F7]/20 border border-[#A855F7]/30 text-[#A855F7] rounded shadow-[0_0_15px_rgba(168,85,247,0.2)] transition-all font-mono text-[10px] uppercase font-bold tracking-widest"
            >
              <Bot className="w-4 h-4" />
              {isChatOpen ? 'CLOSE OVERWATCH' : 'AI OVERWATCH'}
            </button>
          </div>
        </div>

        {/* Main Dashboard Area */}
        <div className="flex flex-col gap-6 relative">
          <div className="w-full">
            <YoloDetector sceneContext={sceneContext} />
          </div>

          {/* Slide-out Drawer for LlmChat */}
          <AnimatePresence>
            {isChatOpen && (
              <motion.div
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                className="fixed top-[64px] right-0 h-[calc(100vh-64px)] w-full sm:w-[500px] z-40 bg-[#060818]/95 backdrop-blur-2xl border-l border-[#1E2548] shadow-[-10px_0_30px_rgba(0,0,0,0.5)] flex flex-col pt-6 px-6 pb-6"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-white font-mono text-sm tracking-widest uppercase flex items-center gap-2">
                    <Bot className="w-4 h-4 text-[#A855F7]" /> AI OVERWATCH [COMM_LINK]
                  </h3>
                  <button onClick={() => setIsChatOpen(false)} className="text-neutral-500 hover:text-white transition-colors p-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 w-full relative">
                  <div className="absolute inset-0">
                    <LlmChat sceneContext={sceneContext} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/cameras" element={<Cameras />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider >
  );
}

export default App;
