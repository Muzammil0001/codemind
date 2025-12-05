import { useState, useEffect, useCallback } from 'react';

interface VSCodeApi {
    postMessage(message: any): void;
    getState(): any;
    setState(state: any): void;
}

declare global {
    interface Window {
        vscode: VSCodeApi;
    }
    function acquireVsCodeApi(): VSCodeApi;
}

let vscodeApi: VSCodeApi | undefined;

export function useVSCode() {
    const [state, setState] = useState<any>(undefined);

    useEffect(() => {
        if (!vscodeApi) {
            if (window.vscode) {
                vscodeApi = window.vscode;
            } else {
                try {
                    vscodeApi = acquireVsCodeApi();
                    window.vscode = vscodeApi;
                } catch (e) {
                    console.error('Failed to acquire Editor API:', e);
                    vscodeApi = {
                        postMessage: (msg: any) => console.log('Catch: Editor Message:', msg),
                        getState: () => ({}),
                        setState: () => { },
                    };
                }
            }
        }
        setState(vscodeApi.getState());
    }, []);

    const postMessage = useCallback((message: any) => {
        if (vscodeApi) {
            vscodeApi.postMessage(message);
        }
    }, []);

    const updateState = useCallback((newState: any) => {
        if (vscodeApi) {
            vscodeApi.setState(newState);
            setState(newState);
        }
    }, []);

    return {
        postMessage,
        state,
        updateState,
    };
}
