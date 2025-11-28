import { create } from 'zustand';

export interface FileNode {
    path: string;
    name: string;
    type: 'file' | 'directory';
    children?: FileNode[];
    content?: string;
    isExpanded?: boolean;
}

interface FileState {
    files: FileNode[];
    selectedFile: string | null;
    openFiles: string[];
    fileContent: Record<string, string>;

    setFiles: (files: FileNode[]) => void;
    selectFile: (path: string) => void;
    openFile: (path: string) => void;
    closeFile: (path: string) => void;
    updateFileContent: (path: string, content: string) => void;
    toggleDirectory: (path: string) => void;
}

export const useFileStore = create<FileState>((set) => ({
    files: [],
    selectedFile: null,
    openFiles: [],
    fileContent: {},

    setFiles: (files) => set({ files }),

    selectFile: (path) => set({ selectedFile: path }),

    openFile: (path) => set((state) => ({
        openFiles: state.openFiles.includes(path) ? state.openFiles : [...state.openFiles, path],
        selectedFile: path
    })),

    closeFile: (path) => set((state) => ({
        openFiles: state.openFiles.filter(p => p !== path),
        selectedFile: state.selectedFile === path
            ? state.openFiles.find(p => p !== path) || null
            : state.selectedFile
    })),

    updateFileContent: (path, content) => set((state) => ({
        fileContent: { ...state.fileContent, [path]: content }
    })),

    toggleDirectory: (path) => set((state) => {
        const toggle = (nodes: FileNode[]): FileNode[] => {
            return nodes.map(node => {
                if (node.path === path) {
                    return { ...node, isExpanded: !node.isExpanded };
                }
                if (node.children) {
                    return { ...node, children: toggle(node.children) };
                }
                return node;
            });
        };
        return { files: toggle(state.files) };
    })
}));
