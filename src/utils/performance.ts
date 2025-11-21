/**
 * Performance monitoring and optimization utilities
 */

export interface PerformanceMetric {
    name: string;
    duration: number;
    timestamp: number;
    metadata?: Record<string, any>;
}

class PerformanceMonitor {
    private metrics: PerformanceMetric[] = [];
    private activeTimers: Map<string, number> = new Map();
    private maxMetrics: number = 1000;

    start(name: string, metadata?: Record<string, any>): void {
        this.activeTimers.set(name, Date.now());
        if (metadata) {
            this.activeTimers.set(`${name}_metadata`, metadata as any);
        }
    }

    end(name: string): number {
        const startTime = this.activeTimers.get(name);

        if (!startTime) {
            console.warn(`No start time found for metric: ${name}`);
            return 0;
        }

        const duration = Date.now() - startTime;
        const metadata = this.activeTimers.get(`${name}_metadata`) as any;

        this.metrics.push({
            name,
            duration,
            timestamp: Date.now(),
            metadata
        });

        this.activeTimers.delete(name);
        this.activeTimers.delete(`${name}_metadata`);

        // Trim old metrics
        if (this.metrics.length > this.maxMetrics) {
            this.metrics = this.metrics.slice(-this.maxMetrics);
        }

        return duration;
    }

    async measure<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
        this.start(name, metadata);
        try {
            const result = await fn();
            this.end(name);
            return result;
        } catch (error) {
            this.end(name);
            throw error;
        }
    }

    getMetrics(name?: string): PerformanceMetric[] {
        if (name) {
            return this.metrics.filter(m => m.name === name);
        }
        return [...this.metrics];
    }

    getAverageDuration(name: string): number {
        const metrics = this.getMetrics(name);
        if (metrics.length === 0) {
            return 0;
        }
        const total = metrics.reduce((sum, m) => sum + m.duration, 0);
        return total / metrics.length;
    }

    getStats(name: string): {
        count: number;
        average: number;
        min: number;
        max: number;
        total: number;
    } {
        const metrics = this.getMetrics(name);

        if (metrics.length === 0) {
            return { count: 0, average: 0, min: 0, max: 0, total: 0 };
        }

        const durations = metrics.map(m => m.duration);
        const total = durations.reduce((sum, d) => sum + d, 0);

        return {
            count: metrics.length,
            average: total / metrics.length,
            min: Math.min(...durations),
            max: Math.max(...durations),
            total
        };
    }

    clear(name?: string): void {
        if (name) {
            this.metrics = this.metrics.filter(m => m.name !== name);
        } else {
            this.metrics = [];
        }
    }

    getAllStats(): Map<string, ReturnType<typeof this.getStats>> {
        const names = new Set(this.metrics.map(m => m.name));
        const stats = new Map();

        for (const name of names) {
            stats.set(name, this.getStats(name));
        }

        return stats;
    }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * Decorator for measuring function performance
 */
export function measurePerformance(metricName?: string) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        const name = metricName || `${target.constructor.name}.${propertyKey}`;

        descriptor.value = async function (...args: any[]) {
            return performanceMonitor.measure(name, () => originalMethod.apply(this, args));
        };

        return descriptor;
    };
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;

    return function (...args: Parameters<T>) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
    fn: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean;

    return function (...args: Parameters<T>) {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}
