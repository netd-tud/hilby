import { useState, useEffect, useCallback } from 'react';
import { Address6 } from 'ip-address';
import Worker from '../parse-api-data?worker';

export type UsedData = { maps: Record<number, Record<string, number>>, raw: Uint8Array } | Address6[];

/**
 * Custom hook to manage the Web Worker for parsing IP data.
 * Handles worker instantiation, message processing, and cleanup.
 */
export function useHilbyWorker() {
    const [worker, setWorker] = useState<Worker | null>(null);
    const [usedData, setUsedData] = useState<UsedData | null>(null);
    const [noData, setNoData] = useState(false);
    const [parsing, setParsing] = useState(false);

    useEffect(() => {
        const workerInstance = new Worker();
        setWorker(workerInstance);

        workerInstance.onmessage = function (e) {
            setParsing(false);
            if (e.data.ipv6) {
                const collection: Address6[] = [];
                if (e.data.data.length === 0) {
                    setNoData(true);
                } else {
                    setNoData(false);
                }

                for (const ip of e.data.data) {
                    collection.push(new Address6(ip));
                }
                setUsedData(collection);
            } else {
                if (e.data.data.raw.length === 0) {
                    setNoData(true);
                } else {
                    setNoData(false);
                }

                setUsedData(e.data.data);
            }
        };

        return () => {
            workerInstance.terminate();
        };
    }, []);

    const processData = useCallback((data: string[], ipv6: boolean) => {
        if (worker) {
            setParsing(true);
            worker.postMessage({ source: "hilby-app", ipv6: ipv6, data: data });
        }
    }, [worker]);

    return { usedData, setUsedData, noData, parsing, processData };
}
