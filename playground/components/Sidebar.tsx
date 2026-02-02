import { FileButton, Button, NativeSelect, NumberInput, Checkbox, Group, Stack, Text, Title, Box, SegmentedControl, ColorInput, ActionIcon, Tooltip } from '@mantine/core';
import { useState, useEffect } from 'react';
import { Scale } from 'chroma-js';
import { FaQuestionCircle, FaInfoCircle } from 'react-icons/fa';
import { Legend } from './Legend';

interface SidebarProps {
    onUpload: (content: string) => void;
    onSettingsChange: (settings: { aggregation: 'sum' | 'mean' | 'max' | 'min'; defaultValue: number; propagate: boolean, ignoreDefaultInAggregation: boolean }) => void;
    onExpand: () => void;
    onReset: () => void;
    onOpenTutorial: () => void;
    parsing: boolean;
    isExpanded: boolean;
    hasData: boolean;
    metadata?: {
        minVal: number;
        maxVal: number;
        resolution: number;
        coveringPrefix: string;
    } | null;
    colorScale?: Scale | null;
    currentColors: string[];
    onColorsChange: (colors: string[]) => void;
}

export function Sidebar({ onUpload, onSettingsChange, onExpand, onReset, onOpenTutorial, parsing, isExpanded, hasData, metadata, colorScale, currentColors, onColorsChange }: SidebarProps) {
    const [file, setFile] = useState<File | null>(null);
    const [aggregation, setAggregation] = useState<'sum' | 'mean' | 'max' | 'min'>('mean');
    const [defaultValue, setDefaultValue] = useState<number>(0);
    const [propagate, setPropagate] = useState<boolean>(true);
    const [ignoreDefaultInAggregation, setIgnoreDefaultInAggregation] = useState<boolean>(true);

    const isDefaultColors = currentColors.length === 3 && currentColors[0] === 'green' && currentColors[1] === 'yellow' && currentColors[2] === 'red';
    const [mode, setMode] = useState<string>(isDefaultColors ? 'default' : 'custom');
    
    const [customStart, setCustomStart] = useState<string>(!isDefaultColors && currentColors.length >= 1 ? currentColors[0] : '#fafa6e');
    const [customEnd, setCustomEnd] = useState<string>(!isDefaultColors && currentColors.length >= 2 ? currentColors[currentColors.length - 1] : '#2A4858');

    useEffect(() => {
        if (isDefaultColors) {
            setMode('default');
        } else {
            setMode('custom');
            if (currentColors.length >= 1) setCustomStart(currentColors[0]);
            if (currentColors.length >= 2) setCustomEnd(currentColors[currentColors.length - 1]);
        }
    }, [currentColors, isDefaultColors]);

    const handleFileChange = (payload: File | null) => {
        setFile(payload);
        if (payload) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                onUpload(content);
            };
            reader.readAsText(payload);
        }
    };

    const handleSettingsUpdate = (updates: Partial<{ aggregation: 'sum' | 'mean' | 'max' | 'min'; defaultValue: number; propagate: boolean, ignoreDefaultInAggregation: boolean }>) => {
        const newSettings = {
            aggregation: updates.aggregation ?? aggregation,
            defaultValue: updates.defaultValue ?? defaultValue,
            propagate: updates.propagate ?? propagate,
            ignoreDefaultInAggregation: updates.ignoreDefaultInAggregation ?? ignoreDefaultInAggregation

        };
        
        if (updates.aggregation) setAggregation(updates.aggregation);
        if (updates.defaultValue !== undefined) setDefaultValue(updates.defaultValue);
        if (updates.propagate !== undefined) setPropagate(updates.propagate);
        if (updates.ignoreDefaultInAggregation !== undefined) setIgnoreDefaultInAggregation(updates.ignoreDefaultInAggregation);

        onSettingsChange(newSettings);
    };

    const handleModeChange = (val: string) => {
        setMode(val);
        if (val === 'default') {
            onColorsChange(["green", "yellow", "red"]);
        } else {
            onColorsChange([customStart, customEnd]);
        }
    };

    const handleCustomColorChange = (pos: 'start' | 'end', val: string) => {
        if (pos === 'start') {
            setCustomStart(val);
            onColorsChange([val, customEnd]);
        } else {
            setCustomEnd(val);
            onColorsChange([customStart, val]);
        }
    };

    const InfoTooltip = ({ label }: { label: string }) => (
        <Tooltip label={label} multiline w={250} withArrow transitionProps={{ transition: 'pop', duration: 200 }}>
            <ActionIcon variant="transparent" color="gray" size="xs">
                <FaInfoCircle />
            </ActionIcon>
        </Tooltip>
    );

    return (
        <Stack p="md" gap="lg">
            <Group justify="space-between" align="center">
                <Title order={3}>Playground</Title>
                <Tooltip label="Show Tutorial">
                    <ActionIcon variant="subtle" color="gray" onClick={onOpenTutorial} size="lg" aria-label="Help">
                        <FaQuestionCircle size={20} />
                    </ActionIcon>
                </Tooltip>
            </Group>

            <Stack gap="xs">
                <Group gap={5} align="center">
                    <Text fw={500}>Data Upload</Text>
                </Group>
                <FileButton onChange={handleFileChange} accept=".csv,text/csv">
                    {(props) => (
                        <Button {...props} loading={parsing}>Upload CSV</Button>
                    )}
                </FileButton>
                {file && <Text size="sm">Selected: {file.name}</Text>}
            </Stack>

            <Stack gap="xs">
                <Text fw={500}>Settings</Text>
                <NativeSelect
                    label={
                        <Group gap={5} align="center">
                            <Text size="sm">Aggregation</Text>
                            {/* <InfoTooltip label="Select the method used to aggregate values for less specific subnets." /> */}
                        </Group>
                    }
                    data={['mean', 'sum', 'max', 'min']}
                    value={aggregation}
                    onChange={(event) => handleSettingsUpdate({ aggregation: event.currentTarget.value as 'sum' | 'mean' | 'max' | 'min' })}
                    disabled={parsing}
                />
                <NumberInput
                    label={
                        <Group gap={5} align="center">
                            <Text size="sm">Default Value</Text>
                            {/* <InfoTooltip label="The value assigned to IP addresses or prefixes that are not present in the uploaded CSV." /> */}
                        </Group>
                    }
                    value={defaultValue}
                    onChange={(value) => handleSettingsUpdate({ defaultValue: Number(value) })}
                    disabled={parsing}
                />
                <Group gap={5} align="center">
                    <Checkbox
                        label="Propagate value to subnets"
                        checked={propagate}
                        onChange={(event) => handleSettingsUpdate({ propagate: event.currentTarget.checked })}
                        disabled={parsing}
                    />
                    <InfoTooltip label="If checked, a value assigned to a prefix (e.g., /24) will be applied to all subnets within that prefix." />
                </Group>
                <Group gap={5} align="center">
                    <Checkbox
                        label="Ignore Default Value in Aggregation"
                        checked={ignoreDefaultInAggregation}
                        onChange={(event) => handleSettingsUpdate({ ignoreDefaultInAggregation: event.currentTarget.checked })}
                        disabled={parsing}
                    />
                    <InfoTooltip label="If checked, the 'Default Value' will be excluded from aggregation calculations (e.g., calculating the mean)." />
                </Group>
            </Stack>

            {hasData && metadata && (
                <Stack gap="xs">
                    <Text fw={500}>Data Info</Text>
                    <Box p="xs" style={{ backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: '4px' }}>
                        <Text size="xs"><b>Covering:</b> {metadata.coveringPrefix}</Text>
                        <Text size="xs"><b>Resolution:</b> /{metadata.resolution}</Text>
                        <Text size="xs"><b>Range:</b> {metadata.minVal.toFixed(2)} - {metadata.maxVal.toFixed(2)}</Text>
                    </Box>
                    {colorScale && (
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
                                {mode === 'custom' && (
                                    <Group grow>
                                        <ColorInput 
                                            label={
                                                <Group gap={5} align="center">
                                                    <Text size="sm">Min Color</Text>
                                                </Group>
                                            }
                                            placeholder="Min Color" 
                                            value={customStart} 
                                            onChange={(val) => handleCustomColorChange('start', val)} 
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
                                            value={customEnd} 
                                            onChange={(val) => handleCustomColorChange('end', val)} 
                                            format="hex"
                                            swatches={['#fafa6e', '#2A4858', '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF']}
                                        />
                                    </Group>
                                )}
                            </Stack>
                        </>
                    )}
                </Stack>
            )}

            <Stack gap="xs">
                <Group gap={5} align="center">
                    <Text fw={500}>Controls</Text>
                </Group>
                <Stack gap="xs">
                    <Group grow>
                        <Button onClick={onExpand} variant="filled">{isExpanded ? "Collapse to base" : "Expand by 8"}</Button>
                        <Button onClick={onReset} variant="outline">Reset Zoom</Button>
                    </Group>
                </Stack>
            </Stack>
        </Stack>
    );
}