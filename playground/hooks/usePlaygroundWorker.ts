import { useState, useEffect, useCallback } from 'react';
import Worker from '../worker?worker';

export type PlaygroundData = {
    raw: Float32Array | Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array;
    maps: Record<number, Record<string, number>>;
    metadata: {
        minVal: number;
        maxVal: number;
        baseIP: string;
        resolution: number;
        coveringPrefix: string;
        hasFloat: boolean;
    };
};

export type ProgressData = {
    phase: string;
    progress: number;
};

export function usePlaygroundWorker() {
    const [worker, setWorker] = useState<Worker | null>(null);
    const [data, setData] = useState<PlaygroundData | null>(null);
    const [progress, setProgress] = useState<ProgressData | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const workerInstance = new Worker();
        setWorker(workerInstance);

        workerInstance.onmessage = function (e) {
            const msg = e.data;
            if (msg.type === 'progress') {
                setProgress({ phase: msg.phase, progress: msg.progress });
            } else if (msg.type === 'result') {
                setIsParsing(false);
                setData({
                    raw: msg.raw,
                    maps: msg.maps,
                    metadata: msg.metadata
                });
            } else if (msg.type === 'error') {
                setIsParsing(false);
                setError(msg.message);
            }
        };

        return () => {
            workerInstance.terminate();
        };
    }, []);

    const parseData = useCallback((csvContent: string, defaultValue: number, propagate: boolean, aggregation: string, ignoreDefaultInAggregation: boolean) => {
        if (worker) {
            setIsParsing(true);
            setProgress({ phase: 'Starting', progress: 0 });
            setError(null);
            worker.postMessage({ csvContent, defaultValue, propagate, aggregation, ignoreDefaultInAggregation });
        }
    }, [worker]);

    return { data, isParsing, progress, error, parseData };
}