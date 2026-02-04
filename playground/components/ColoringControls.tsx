import { Stack, Text, SegmentedControl, NumberInput, Group, ColorInput } from '@mantine/core';
import { useThrottledCallback } from '@mantine/hooks';
import { Scale } from 'chroma-js';
import { useState } from 'react';
import { Legend } from './Legend';

interface ColoringControlsProps {
    colorScale: Scale;
    onColorsChange: (colors: string[]) => void;
    bucketCount: number | null;
    onBucketCountChange: (count: number | null) => void;
}

export function ColoringControls({ 
    colorScale, 
    onColorsChange, 
    bucketCount, 
    onBucketCountChange 
}: ColoringControlsProps) {
    
    // Default initial state
    const [mode, setMode] = useState<'default' | 'custom'>('default');
    const [startColor, setStartColor] = useState('#fafa6e');
    const [endColor, setEndColor] = useState('#2A4858');

    // Update parent at most every 25ms (40fps) to prevent crash
    const throttledUpdateParent = useThrottledCallback((colors: string[]) => {
        onColorsChange(colors);
    }, 25);

    const bucketMode = bucketCount === null ? 'default' : 'custom';

    const handleModeChange = (val: string) => {
        if (val === 'default') {
            setMode('default');
            onColorsChange(["green", "yellow", "red"]);
        } else {
            setMode('custom');
            onColorsChange([startColor, endColor]);
        }
    };

    const handleBucketModeChange = (val: string) => {
        if (val === 'default') {
            onBucketCountChange(null);
        } else {
            onBucketCountChange(25);
        }
    };

    const handleColorChange = (pos: 'start' | 'end', val: string) => {
        let newStart = startColor;
        let newEnd = endColor;

        if (pos === 'start') {
            setStartColor(val);
            newStart = val;
        } else {
            setEndColor(val);
            newEnd = val;
        }
        
        if (mode === 'custom') {
            throttledUpdateParent([newStart, newEnd]);
        }
    };

    return (
        <>
            <Legend scale={colorScale} />
            <Stack gap="xs" mt="xs">
                <Text size="sm" fw={500}>Coloring</Text>
                <SegmentedControl
                    value={mode}
                    onChange={handleModeChange}
                    data={[
                        { label: 'Default', value: 'default' },
                        { label: 'Custom', value: 'custom' },
                    ]}
                />
                
                <Text size="sm" fw={500}>Number of buckets</Text>
                <SegmentedControl
                    value={bucketMode}
                    onChange={handleBucketModeChange}
                    data={[
                        { label: 'Default', value: 'default' },
                        { label: 'Custom', value: 'custom' },
                    ]}
                />
                <NumberInput
                    label="Buckets"
                    value={bucketCount ?? 25}
                    onChange={(val) => onBucketCountChange(Number(val))}
                    min={2}
                    max={250}
                    step={1}
                    disabled={bucketMode === "default"}
                />

                {mode === 'custom' && (
                    <Group grow>
                        <ColorInput 
                            label={
                                <Group gap={5} align="center">
                                    <Text size="sm">Min Color</Text>
                                </Group>
                            }
                            placeholder="Min Color" 
                            value={startColor} 
                            onChange={(val) => handleColorChange('start', val)} 
                            format="hex"
                            swatches={['#fafa6e', '#2A4858', '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF']}
                        />
                        <ColorInput 
                            label={
                                <Group gap={5} align="center">
                                    <Text size="sm">Max Color</Text>
                                </Group>
                            }
                            placeholder="Max Color" 
                            value={endColor} 
                            onChange={(val) => handleColorChange('end', val)} 
                            format="hex"
                            swatches={['#fafa6e', '#2A4858', '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF']}
                        />
                    </Group>
                )}
            </Stack>
        </>
    );
}