import { Address4 } from "ip-address";
import { long2ip } from "netmask";

type WorkerInput = {
    csvContent: string;
    aggregation: 'sum' | 'mean' | 'max' | 'min' | 'categorical';
    defaultValue: number;
    propagate: boolean;
    ignoreDefaultInAggregation: boolean;
};
export type AggregatorMapEntry =  { sum: number, count: number, min: number, max: number };
type RawBinAggregateEntry = {
    sum: number;
    count: number;
    min: number;
    max: number;
    weightedSum: number;
    coveredWeight: number;
};
const BATCH_SIZE = 10000;

// Helper to check if a value is effectively an integer
const isInt = (n: number) => n % 1 === 0;

self.onmessage = async (e: MessageEvent<WorkerInput>) => {
    const { csvContent, aggregation, defaultValue, propagate, ignoreDefaultInAggregation } = e.data;

    try {
        const lines = csvContent.split('\n');
        const totalLines = lines.length;
        
        // ----------------------------------------------------------------
        // Phase 1: First Scan - Analyze Data
        // ----------------------------------------------------------------
        self.postMessage({ type: 'progress', phase: 'Analyzing Data (1/2)', progress: 0 });

        let minVal = Infinity;
        let maxVal = -Infinity;
        let hasFloat = false;
        let maxNetmask = 0; // The finest granularity seen (numerically largest) 
        
        let globalMinIP: bigint | null = null;
        let globalMaxIP: bigint | null = null;
        
        // Store parsed lines to avoid re-parsing string in pass 2 (optional, trades memory for CPU) 
        // Given potentially large CSV, better to re-parse or store compact structs.
        // Let's re-parse to save memory, as CSV string is already in memory.

        let lastProgress = Date.now();

        for (let i = 0; i < totalLines; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('#')) continue;

            // Report progress periodically
            if (i % BATCH_SIZE === 0) {
                const now = Date.now();
                if (now - lastProgress > 100) {
                    self.postMessage({ type: 'progress', phase: 'Analyzing Data (1/2)', progress: i / totalLines });
                    lastProgress = now;
                    // Yield to event loop to allow message sending
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            const parts = line.split(',');
            if (parts.length < 2) continue;

            const ipStr = parts[0].trim();
            const valStr = parts[1].trim();
            const val = parseFloat(valStr);

            if (isNaN(val)) continue;

            // Stats
            if (val < minVal) minVal = val;
            if (val > maxVal) maxVal = val;
            if (!hasFloat && !isInt(val)) hasFloat = true;

            try {
                // Address4 handles CIDR e.g. "10.0.0.0/24" or "10.0.0.1" (implicit /32)
                const addr = new Address4(ipStr);
                
                // subnetMask is e.g. 24
                const mask = addr.subnetMask;
                if (mask > maxNetmask) maxNetmask = mask;

                const startBig = addr.startAddress().bigInt();
                const endBig = addr.endAddress().bigInt();

                if (globalMinIP === null || startBig < globalMinIP) globalMinIP = startBig;
                if (globalMaxIP === null || endBig > globalMaxIP) globalMaxIP = endBig;

            } catch {
                console.warn("IP column contains non-IP value ", ipStr, "Skipping...")
            }
        }

        if (globalMinIP === null || globalMaxIP === null) {
            throw new Error("No valid data found");
        }

        // ----------------------------------------------------------------
        // Determine Structure
        // ----------------------------------------------------------------
        
        // Calculate Covering Prefix
        // Find bit length of difference
        const diff = globalMaxIP ^ globalMinIP;
        let commonPrefixLen = 32;
        if (diff !== 0n) {
             // Calculate number of bits needed to cover the diff
             // We can use string representation of binary if needed, or loop.
             // Or `diff.toString(2).length`.
             const diffBits = diff.toString(2).length;
             commonPrefixLen = 32 - diffBits;
        }

        // The covering prefix base must be masked
        // coveringPrefixLen is e.g. 8. 
        // But we need to handle the case where min/max span across boundaries.
        // XOR gives the first bit that differs. All bits before that are same.
        
        const coveringMask = (0xFFFFFFFFn << BigInt(32 - commonPrefixLen)) & 0xFFFFFFFFn;
        const baseIP = globalMinIP & coveringMask;
        
        // arraySize = 2 ^ (maxNetmask - commonPrefixLen)
        // e.g. cover /24, max /32 -> 2^(32-24) = 256
        const observedMaxNetmask = maxNetmask;
        const exponent = maxNetmask - commonPrefixLen;
        let resolutionWasClamped = false;
        
        // Safety check for size
        if (exponent > 24) {
                // Clamp resolution to keep size manageable (max 16M entries)
                maxNetmask = commonPrefixLen + 24;
            resolutionWasClamped = true;
                // re-calculate exponent
                // exponent = 24;
        }
        
        const size = Math.pow(2, maxNetmask - commonPrefixLen);
        
        // Select Array Type        
        let RawArrayType: Int8ArrayConstructor 
        | Uint8ArrayConstructor 
        | Int16ArrayConstructor 
        | Uint16ArrayConstructor 
        | Int32ArrayConstructor 
        | Uint32ArrayConstructor 
        | Float32ArrayConstructor
         = Float32Array;

        if (!hasFloat && !(resolutionWasClamped && aggregation === 'mean')) {
            // Check range
            if (minVal >= -128 && maxVal <= 127) RawArrayType = Int8Array;
            else if (minVal >= 0 && maxVal <= 255) RawArrayType = Uint8Array;
            else if (minVal >= -32768 && maxVal <= 32767) RawArrayType = Int16Array;
            else if (minVal >= 0 && maxVal <= 65535) RawArrayType = Uint16Array;
            else if (minVal >= -2147483648 && maxVal <= 2147483647) RawArrayType = Int32Array;
            else if (minVal >= 0 && maxVal <= 4294967295) RawArrayType = Uint32Array;

        }
        
        const raw = new RawArrayType(size);
        if (defaultValue !== 0) raw.fill(defaultValue);

        // ----------------------------------------------------------------
        // Phase 2: Populate Array
        // ----------------------------------------------------------------
        self.postMessage({ type: 'progress', phase: 'Populating Data (2/2)', progress: 0 });
        
        // We want to generate maps for zoom levels coarser than maxNetmask.
        // We dont need lookups for the last couple of steps, we can just calculate those on the fly

        const tempMaps: Record<number, Record<string, AggregatorMapEntry>> = {};
        for (let l = commonPrefixLen; l < maxNetmask - 6; l += 2) {
            tempMaps[l] = {};
        }
        if (resolutionWasClamped) {
            // Needed so values finer than the clamped resolution can still be aggregated correctly at raw resolution.
            tempMaps[maxNetmask] = {};
        }
        const rawBinAggregates: Record<number, RawBinAggregateEntry> = {};
        const resolutionShift = BigInt(32 - maxNetmask);

        // Helper to get prefix string
        const getPrefix = (idx: number, level: number): string => {
            const safeIdx = Math.trunc(idx);
            // Reconstruct IP from index
            const ipBig = baseIP + (BigInt(safeIdx) << resolutionShift);
            // Mask for level
            const mask = (0xFFFFFFFFn << BigInt(32 - level)) & 0xFFFFFFFFn;
            const netBig = ipBig & mask;
            // Convert to string
            //const addr = Address4.fromBigInt(netBig);
            //return addr.correctForm() + '/' + level;
            const addr = long2ip(Number(netBig));
            return addr + '/' + level;
        };
        

        for (let i = 0; i < totalLines; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('#')) continue;

            if (i % BATCH_SIZE === 0) {
                 const now = Date.now();
                 if (now - lastProgress > 100) {
                     self.postMessage({ type: 'progress', phase: 'Populating Data (2/2)', progress: i / totalLines });
                     lastProgress = now;

                     // This yields the event loop once, to allow for the message to be posted
                     await new Promise(r => setTimeout(r, 0));
                 }
            }

            const parts = line.split(',');
            if (parts.length < 2) continue;
            const ipStr = parts[0].trim();
            const val = parseFloat(parts[1].trim());
            if (isNaN(val)) continue;

            try {
                const addr = new Address4(ipStr);
                const startBig = addr.startAddress().bigInt();
                const endBig = addr.endAddress().bigInt();
                const mask = addr.subnetMask;
                

                const updateTempMap = (val: number , level: number, key: string, count=1) => {
                     if (!tempMaps[level][key]) {
                        tempMaps[level][key] = { sum: 0, count: 0, min: Infinity, max: -Infinity };
                    }

                    const entry = tempMaps[level][key];
                    entry.sum += val;
                    // only add half to the level above
                    entry.count += count;
                    if (val < entry.min) entry.min = val;
                    if (val > entry.max) entry.max = val;
                } 
                // Calculate indices in our array
                // The array represents the range [baseIP, baseIP + size << resolutionShift]
                // Each index represents a block of size `2^(32 - maxNetmask)`.
                // Actually each index represents `1 << (32 - maxNetmask)` addresses.
                // We map IP X to index: (X - baseIP) >> (32 - maxNetmask).
                
                // If the input is less granular than maxNetmask (e.g. input /24, max /32)
                // We cover a range of indices.
                
                const startIndex = Number((startBig - baseIP) >> resolutionShift);
                const endIndex = Number((endBig - baseIP) >> resolutionShift);
                
                // Check bounds (should be within, but input might have outliers outside calculated cover if logic flawed?)
                // Since we calculated cover based on min/max, it should fit.
                
                if (startIndex < 0 || endIndex >= size) continue; // Should not happen

                // Propagate logic
                if (mask < maxNetmask) {
                    // Larger block than resolution
                    if (propagate) {
                        // Fill all children
                        for (let k = startIndex; k <= endIndex; k++) {
                            raw[k] = val;

                            if (ignoreDefaultInAggregation && val === defaultValue) continue; 
                                       
                            for (const levelStr in tempMaps) {
                                const level = parseInt(levelStr, 10);
            
                                const key = getPrefix(k, level);
                                updateTempMap(val, level, key);
                            }
                        }
                    } else {
                        // If propagate is not on, we assume that the value in the csv is already the aggregated value for that level
                        for (const levelStr in tempMaps) {
                            const level = parseInt(levelStr, 10);
                            // Since propagation is turned off, we do not update more specific maps
                            if (level > mask) continue;

                            const key = getPrefix(startIndex, level);
                            
                            // We need to check if we are between two maps with this prefix
                            // Example: maxNetmask = 24, and mask = 21
                            // we want to update two /22 maps 
                            // and the /20 map as 1/2 of a value
                            // This if will trigger at level 20 
                            if (level + 2 > mask && mask % 2 === 1) {
                                const keyLowerPart = getPrefix(startIndex, level + 2);

                                // Add to the lower /22 a complete one 
                                updateTempMap(val, level + 2, keyLowerPart, 2**(maxNetmask - (level + 2)));
                                
                                // Calculate index for upper /22, add as complete one
                                const indexUpperPart = startIndex + Math.floor((endIndex - startIndex + 1) / 2);
                                const keyUpperPart = getPrefix(indexUpperPart, level + 2);
                                updateTempMap(val, level + 2, keyUpperPart, 2**(maxNetmask - (level + 2)));

                                // Half a /20
                                updateTempMap(val, level, key, 2**(maxNetmask - mask - 1));
                        
                            } else {
                                updateTempMap(val, level, key, 2**(maxNetmask - mask));
                            }

                        }
                
                    }
                } else if (mask > maxNetmask) {
                    // Finer block than our storage resolution (can happen when resolution is clamped).
                    // We track weighted contributions by covered fraction of the raw bin.
                    for (let k = startIndex; k <= endIndex; k++) {
                        if (ignoreDefaultInAggregation && val === defaultValue) continue;

                        if (!rawBinAggregates[k]) {
                            rawBinAggregates[k] = {
                                sum: 0,
                                count: 0,
                                min: Infinity,
                                max: -Infinity,
                                weightedSum: 0,
                                coveredWeight: 0
                            };
                        }

                        const rawEntry = rawBinAggregates[k];
                        const coverageWeight = Math.pow(2, maxNetmask - mask);
                        rawEntry.sum += val;
                        rawEntry.count += 1;
                        if (val < rawEntry.min) rawEntry.min = val;
                        if (val > rawEntry.max) rawEntry.max = val;
                        rawEntry.weightedSum += val * coverageWeight;
                        rawEntry.coveredWeight += coverageWeight;

                        for (const levelStr in tempMaps) {
                            const level = parseInt(levelStr, 10);
                            const key = getPrefix(k, level);
                            updateTempMap(val, level, key);
                        }
                    }
                } else {
                    // mask == maxNetmask
                    // Just set the value
                    raw[startIndex] = val;
                    
                    if (ignoreDefaultInAggregation && val === defaultValue) continue; 
                                       
                    for (const levelStr in tempMaps) {
                        const level = parseInt(levelStr, 10);
    
                        const key = getPrefix(startIndex, level);
                        
                        if (!tempMaps[level][key]) {
                            tempMaps[level][key] = { sum: 0, count: 0, min: Infinity, max: -Infinity };
                        }
    
                        const entry = tempMaps[level][key];
                        entry.sum += val;
                        entry.count += 1;
                        if (val < entry.min) entry.min = val;
                        if (val > entry.max) entry.max = val;
                    }
                }

            } catch (e) {
                console.error(e)
            }
        }

        for (const indexStr in rawBinAggregates) {
            const index = parseInt(indexStr, 10);
            const entry = rawBinAggregates[index];
            const baseValue = Number(raw[index]);
            if (aggregation === 'sum') {
                raw[index] = baseValue + entry.sum;
                continue;
            }

            if (aggregation === 'max') {
                raw[index] = entry.count > 0 ? Math.max(baseValue, entry.max) : baseValue;
                continue;
            }

            if (aggregation === 'min') {
                raw[index] = entry.count > 0 ? Math.min(baseValue, entry.min) : baseValue;
                continue;
            }

            if (aggregation === 'mean') {
                const coveredWeight = Math.min(entry.coveredWeight, 1);
                if (entry.coveredWeight > 1) {
                    raw[index] = entry.weightedSum / entry.coveredWeight;
                } else {
                    raw[index] = (baseValue * (1 - coveredWeight)) + entry.weightedSum;
                }
                continue;
            }

            // categorical fallback when clamped finer values are mixed
            raw[index] = entry.count > 0 && entry.min !== entry.max ? defaultValue : entry.min;
        }

        self.postMessage({
            type: 'result',
            raw,
            tempMaps,
            metadata: {
                minVal,
                maxVal,
                baseIP: baseIP.toString(), // BigInt to string
                resolution: maxNetmask,
                coveringPrefix: Address4.fromBigInt(baseIP).correctForm() + '/' + commonPrefixLen,
                hasFloat: hasFloat || (resolutionWasClamped && aggregation === 'mean') || observedMaxNetmask > maxNetmask
            }
        }, { transfer: [raw.buffer] });

    } catch (e) {
        console.error(e);
        self.postMessage({ type: 'error', message: (e as Error).message });
    }
};
