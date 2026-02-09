import './App.css'

import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { AppShell, Container, Loader } from "@mantine/core";
import { useDebouncedCallback, useDisclosure, useDebouncedState } from '@mantine/hooks';
import { useQuery } from "@tanstack/react-query";
import { InteractiveHilbert, RenderFunction, useControlledHilbert, useEnableKeyBindings } from "../";
import { Address6 } from 'ip-address';

import { newAdd, coloring, getPercentage, createColorBasedOnDensity } from './rendering-functions';
import { getPeeringDBData, getAnnouncedPrefixes } from './parse-api-data';

import { baseColor } from './constants';
import TutorialModal from './TutorialModal';

import Header from './components/Header';
import Footer from './components/Footer';
import ControlPanel from './components/ControlPanel';
import { useHilbyWorker } from './hooks/useHilbyWorker';

function App() {

    const [opened, { open, close }] = useDisclosure(false);

    const [ipv6, setipv6] = useState(false);
    // Use custom hook for worker management
    const { usedData, setUsedData, noData, parsing, processData } = useHilbyWorker();

    const [selectedAS, setSelectedAS] = useDebouncedState("16509", 1000);
    const deferredUsedData = useDeferredValue(usedData);

    const [hilbertStore, prefixManipulation, zoomManipulation] = useControlledHilbert();
    const [topPrefix, setTopPrefix, keyHandler] = useEnableKeyBindings(hilbertStore, { originalTopPrefix: "0.0.0.0/0" });

    const [source, setSource] = useState<"ripe" | "routeviews">("routeviews");
    const [zoomTarget, setZoomTarget] = useState<string>("");
    const [zoomStatus, setZoomStatus] = useState<boolean>(true);
    const [collapseStatus, setCollapseStatus] = useState<boolean>(false);

    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [lockSource, setLockSource] = useState<boolean>(false);

    const debouncedGetName = useDebouncedCallback(getPeeringDBData, 1000);

    // Firefox can't draw fonts big enough to properly show the content of a prefix otherwise
    const maxExpand = navigator.userAgent.toLowerCase().includes("firefox") ? 20 : 24;

    // Calculate loading state
    let isLoading = true;
    if (usedData !== null) {
        if (ipv6) {
            isLoading = (usedData as Address6[]).length === 0 && !noData;
        } else {
            if (!Object.prototype.hasOwnProperty.call(usedData, "raw")) {
                isLoading = true;
            } else {
                isLoading = (usedData as { maps: Record<number, Record<string, number>>, raw: Uint8Array }).raw.length === 0;
            }
        }
    } else {
        isLoading = true;
    }

    const result = useQuery({
        queryKey: [selectedAS, source, selectedDate],
        queryFn: () => getAnnouncedPrefixes(source, selectedAS, selectedDate),
    })

    // Process data when query result changes
    useEffect(() => {
        if (!result.isSuccess || !result.data) return;
        processData(result.data, ipv6);
    }, [result.data, result.isSuccess, ipv6, processData]);

    const colorBasedOnDensity = useMemo(() => createColorBasedOnDensity(deferredUsedData, ipv6), [deferredUsedData, ipv6]);

    const renderFunctions: RenderFunction[] = useMemo(() => [newAdd, colorBasedOnDensity, coloring, getPercentage], [colorBasedOnDensity]);

    let parsingText = "";

    if (result.isFetching) {
        parsingText = "Fetching new data...";
    }
    if (parsing) {
        parsingText = "Parsing new data...";
    }

    const handleDateSelect = (value: string | null) => {
        if (value !== null) {
            setSource("ripe");
            setLockSource(true);
        } else {
            setLockSource(false);
        }
        console.log(value)
        setSelectedDate(value);
    }

    return (
        <>
            <AppShell >
                {/* Header Section */}
                <Header openTutorial={open} />

                <AppShell.Main>
                    {/* Control Panel */}
                    <Container size="xl" py="md">
                        <ControlPanel
                            dataSource={{
                                selectedAS,
                                setSelectedAS,
                                debouncedGetName,
                                selectedDate,
                                handleDateSelect,
                                source,
                                setSource,
                                lockSource,
                                ipv6,
                                setIpv6: setipv6
                            }}
                            mapControls={{
                                collapseStatus,
                                setCollapseStatus,
                                topPrefix,
                                setTopPrefix,
                                prefixManipulation,
                                zoomManipulation,
                                setUsedData
                            }}
                            search={{
                                target: zoomTarget,
                                setTarget: setZoomTarget,
                                status: zoomStatus,
                                setStatus: setZoomStatus
                            }}
                            ui={{
                                isLoading,
                                parsingText
                            }}
                        />
                    </Container>

                    {/* Main Hilbert Plot */}
                    <Container size="xl" style={{ flexGrow: 1 }} mb={"md"}>
                        <div className="hilbert-container" tabIndex={0} onKeyUp={keyHandler}>
                            {/* Hilbert plot content */}
                            {isLoading && <Loader color={baseColor} />}
                            {!isLoading && <InteractiveHilbert topPrefix={topPrefix} renderFunctions={renderFunctions} hilbertStore={hilbertStore} maxExpand={maxExpand} />}
                        </div>
                    </Container>
                </AppShell.Main>

                <Footer />
            </AppShell>
            <TutorialModal opened={opened} close={close} />
        </>
    )
}

export default App
