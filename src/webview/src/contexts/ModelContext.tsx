import React, { createContext, useState, useCallback, type ReactNode } from 'react';
import { DEFAULT_MODEL } from '../constants/defaults';

interface ModelContextType {
    selectedModel: string;
    setSelectedModel: (model: string) => void;
    providerStatus: Map<string, boolean>;
    setProviderStatus: (provider: string, status: boolean) => void;
    setAllProviderStatus: (statusMap: Map<string, boolean>) => void;
}

export const ModelContext = createContext<ModelContextType | undefined>(undefined);

export const ModelProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [selectedModel, setSelectedModelState] = useState<string>(DEFAULT_MODEL);
    const [providerStatus, setProviderStatusState] = useState<Map<string, boolean>>(new Map());

    const setSelectedModel = useCallback((model: string) => {
        setSelectedModelState(model);
    }, []);

    const setProviderStatus = useCallback((provider: string, status: boolean) => {
        setProviderStatusState(prev => {
            const newMap = new Map(prev);
            newMap.set(provider, status);
            return newMap;
        });
    }, []);

    const setAllProviderStatus = useCallback((statusMap: Map<string, boolean>) => {
        setProviderStatusState(statusMap);
    }, []);

    return (
        <ModelContext.Provider value={{
            selectedModel,
            setSelectedModel,
            providerStatus,
            setProviderStatus,
            setAllProviderStatus
        }}>
            {children}
        </ModelContext.Provider>
    );
};
