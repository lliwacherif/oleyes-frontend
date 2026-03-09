import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

interface SettingsContextType {
    sceneContext: string;
    setSceneContext: (context: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [sceneContext, setSceneContext] = useState(localStorage.getItem('sceneContext') || '');
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

    return (
        <SettingsContext.Provider value={{ sceneContext, setSceneContext: handleSetSceneContext }}>
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
