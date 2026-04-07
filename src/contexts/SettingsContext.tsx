import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

interface SettingsContextType {
    sceneContext: string;
    setSceneContext: (context: string) => void;
    poseTheftMode: boolean;
    setPoseTheftMode: (mode: boolean) => void;
    supremeMode: boolean;
    setSupremeMode: (mode: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [sceneContext, setSceneContext] = useState(localStorage.getItem('sceneContext') || '');
    const [poseTheftMode, setPoseTheftModeState] = useState(localStorage.getItem('poseTheftMode') === 'true');
    const [supremeMode, setSupremeModeState] = useState(localStorage.getItem('supremeMode') === 'true');
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        if (!localStorage.getItem('sceneContext') && isAuthenticated) {
            const fetchContext = async () => {
                try {
                    const data = await api.getContext();
                    if (data && data.context_text) {
                        setSceneContext(data.context_text);
                    }
                } catch (error: any) {
                    // Silently handle 404 (no context set yet) or other initial fetch errors
                    console.log("No existing context found or failed to fetch context:", error.message);
                }
            };
            fetchContext();
        }
    }, [isAuthenticated]);

    const handleSetSceneContext = (value: string) => {
        setSceneContext(value);
        localStorage.setItem('sceneContext', value);
    };

    const setPoseTheftMode = (value: boolean) => {
        setPoseTheftModeState(value);
        localStorage.setItem('poseTheftMode', String(value));
        if (value) {
            setSupremeModeState(false);
            localStorage.setItem('supremeMode', 'false');
        }
    };

    const setSupremeMode = (value: boolean) => {
        setSupremeModeState(value);
        localStorage.setItem('supremeMode', String(value));
        if (value) {
            setPoseTheftModeState(false);
            localStorage.setItem('poseTheftMode', 'false');
        }
    };

    return (
        <SettingsContext.Provider value={{ sceneContext, setSceneContext: handleSetSceneContext, poseTheftMode, setPoseTheftMode, supremeMode, setSupremeMode }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
