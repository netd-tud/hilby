import { RenderFunction } from "../lib/main";
import { PlaygroundData, TypedArray } from "./hooks/usePlaygroundWorker";
import chroma from "chroma-js";

export type PlaygroundColorScale =
    | {
          kind: "continuous";
          scale: chroma.Scale<chroma.Color>;
          domain: number[];
          classes: number[] | false;
      }
    | {
          kind: "categorical";
          map: (val: number) => chroma.Color;
          values: number[];
            colorByValue: Record<string, string>;
      };

export const isContinuousColorScale = (
    scale: PlaygroundColorScale
): scale is Extract<PlaygroundColorScale, { kind: "continuous" }> => scale.kind === "continuous";
/**
 * Creates a render function that populates config.properties['value'] based on the playground data.
 */
export const createDataLookupFunction = (
    data: PlaygroundData | null,
    aggregation: 'sum' | 'mean' | 'max' | 'min' | 'categorical',
    defaultValueSettings: {
        defaultValue: number,
        ignoreDefaultInAggregation: boolean,
        mixedValue: number
    }
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
            const entry = maps[netmask][prefix];
               switch (aggregation) {
                    case 'sum': value = entry.sum; break;
                    case 'mean': value = entry.sum / entry.count; break;
                    case 'max': value = entry.max; break;
                    case 'min': value = entry.min; break;
                    case 'categorical': value = entry.min !== entry.max ? defaultValueSettings.mixedValue : entry.min; break;
                }
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
        // 3. We are in between the last map and the raw data. We perform the aggregation here.
        else {
            const baseIndex = Number((long - baseIP) >> resolutionShift);
            const nValues = 2**(resolution - netmask);
            let counter = 0;
            value = aggregation === "min" ? Infinity : 0;
            
            if (aggregation === 'categorical') {
                let firstVal: number | null = null;
                let isMixed = false;
                for (let i = 0; i < nValues; i++) {
                    const localValue = raw[baseIndex + i];
                    if (defaultValueSettings.ignoreDefaultInAggregation && localValue === defaultValueSettings.defaultValue) continue;
                    
                    if (firstVal === null) {
                        firstVal = localValue;
                    } else if (firstVal !== localValue) {
                        isMixed = true;
                        break;
                    }
                }
                if (isMixed) value = defaultValueSettings.mixedValue;
                else value = firstVal !== null ? firstVal : defaultValueSettings.defaultValue;
            } else {
                console.log(nValues)
                for (let i = 0; i < nValues; i++) {
                    const localValue = raw[baseIndex + i];
                    if (defaultValueSettings.ignoreDefaultInAggregation && localValue === defaultValueSettings.defaultValue) {
                        counter += 1;
                        continue;
                    }; 
                    switch (aggregation) {
                        case "sum": value += localValue; break;
                        case "mean": value += localValue; break;
                        case "max": value = Math.max(value, localValue); break;
                        case "min": value = Math.min(value, localValue); break;
                    }
                }
    
                if (aggregation === "mean") {
                    let fixedCount = nValues;
                    if (defaultValueSettings.ignoreDefaultInAggregation) {
                        fixedCount -= counter;
                    }
                    if (fixedCount != 0)
                        value = value / fixedCount;
                }
            }

        }

        config.properties['value'] = value;
    }
};

export const createColorScale = (
    raw: TypedArray, 
    defaultValue: number, 
    colors: string[] = ["green", "yellow", 'red'], 
    buckets: number | null = null,
    categoricalSettings?: {
        isCategorical: boolean,
        mixedValue: number,
        categoryColors?: Record<string, string>,
        ignoreDefaultInAggregation?: boolean
    }
): PlaygroundColorScale => {
    if (categoricalSettings?.isCategorical) {
        const uniqueValues = new Set<number>();
        if (categoricalSettings.mixedValue !== undefined) uniqueValues.add(categoricalSettings.mixedValue);
        
        for(let i=0; i<raw.length; i++) {
            const val = raw[i];
            if (categoricalSettings.ignoreDefaultInAggregation && val === defaultValue) continue;
            uniqueValues.add(val);
        }
        
        const sortedValues = Array.from(uniqueValues).sort((a,b) => a - b);
        
        let palette: string[];
        if (sortedValues.length <= 12) {
            palette = chroma.scale('Paired').mode('lch').colors(sortedValues.length);
        } else {
             palette = chroma.scale('Spectral').mode('lch').colors(sortedValues.length);
        }
        
        const colorMap = new Map<number, string>();
        sortedValues.forEach((v, i) => {
            const overrideColor = categoricalSettings.categoryColors?.[String(v)];
            colorMap.set(v, overrideColor ?? palette[i % palette.length]);
        });

        const colorByValue = Object.fromEntries(
            sortedValues.map((v) => [String(v), colorMap.get(v) ?? "#000000"])
        );

        return {
            kind: "categorical",
            values: sortedValues,
            colorByValue,
            map: (val: number) => chroma(colorMap.get(val) ?? "black")
        };
    }

    let samples: number[] = [];

    if (raw.length <= 1000) {
        samples = raw.map(v => Number(v)) as number[];
    } else {
        for (let i = 0; i <= raw.length; i += raw.length / 1000) {
            const value = raw[Math.floor(i)];
            if (value !== defaultValue)
                samples.push(value);
        }
    }

    if (buckets === null) {
        const domain = samples.sort((a,b) => a -b);
        return {
            kind: "continuous",
            domain,
            classes: false,
            scale: chroma.scale(colors).domain(domain)
        };
    }

    const limits = chroma.limits(samples.sort((a,b) => a -b), 'q', buckets);
    return {
        kind: "continuous",
        domain: [limits[0], limits.at(-1) ?? 1],
        classes: limits,
        scale: chroma.scale(colors).domain([limits[0], limits.at(-1) ?? 1]).classes(limits)
    };
}

/**
 * A render function that colors the subnet based on the 'value' property.
 */
export const createValueColoringFunction = (
    min: number,
    _max: number,
    quantileScales: Record<string, PlaygroundColorScale>
): RenderFunction => {
    const getColor = (scale: PlaygroundColorScale, value: number) => {
        if (scale.kind === "categorical") {
            return scale.map(value);
        }
        return scale.scale(value);
    };

    if (Object.keys(quantileScales).length === 1) {
        // we are not in a sum aggregation
        const quantileScale = quantileScales["raw"];

        return (_prefix, _long, _netmask, config) => {
            const value = config.properties['value'] as number;
            if (value === undefined) return;
    
            const color = getColor(quantileScale, value);
    
            // If value is effectively "zero" or "default", use a neutral color
            // (Note: user can define default, so we check against min/max if appropriate, 
            // but usually 0 is the "empty" signal)
            if (value === 0 && min !== 0) {
                config.style.backgroundColor = "#000000";
                config.style.color = "#FFFFFF";
                return;
            }
    
            config.style.backgroundColor = color.hex();
            
            // Text color for contrast
            config.style.color = color.luminance() < 0.5 ? 'white' : 'black';
        }
    } else {
         return (_prefix, _long, netmask, config) => {
            const value = config.properties['value'] as number;
            if (value === undefined) return;

            const quantileScale = quantileScales[netmask.toString()] ?? quantileScales["raw"];
    
            const color = getColor(quantileScale, value);
    
            // If value is effectively "zero" or "default", use a neutral color
            // (Note: user can define default, so we check against min/max if appropriate, 
            // but usually 0 is the "empty" signal)
            if (value === 0 && min !== 0) {
                config.style.backgroundColor = "#000000";
                config.style.color = "#FFFFFF";
                return;
            }
    
            config.style.backgroundColor = color.hex();
            
            // Text color for contrast
            config.style.color = color.luminance() < 0.5 ? 'white' : 'black';
        }
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