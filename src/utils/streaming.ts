/**
 * Streaming utilities for real-time AI output
 */

export interface StreamChunk {
    content: string;
    isComplete: boolean;
    metadata?: Record<string, any>;
}

export type StreamCallback = (chunk: StreamChunk) => void;

export class StreamBuffer {
    private buffer: string = '';
    private callbacks: StreamCallback[] = [];
    private isComplete: boolean = false;

    onChunk(callback: StreamCallback): void {
        this.callbacks.push(callback);
    }

    write(content: string): void {
        this.buffer += content;
        this.emit({
            content,
            isComplete: false
        });
    }

    complete(metadata?: Record<string, any>): void {
        this.isComplete = true;
        this.emit({
            content: '',
            isComplete: true,
            metadata
        });
    }

    getBuffer(): string {
        return this.buffer;
    }

    clear(): void {
        this.buffer = '';
        this.callbacks = [];
        this.isComplete = false;
    }

    private emit(chunk: StreamChunk): void {
        for (const callback of this.callbacks) {
            try {
                callback(chunk);
            } catch (error) {
                console.error('Error in stream callback:', error);
            }
        }
    }
}

export class StreamAggregator {
    private streams: Map<string, StreamBuffer> = new Map();

    createStream(id: string): StreamBuffer {
        const stream = new StreamBuffer();
        this.streams.set(id, stream);
        return stream;
    }

    getStream(id: string): StreamBuffer | undefined {
        return this.streams.get(id);
    }

    deleteStream(id: string): void {
        this.streams.delete(id);
    }

    clear(): void {
        this.streams.clear();
    }
}

/**
 * Converts an async iterable to a stream buffer
 */
export async function* streamAsyncIterable<T>(
    iterable: AsyncIterable<T>,
    transform: (item: T) => string
): AsyncGenerator<string> {
    for await (const item of iterable) {
        yield transform(item);
    }
}

/**
 * Throttles stream updates to prevent overwhelming the UI
 */
export class ThrottledStream {
    private buffer: StreamBuffer;
    private throttleMs: number;
    private lastEmit: number = 0;
    private pendingContent: string = '';
    private timeoutId?: NodeJS.Timeout;

    constructor(buffer: StreamBuffer, throttleMs: number = 50) {
        this.buffer = buffer;
        this.throttleMs = throttleMs;
    }

    write(content: string): void {
        this.pendingContent += content;
        const now = Date.now();

        if (now - this.lastEmit >= this.throttleMs) {
            this.flush();
        } else if (!this.timeoutId) {
            this.timeoutId = setTimeout(() => {
                this.flush();
            }, this.throttleMs - (now - this.lastEmit));
        }
    }

    complete(metadata?: Record<string, any>): void {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
        this.flush();
        this.buffer.complete(metadata);
    }

    private flush(): void {
        if (this.pendingContent) {
            this.buffer.write(this.pendingContent);
            this.pendingContent = '';
            this.lastEmit = Date.now();
        }
        this.timeoutId = undefined;
    }
}
