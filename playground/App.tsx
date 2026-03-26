import { AppShell, Container, Loader, Text, Progress, Box, ScrollArea } from '@mantine/core';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { InteractiveHilbert, useControlledHilbert, useEnableKeyBindings } from '../lib/main';
import { Sidebar } from './components/Sidebar';
import { usePlaygroundWorker } from './hooks/usePlaygroundWorker';
import { createDataLookupFunction, createValueColoringFunction, valueText, createColorScale, isContinuousColorScale, PlaygroundColorScale } from './rendering-functions';
import { generateIPv4ExpansionPrefixes } from '@/utils/prefix-utils';
import TutorialModal from './components/TutorialModal';
import './App.css';
import chroma from 'chroma-js';

function App() {
    const { data, isParsing, progress, parseData } = usePlaygroundWorker();
    const deferredData = useDeferredValue(data);

    const [opened, { open, close }] = useDisclosure(false);

    useEffect(() => {
        const hasSeenTutorial = localStorage.getItem('playground_tutorial_seen');
        if (!hasSeenTutorial) {
            open();
            localStorage.setItem('playground_tutorial_seen', 'true');
        }
    }, [open]);

    const [hilbertStore, prefixManipulation, zoomManipulation, useHoveredPrefix] = useControlledHilbert();
    const hoveredPrefix = useHoveredPrefix();
    const [topPrefix, setTopPrefix, keyHandler] = useEnableKeyBindings(hilbertStore, { originalTopPrefix: "0.0.0.0/0" });

    const [collapseStatus, setCollapseStatus] = useState<boolean>(false);

    // Settings state
    const [aggregation, setAggregation] = useState<'sum' | 'mean' | 'max' | 'min' | 'categorical'>('mean');
    const [defaultValue, setDefaultValue] = useState<number>(0);
    const [mixedValue, setMixedValue] = useState<number>(-1);
    const [propagate, setPropagate] = useState<boolean>(true);
    const [ignoreDefaultInAggregation, setIgnoreDefaultInAggregation] = useState<boolean>(true);
    const [colors, setColors] = useState<string[]>(["green", "yellow", "red"]);
    const [bucketCount, setBucketCount] = useState<number| null>(null);
    const [categoryColors, setCategoryColors] = useState<Record<string, string>>({});

    // Prepare render functions
    const dataRenderer = useMemo(() => createDataLookupFunction(deferredData, 
        aggregation, 
        {
            defaultValue: defaultValue, 
            ignoreDefaultInAggregation: ignoreDefaultInAggregation,
            mixedValue: mixedValue
        }), 
        [deferredData, aggregation, defaultValue, ignoreDefaultInAggregation, mixedValue]
    );
    
    const colorScale = useMemo(() => {
        if (!deferredData) return null;

        const rawScale = createColorScale(
            deferredData.raw, 
            defaultValue, 
            colors, 
            bucketCount,
            {
                isCategorical: aggregation === 'categorical',
                mixedValue: mixedValue,
                categoryColors,
                ignoreDefaultInAggregation
            }
        );
        const colorMaps: Record<string, PlaygroundColorScale> = {};
        colorMaps["raw"] = rawScale;
        if (aggregation === "sum") {
            for (const map of Object.keys(deferredData.maps)) {
                let scale: PlaygroundColorScale;
                if (Number(map) > deferredData.metadata.resolution - 8) {
                    // Approximate for the last layers for speed
                    if (!isContinuousColorScale(rawScale)) {
                        continue;
                    }
                    const domain = rawScale.domain.map(v => v * 2**(deferredData.metadata.resolution - Number(map)));
                    scale = {
                        kind: "continuous",
                        domain,
                        classes: false,
                        scale: chroma.scale(colors).domain(domain)
                    };
                } else {

                    const rawValues = Object.keys(deferredData.maps[Number(map)])
                    let values: number[] = []
                    if (rawValues.length > 1000) {
                        for (let i = 0; i <= rawValues.length; i += rawValues.length / 1000) {
                            const value = deferredData.maps[Number(map)][rawValues[Math.floor(i)]]["sum"];
                            if (value !== defaultValue)
                                values.push(value);
                        }
                    } else {
                        values = rawValues.map(v => deferredData.maps[Number(map)][v].sum);
                    }
                    scale = createColorScale(values, defaultValue, colors, bucketCount);

                }
                colorMaps[map] = scale;
            }
        } 
        return colorMaps;

    }, [deferredData, colors, aggregation, defaultValue, bucketCount, mixedValue, categoryColors, ignoreDefaultInAggregation]);

    const handleCategoryColorChange = (value: number, color: string) => {
        setCategoryColors((prev) => ({
            ...prev,
            [String(value)]: color
        }));
    };

    const hoveredNetmask = useMemo(() => {
        const prefix = hoveredPrefix?.prefix;
        if (!prefix || !prefix.includes('/')) return null;

        const netmask = Number(prefix.split('/')[1]);
        if (!Number.isFinite(netmask)) return null;
        return netmask;
    }, [hoveredPrefix?.prefix]);

    const legendScaleInfo = useMemo(() => {
        if (!colorScale) {
            return { scale: null, contextLabel: undefined as string | undefined };
        }

        if (aggregation !== 'sum') {
            return { scale: colorScale["raw"], contextLabel: undefined as string | undefined };
        }

        if (hoveredNetmask !== null) {
            const hoveredScale = colorScale[String(hoveredNetmask)];
            if (hoveredScale) {
                return {
                    scale: hoveredScale,
                    contextLabel: `Values for hovered netmask /${hoveredNetmask}`
                };
            }

            const rawResolution = deferredData?.metadata.resolution;
            if (rawResolution !== undefined && hoveredNetmask >= rawResolution) {
                return {
                    scale: colorScale["raw"],
                    contextLabel: `Values for hovered netmask /${hoveredNetmask} (base scale)`
                };
            }
        }

        return {
            scale: colorScale["raw"],
            contextLabel: 'Hover a prefix to see legend values for its netmask'
        };
    }, [aggregation, colorScale, hoveredNetmask, deferredData?.metadata.resolution]);

    const visualRenderer = useMemo(() => {
        if (!deferredData || !colorScale) return () => {};
        return createValueColoringFunction(
            deferredData.metadata.minVal, 
            deferredData.metadata.maxVal, 
            ignoreDefaultInAggregation,
            defaultValue,
            colorScale
        );
    }, [deferredData, colorScale, ignoreDefaultInAggregation, defaultValue]);

    // We combine our data calculator + visualizers
    const renderFunctions = useMemo(() => [dataRenderer, visualRenderer, valueText], [dataRenderer, visualRenderer]);

    const handleExpandCollapse = () => {
        if (!collapseStatus) {
            const topNetmask = Number(deferredData?.metadata.coveringPrefix.split("/")[1])
            const prefixes = generateIPv4ExpansionPrefixes(topPrefix.split("/")[0], topNetmask, Math.min(deferredData?.metadata.resolution ?? Infinity, topNetmask + 8));
            prefixManipulation.setPrefixSplit(prefixes, true);
            setCollapseStatus(true);
        } else {
            prefixManipulation.setPrefixSplit(topPrefix, false);
            setCollapseStatus(false);
        }
    };

    const handleSettingsChange = (settings: { aggregation: 'sum' | 'mean' | 'max' | 'min' | 'categorical'; defaultValue: number; mixedValue: number; propagate: boolean; ignoreDefaultInAggregation: boolean; }) => {
        const shouldReparse =
            settings.aggregation !== aggregation
            || settings.defaultValue !== defaultValue
            || (settings.aggregation === 'categorical' && settings.mixedValue !== mixedValue)
            || settings.propagate !== propagate
            || settings.ignoreDefaultInAggregation !== ignoreDefaultInAggregation;

        setAggregation(settings.aggregation);
        setDefaultValue(settings.defaultValue);
        setMixedValue(settings.mixedValue);
        setPropagate(settings.propagate);
        setIgnoreDefaultInAggregation(settings.ignoreDefaultInAggregation);

        return shouldReparse;
    };

    const [lastContent, setLastContent] = useState<string | null>(null);

    const handleFullUpdate = (content: string, settings: { aggregation: 'sum' | 'mean' | 'max' | 'min' | 'categorical'; defaultValue: number; mixedValue: number; propagate: boolean, ignoreDefaultInAggregation: boolean }) => {
        handleSettingsChange(settings);
        setLastContent(content);
        parseData(content, settings.aggregation, settings.defaultValue, settings.mixedValue, settings.propagate, settings.ignoreDefaultInAggregation);
    }
    
    const onUpload = (content: string, settings: { aggregation: 'sum' | 'mean' | 'max' | 'min' | 'categorical'; defaultValue: number; mixedValue: number; propagate: boolean, ignoreDefaultInAggregation: boolean }) => {
        handleFullUpdate(content, settings);
    }

    const onSettingsUpdate = (settings: { aggregation: 'sum' | 'mean' | 'max' | 'min' | 'categorical'; defaultValue: number; mixedValue: number; propagate: boolean, ignoreDefaultInAggregation: boolean }) => {
        const haveToReparse = handleSettingsChange(settings);
        if (lastContent && haveToReparse) {
            // Re-run worker
            parseData(lastContent, settings.aggregation, settings.defaultValue, settings.mixedValue, settings.propagate, settings.ignoreDefaultInAggregation);
        }
    }

    useEffect(() => {
        if (data?.metadata.coveringPrefix)
            setTopPrefix(data?.metadata.coveringPrefix)   
    }, [data?.metadata.coveringPrefix, setTopPrefix])

    return (
        <>
            <AppShell
                padding="md"
                navbar={{ width: 400, breakpoint: 'sm' }}
            >
                <AppShell.Navbar>
                    <ScrollArea>
                        <Sidebar
                            onUpload={onUpload}
                            onSettingsChange={onSettingsUpdate}
                            onExpand={handleExpandCollapse}
                            onReset={() => {
                                zoomManipulation.resetZoom();
                                setCollapseStatus(false);
                            }}
                            onOpenTutorial={open}
                            parsing={isParsing}
                            isExpanded={collapseStatus}
                            hasData={!!data}
                            metadata={data?.metadata}
                            colorScale={legendScaleInfo.scale}
                            legendContextLabel={legendScaleInfo.contextLabel}
                            isCategorical={aggregation === 'categorical'}
                            categoryColors={categoryColors}
                            onCategoryColorChange={handleCategoryColorChange}
                            onColorsChange={setColors}
                            bucketCount={bucketCount}
                            onBucketCountChange={setBucketCount}
                        />
                    </ScrollArea>
                </AppShell.Navbar>

                <AppShell.Main>
                    <Container fluid h="100%" p={0} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                         <div className="hilbert-container" tabIndex={0} onKeyUp={keyHandler} style={{ flexGrow: 1, position: 'relative', height: "95vh" }}>
                            {isParsing && (
                                <Box style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.8)', zIndex: 10 }}>
                                    <Loader size="lg" />
                                    <Text mt="md" size="lg" fw={500}>{progress?.phase || 'Processing...'}</Text>
                                    <Box w={300} mt="md">
                                        <Progress value={(progress?.progress || 0) * 100} animated />
                                    </Box>
                                </Box>
                            )}
                            {!data && !isParsing && (
                                <Box style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                    <Text size="lg" c="dimmed">Upload a CSV file to visualize data.</Text>
                                </Box>
                            )}
                            <InteractiveHilbert 
                                topPrefix={topPrefix} 
                                renderFunctions={renderFunctions} 
                                hilbertStore={hilbertStore} 
                                maxExpand={24} 
                            />
                        </div>
                    </Container>
                </AppShell.Main>
            </AppShell>
            <TutorialModal opened={opened} close={close} />
        </>
    );
}

export default App;