import { RenderFunction } from "../lib/main";
import { PlaygroundData } from "./hooks/usePlaygroundWorker";

/**
 * Creates a render function that populates config.properties['value'] based on the playground data.
 */
export const createDataLookupFunction = (
    data: PlaygroundData | null
): RenderFunction => {
    return (prefix: string, long: bigint, netmask: number, config) => {
        if (!data) return;
        
        const { raw, maps, metadata } = data;
        const baseIP = BigInt(metadata.baseIP);
        const resolution = metadata.resolution;
        const resolutionShift = BigInt(32 - resolution);

        let value = 0;

        // 1. Check if we have a pre-aggregated map for this level
        if (maps[netmask] && maps[netmask][prefix] !== undefined) {
            value = maps[netmask][prefix];
        } 
        // 2. If netmask is finer or equal to our resolution, look into the raw array
        else if (netmask >= resolution) {
            const index = Number((long - baseIP) >> resolutionShift);
            if (index >= 0 && index < raw.length) {
                value = raw[index];
            } else {
                // Out of range of our data
                value = 0; 
            }
        }
        // 3. Fallback: If we are at a level between map entries or if map is missing
        else {
            // Find the closest available finer level
            // In the worker, we currently generate all even levels < resolution.
            // If missing, we could aggregate on the fly, but for performance, 
            // the worker should ideally provide what's needed or we use a safe default.
            
            // If we are here, it means maps[netmask] didn't have the prefix.
            // This usually means the prefix is empty or outside our covering range.
            value = 0;
        }

        config.properties['value'] = value;
    }
};

/**
 * A render function that colors the subnet based on the 'value' property.
 */
export const createValueColoringFunction = (
    min: number,
    max: number,
): RenderFunction => {
    return (_prefix, _long, _netmask, config) => {
        const value = config.properties['value'] as number;
        if (value === undefined) return;

        // If value is effectively "zero" or "default", use a neutral color
        // (Note: user can define default, so we check against min/max if appropriate, 
        // but usually 0 is the "empty" signal)
        if (value === 0 && min !== 0) {
            config.style.backgroundColor = '#f8f9fa';
            config.style.color = '#dee2e6';
            return;
        }

        // Color Scale
        // We use a simple linear scale for now. 
        // 0% -> Blueish, 100% -> Redish
        const range = max - min || 1;
        const t = Math.max(0, Math.min(1, (value - min) / range));
        
        // Let's use HSL to create a nice gradient
        // Hue: 220 (blue) to 0 (red)
        const hue = 220 - (t * 220);
        // Lightness: higher value = slightly darker/richer?
        const lightness = 50 + ( (1-t) * 20 ); // 50% to 70%
        
        config.style.backgroundColor = `hsl(${hue}, 80%, ${lightness}%)`;
        
        // Text color for contrast
        config.style.color = lightness < 40 || hue < 40 ? 'white' : 'black';
    }
};

/**
 * A render function that adds text labels for the value.
 */
export const valueText: RenderFunction = (prefix, _long, netmask, config) => {
    const value = config.properties['value'] as number;
    
    config.innerContent.push(
        <div 
            key={prefix + "-p"} 
            style={{
                fontSize: "10cqw", 
                fontWeight: "500",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
            }}
        >
            {prefix}
        </div>
    );
    
    if (value !== undefined) {
        const displayValue = Number.isInteger(value) ? value.toString() : value.toFixed(2);
        config.innerContent.push(
            <div 
                key={prefix + "-val"} 
                style={{
                    fontSize: "8cqw", 
                    opacity: 0.8,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                }}
            >
                {displayValue}
            </div>
        );
    }
}