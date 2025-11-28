import { create } from 'zustand';

export interface AgentTask {
    id: string;
    type: string;
    description: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    result?: string;
    error?: string;
}

interface AgentState {
    tasks: AgentTask[];
    activeTaskId: string | null;
    isProcessing: boolean;
    status: 'idle' | 'thinking' | 'planning' | 'running' | 'executing';

    addTask: (task: Omit<AgentTask, 'status' | 'progress'>) => void;
    updateTaskStatus: (taskId: string, status: AgentTask['status'], progress?: number) => void;
    completeTask: (taskId: string, result: string) => void;
    failTask: (taskId: string, error: string) => void;
    clearTasks: () => void;
    setStatus: (status: AgentState['status']) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
    tasks: [],
    activeTaskId: null,
    isProcessing: false,
    status: 'idle',

    addTask: (task) => set((state) => ({
        tasks: [...state.tasks, { ...task, status: 'pending', progress: 0 }],
        activeTaskId: task.id,
        isProcessing: true,
        status: 'running'
    })),

    updateTaskStatus: (taskId, status, progress) => set((state) => ({
        tasks: state.tasks.map(t =>
            t.id === taskId
                ? { ...t, status, progress: progress ?? t.progress }
                : t
        )
    })),

    completeTask: (taskId, result) => set((state) => ({
        tasks: state.tasks.map(t =>
            t.id === taskId
                ? { ...t, status: 'completed', progress: 100, result }
                : t
        ),
        isProcessing: false,
        activeTaskId: null,
        status: 'idle'
    })),

    failTask: (taskId, error) => set((state) => ({
        tasks: state.tasks.map(t =>
            t.id === taskId
                ? { ...t, status: 'failed', error }
                : t
        ),
        isProcessing: false,
        activeTaskId: null,
        status: 'idle'
    })),

    clearTasks: () => set({ tasks: [], activeTaskId: null, isProcessing: false, status: 'idle' }),
    setStatus: (status) => set({ status, isProcessing: status !== 'idle' })
}));
