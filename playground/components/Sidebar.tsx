import { FileButton, Button, NativeSelect, NumberInput, Checkbox, Group, Stack, Text, Title, Box, ActionIcon, Tooltip } from '@mantine/core';
import { useState } from 'react';
import { Scale } from 'chroma-js';
import { FaQuestionCircle, FaInfoCircle } from 'react-icons/fa';
import { ColoringControls } from './ColoringControls';

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
    onColorsChange: (colors: string[]) => void;
    bucketCount: number | null;
    onBucketCountChange: (count: number | null) => void;
}

export function Sidebar({ onUpload, onSettingsChange, onExpand, onReset, onOpenTutorial, parsing, isExpanded, hasData, metadata, colorScale, onColorsChange, bucketCount, onBucketCountChange }: SidebarProps) {
    const [file, setFile] = useState<File | null>(null);
    const [aggregation, setAggregation] = useState<'sum' | 'mean' | 'max' | 'min'>('mean');
    const [defaultValue, setDefaultValue] = useState<number>(0);
    const [propagate, setPropagate] = useState<boolean>(true);
    const [ignoreDefaultInAggregation, setIgnoreDefaultInAggregation] = useState<boolean>(true);

    const [committedSettings, setCommittedSettings] = useState({
        aggregation: 'mean',
        defaultValue: 0,
        propagate: true,
        ignoreDefaultInAggregation: true
    });

    const isSettingsDirty = 
        aggregation !== committedSettings.aggregation ||
        defaultValue !== committedSettings.defaultValue ||
        propagate !== committedSettings.propagate ||
        ignoreDefaultInAggregation !== committedSettings.ignoreDefaultInAggregation;

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
        if (updates.aggregation) {
            setAggregation(updates.aggregation);
            const newCommitted = { ...committedSettings, aggregation: updates.aggregation };
            setCommittedSettings(newCommitted);
            onSettingsChange({
                ...newCommitted,
                defaultValue: committedSettings.defaultValue,
                propagate: committedSettings.propagate,
                ignoreDefaultInAggregation: committedSettings.ignoreDefaultInAggregation
            });
        }
        
        if (updates.defaultValue !== undefined) setDefaultValue(updates.defaultValue);
        if (updates.propagate !== undefined) setPropagate(updates.propagate);
        if (updates.ignoreDefaultInAggregation !== undefined) setIgnoreDefaultInAggregation(updates.ignoreDefaultInAggregation);
    };

    const applySettings = () => {
        const newSettings = {
            aggregation,
            defaultValue,
            propagate,
            ignoreDefaultInAggregation
        };
        onSettingsChange(newSettings);
        setCommittedSettings(newSettings);
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
                {isSettingsDirty && (
                    <Button onClick={applySettings} variant="light" color="blue" fullWidth mt="xs" loading={parsing}>
                        Apply Settings
                    </Button>
                )}
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
                        <ColoringControls 
                            colorScale={colorScale}
                            onColorsChange={onColorsChange}
                            bucketCount={bucketCount}
                            onBucketCountChange={onBucketCountChange}
                        />
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