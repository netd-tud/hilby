import { AppShell, Container, Loader, Text, Progress, Box, ScrollArea } from '@mantine/core';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { InteractiveHilbert, useControlledHilbert, useEnableKeyBindings } from '../lib/main';
import { Sidebar } from './components/Sidebar';
import { usePlaygroundWorker } from './hooks/usePlaygroundWorker';
import { createDataLookupFunction, createValueColoringFunction, valueText, createColorScale } from './rendering-functions';
import { generateIPv4ExpansionPrefixes } from '@/utils/prefix-utils';
import './App.css';
import chroma from 'chroma-js';

function App() {
    const { data, isParsing, progress, parseData } = usePlaygroundWorker();
    const deferredData = useDeferredValue(data);

    const [hilbertStore, prefixManipulation, zoomManipulation] = useControlledHilbert();
    const [topPrefix, setTopPrefix, keyHandler] = useEnableKeyBindings(hilbertStore, { originalTopPrefix: "0.0.0.0/0" });

    const [collapseStatus, setCollapseStatus] = useState<boolean>(false);

    // Settings state
    const [aggregation, setAggregation] = useState<'sum' | 'mean' | 'max' | 'min'>('mean');
    const [defaultValue, setDefaultValue] = useState<number>(0);
    const [propagate, setPropagate] = useState<boolean>(true);
    const [ignoreDefaultInAggregation, setIgnoreDefaultInAggregation] = useState<boolean>(true);
    const [colors, setColors] = useState<string[]>(["green", "yellow", "red"]);

    // Prepare render functions
    const dataRenderer = useMemo(() => createDataLookupFunction(deferredData, 
        aggregation, 
        {
            defaultValue: defaultValue, 
            ignoreDefaultInAggregation: ignoreDefaultInAggregation
        }), 
        [deferredData, aggregation, defaultValue, ignoreDefaultInAggregation]
    );
    
    const colorScale = useMemo(() => {
        if (!deferredData) return null;
        
        console.log("Starting color")
        const rawScale = createColorScale(deferredData.raw, colors);
        const colorMaps: Record<string, chroma.Scale> = {};
        colorMaps["raw"] = rawScale;

        if (aggregation === "sum") {
            for (const map of Object.keys(deferredData.maps)) {
                let scale;
                if (Number(map) > deferredData.metadata.resolution - 8) {
                    // Approximate for the last layers for speed
                    scale = chroma.scale(colors).domain(rawScale.domain().map(v => v* 2**(deferredData.metadata.resolution - Number(map))))
                } else {
                    
                    const values = Object.values(deferredData.maps[Number(map)]).map(v => v.sum);

                    scale = createColorScale(values, colors);

                }
                colorMaps[map] = scale;
            }
        } 
        console.log("finished color")
        return colorMaps;

    }, [deferredData, colors, aggregation]);

    const visualRenderer = useMemo(() => {
        if (!deferredData || !colorScale) return () => {};

        return createValueColoringFunction(
            deferredData.metadata.minVal, 
            deferredData.metadata.maxVal, 
            colorScale
        );
    }, [deferredData, colorScale]);

    // We combine our data calculator + visualizers
    const renderFunctions = useMemo(() => [dataRenderer, visualRenderer, valueText], [dataRenderer, visualRenderer]);

    const handleExpandCollapse = () => {
        if (!collapseStatus) {
            const prefixes = generateIPv4ExpansionPrefixes();
            prefixManipulation.setPrefixSplit(prefixes, true);
            setCollapseStatus(true);
        } else {
            prefixManipulation.setPrefixSplit(topPrefix, false);
            setCollapseStatus(false);
        }
    };

    const handleSettingsChange = (settings: { aggregation: 'sum' | 'mean' | 'max' | 'min'; defaultValue: number; propagate: boolean; ignoreDefaultInAggregation: boolean; }) => {
        const returnVal = settings.aggregation === aggregation;

        setAggregation(settings.aggregation);
        setDefaultValue(settings.defaultValue);
        setPropagate(settings.propagate);
        setIgnoreDefaultInAggregation(settings.ignoreDefaultInAggregation);
        
        return returnVal;
    };

    const [lastContent, setLastContent] = useState<string | null>(null);

    const handleFullUpdate = (content: string, settings: { aggregation: 'sum' | 'mean' | 'max' | 'min'; defaultValue: number; propagate: boolean, ignoreDefaultInAggregation: boolean }) => {
        setLastContent(content);
        parseData(content, settings.defaultValue, settings.propagate, settings.ignoreDefaultInAggregation);
    }
    
    const onUpload = (content: string) => {
        handleFullUpdate(content, { aggregation, defaultValue, propagate, ignoreDefaultInAggregation });
    }

    const onSettingsUpdate = (settings: { aggregation: 'sum' | 'mean' | 'max' | 'min'; defaultValue: number; propagate: boolean, ignoreDefaultInAggregation: boolean }) => {
        const haveToReparse = handleSettingsChange(settings);
        if (lastContent && haveToReparse) {
            // Re-run worker
            parseData(lastContent, settings.defaultValue, settings.propagate, settings.ignoreDefaultInAggregation);
        }
    }

    useEffect(() => {
        if (data?.metadata.coveringPrefix)
            setTopPrefix(data?.metadata.coveringPrefix)   
    }, [data?.metadata.coveringPrefix, setTopPrefix])

    return (
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
                        parsing={isParsing}
                        isExpanded={collapseStatus}
                        hasData={!!data}
                        metadata={data?.metadata}
                        colorScale={colorScale ? colorScale["raw"]: null}
                        currentColors={colors}
                        onColorsChange={setColors}
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
    );
}

export default App;