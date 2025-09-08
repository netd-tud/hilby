import './App.css'

import { useCallback, useDeferredValue, useEffect, useState } from 'react'
import { AppShell, Button, Container, Divider, Group, Image, Input, Loader, Paper, Switch, Text, Title, Stack } from "@mantine/core";
import { useDebouncedState, useDisclosure } from '@mantine/hooks';
import { ip2long, long2ip } from 'netmask';
import { useQuery } from "@tanstack/react-query";
import { InteractiveHilbert, RenderFunction, useControlledHilbert, useEnableKeyBindings } from "../";
import { FaBook, FaGithub, FaInfoCircle } from "react-icons/fa";
import { Address6 } from 'ip-address';

import Worker from './parse-api-data?worker';

import { newAdd, coloring, getPercentage } from './rendering-functions';

import ripeLogo from "./ripe_stat_logo.png";
import routeviewsLogo from "./routeviews_logo.png";

import { baseColor } from './constants';
import Legend from './Legend';
import TutorialModal from './TutorialModal';

function App() {

    const [opened, { open, close }] = useDisclosure(false);

    const [ipv6, setipv6] = useState(false);
    const [worker, setWorker] = useState<Worker | null>(null);
    const [usedData, setUsedData] = useState<{ maps: Record<number, Record<string, number>>, raw: Uint8Array } | Address6[] | null>(null);

    const [selectedAS, setSelectedAS] = useDebouncedState("16509", 1000);
    const deferredUsedData = useDeferredValue(usedData);

    const [hilbertStore, prefixManipulation, zoomManipulation, _useHoveredPrefix] = useControlledHilbert();
    const [topPrefix, setTopPrefix] = useEnableKeyBindings(hilbertStore, { originalTopPrefix: "0.0.0.0/0" });

    const [noData, setNoData] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [source, setSource] = useState<"ripe" | "routeviews">("routeviews");
    const [zoomTarget, setZoomTarget] = useState<string>("");
    const [zoomStatus, setZoomStatus] = useState<boolean>(true);
    const [collapseStatus, setCollapseStatus] = useState<boolean>(false);

    // Firefox can't draw fonts big enough to properly show the content of a prefix otherwise
    const maxExpand = navigator.userAgent.toLowerCase().includes("firefox") ? 20 : 24;

    let isLoading = true;

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
    }, [setNoData, setUsedData]);

    if (usedData !== null) {
        if (ipv6) {
            isLoading = (usedData as Address6[]).length === 0 && !noData;
        } else {
            if (!usedData.hasOwnProperty("raw")) {
                isLoading = true;
            } else {

                isLoading = (usedData as { maps: Record<number, Record<string, number>>, raw: Uint8Array }).raw.length === 0;
            }
        }
    } else {
        isLoading = true;
    }

    const getAnnouncedPrefixes = useCallback(async (as: string): Promise<string[]> => {

        if (source === "routeviews") {
            const response = await fetch(`https://api.routeviews.org/guest/asn/${as}`);
            return await response.json();
        }
        if (source === "ripe") {
            const response = await fetch(`https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS${as}`)
            const parsedResponse = await response.json();

            return parsedResponse["data"]["prefixes"].map((v: { prefix: string }) => v["prefix"]);
        }
        return [];

    }, [source])

    const result = useQuery({
        queryKey: [selectedAS, source],
        queryFn: () => getAnnouncedPrefixes(selectedAS),
    })

    useEffect(() => {
        if (!result.isSuccess) return;
        setParsing(true);
        worker?.postMessage({ ipv6: ipv6, data: result.data });
    }, [result.data, result.isSuccess, ipv6, worker]);

    const colorBasedOnDensity: RenderFunction = useCallback((prefix: string, long: bigint, netmask: number, config) => {
        if (deferredUsedData === null || deferredUsedData === undefined) return;

        let maxNumberOfSubnets = 0;
        let actualNumberOfSubnets = 0;

        if (!ipv6) {
            // Required since we might be called in the transition from IPv6 to IPv4
            if (prefix.includes(":")) return;

            const data = deferredUsedData as { maps: Record<number, Record<string, number>>, raw: Uint8Array };
            if (!data.raw || data.raw.length === 0) return;

            if (netmask === 0) {
                for (const entry of Object.values(data.maps[2])) {
                    actualNumberOfSubnets += entry;
                }
            } else if (netmask < 18) {
                actualNumberOfSubnets = data.maps[netmask][prefix] ?? 0;
            } else {
                for (let i = 0; i < 2 ** (24 - netmask); i++) {
                    if (data.raw[Number((long >> 8n)) + i] === 1) {
                        actualNumberOfSubnets++;
                    }
                }
            }

            maxNumberOfSubnets = 2 ** (24 - netmask);

        } else {
            // Required since we might be called in the transition from IPv4 to IPv6
            if (!prefix.includes(":")) return;

            const data = deferredUsedData as Address6[];
            if (!data.length || data.length === 0) return;

            const address = new Address6(prefix);

            for (const dataPrefix of data) {

                if (dataPrefix.isInSubnet(address)) {
                    const n_of_48s = 2 ** (48 - dataPrefix.subnetMask)
                    actualNumberOfSubnets += n_of_48s;
                } else if (address.isInSubnet(dataPrefix)) {
                    actualNumberOfSubnets = 2 ** (48 - netmask);
                }
            }

            maxNumberOfSubnets = 2 ** (48 - netmask);
        }

        const normalizedValue = actualNumberOfSubnets / Math.max(maxNumberOfSubnets, 1);
        config.properties["subnets"] = normalizedValue;

    }, [deferredUsedData, isLoading, ipv6])

    const renderFunctions: RenderFunction[] = [newAdd, colorBasedOnDensity, coloring, getPercentage];

    let parsingText = "";

    if (result.isFetching) {
        parsingText = "Fetching new data...";
    }
    if (parsing) {
        parsingText = "Parsing new data...";
    }


    return (
        <>
            <AppShell >
                {/* Header Section */}
                <Container size="xl" py="md">
                    <Group justify="space-between">
                        <div>
                            <Title order={1}>Hilby</Title>
                            <Text c="dimmed" size="lg">Hilbert Interactive Prefix Plots</Text>
                        </div>
                        <Group justify="center">
                            <Group mr={"xl"}>
                                <Text size="md" mr={-15}>Live Data provided by</Text>
                                <a target="_blank" href="https://stat.ripe.net/">
                                    <Image src={ripeLogo} h={30} />
                                </a>
                                <a target="_blank" href="https://www.routeviews.org/routeviews/">
                                    <Image src={routeviewsLogo} h={30} />
                                </a>

                            </Group>

                            <Group>
                                <Button.Group mr={"lg"}>
                                    <Button component="a" variant="light" leftSection={<FaGithub />}
                                        target="_blank" href="https://github.com/netd-tud/hilby">
                                        GitHub
                                    </Button>
                                    <Button variant="light" leftSection={<FaBook />} component='a'
                                        target="_blank" href="https://github.com/netd-tud/hilby/blob/master/README.md">
                                        Docs
                                    </Button>
                                    <Button variant="light" onClick={open} leftSection={<FaInfoCircle />}>
                                        Shortcuts
                                    </Button>
                                </Button.Group>
                            </Group>
                        </Group>
                    </Group>

                </Container>

                <AppShell.Main>
                    {/* Control Panel */}
                    <Container size="xl" py="md">
                        <Paper shadow="sm" p="md" mb="md">
                            <Stack gap="md">
                                <Group justify='space-between'>
                                    <Group>
                                        <Group>
                                            <Text fw={700}>AS Number:</Text>
                                            <Input
                                                defaultValue={selectedAS}
                                                style={{ fontWeight: "700" }}
                                                fs={"1rem"}
                                                size='md'
                                                disabled={parsingText !== ""}
                                                onChange={(event) => setSelectedAS(event.currentTarget.value)}
                                            ></Input>
                                        </Group>
                                        <Group>
                                            <Text fw={700}>Protocol:</Text>
                                            <Switch onChange={(e) => {
                                                setipv6(e.currentTarget.checked);
                                                setUsedData(null);
                                                setCollapseStatus(false);
                                                setTopPrefix(e.currentTarget.checked ? "2000::/4" : "0.0.0.0/0");
                                            }
                                            }
                                                disabled={isLoading}
                                                checked={ipv6}
                                                onLabel="IPv6" offLabel="IPv4"
                                                size='lg'
                                                color={baseColor}
                                                styles={{
                                                    track: {
                                                        backgroundColor: "oklch(0.55 0.1357 267.88)",
                                                        borderColor: "oklch(0.55 0.1357 267.88)",
                                                        color: "white",
                                                        '&[data-checked]': {
                                                            backgroundColor: "oklch(0.55 0.1357 267.88)",
                                                            borderColor: "oklch(0.55 0.1357 267.88)",
                                                        }
                                                    }
                                                }}

                                            />
                                        </Group>
                                        <Group>
                                            <Text fw={700}>Data Provider:</Text>
                                            <Switch
                                                onChange={() => {
                                                    setSource(source === "routeviews" ? "ripe" : "routeviews")
                                                }}
                                                disabled={isLoading}
                                                checked={source === "ripe"}
                                                onLabel="RIPEstat RIS" offLabel="Routeviews"
                                                size='lg'
                                                color={baseColor}
                                                styles={{
                                                    track: {
                                                        backgroundColor: "oklch(0.55 0.1357 267.88)",
                                                        borderColor: "oklch(0.55 0.1357 267.88)",
                                                        color: "white",
                                                        '&[data-checked]': {
                                                            backgroundColor: "oklch(0.55 0.1357 267.88)",
                                                            borderColor: "oklch(0.55 0.1357 267.88)",
                                                        }
                                                    }
                                                }}

                                            />
                                        </Group>
                                    </Group>
                                    <Group>
                                        {/* Action buttons */}
                                        {!ipv6 && <Button color={baseColor}
                                            size='md'
                                            w="152px"
                                            onClick={() => {
                                                if (!collapseStatus) {
                                                    const base = ip2long("0.0.0.0");
                                                    const prefixes: string[] = [];
    
                                                    for (let i = 0; i < 8; i += 2) {
                                                        let itr = base;
                                                        const ctr = (1 << (32 - i));
                                                        for (let j = 0; j < (1 << (i)) * 0.875; j++) {
                                                            const prefix = long2ip(itr) + "/" + i.toString();
                                                            prefixes.push(prefix)
                                                            itr += ctr;
                                                        }
                                                    }
    
                                                    prefixManipulation.setPrefixSplit(prefixes, true);
                                                    setCollapseStatus(true);
                                                } else {
                                                    prefixManipulation.setPrefixSplit(topPrefix, false);
                                                    setCollapseStatus(false);
                                                }
                                            }}>
                                            {!collapseStatus ? "Expand all /8s" : "Collapse to /0"}
                                        </Button>}
                                        {ipv6 && <Button color={baseColor}
                                            size='md'
                                            w="152px"
                                            onClick={() => {
                                                if (!collapseStatus) {
                                                    const base = new Address6(topPrefix).bigInt();
                                                    const prefixes: string[] = [];
                                                    for (let i = 4n; i < 10n; i += 2n) {
                                                        let itr = base;
                                                        const ctr = (1n << (128n - i));
                                                        for (let j = 0n; j < (1n << (i - 4n)); j++) {
                                                            const prefix = Address6.fromBigInt(itr).correctForm() + "/" + i.toString();
                                                            prefixes.push(prefix)
                                                            itr += ctr;
                                                        }
                                                    }
    
                                                    prefixManipulation.setPrefixSplit(prefixes, true);
                                                    setCollapseStatus(true);
                                                } else {
                                                    prefixManipulation.setPrefixSplit(topPrefix, false);
                                                    setCollapseStatus(false);
                                                }
                                            }}>
                                            {!collapseStatus ? "Expand all /10s" : "Collapse to /0"}
                                        </Button>}
                                        <Button color={baseColor} size='md' onClick={() => {
                                            zoomManipulation.resetZoom();
                                        }}>
                                            Reset Zoom
                                        </Button>
                                    </Group>
                                </Group>

                                <Divider />

                                <Group justify="space-between">
                                    <Group>
                                        <Legend />
                                        <Group>
                                            <Text> Search for prefix:</Text>
                                            <Input
                                                value={zoomTarget}
                                                onChange={(e) => { setZoomTarget(e.currentTarget.value); setZoomStatus(true); }} onKeyUp={(e) => {
                                                    if (e.key === "Enter") {
                                                        const result = zoomManipulation.zoomToPrefix(zoomTarget);
                                                        setZoomStatus(result);
                                                    }
                                                }}
                                                error={!zoomStatus}
                                            ></Input>
                                        </Group>
                                    </Group>
                                    <Group>
                                        <Text> {parsingText}</Text>
                                    </Group>
                                </Group>
                            </Stack>
                        </Paper>
                    </Container>

                    {/* Main Hilbert Plot */}
                    <Container size="xl" style={{ flexGrow: 1 }} mb={"md"}>
                        <div className="hilbert-container">
                            {/* Hilbert plot content */}
                            {isLoading && <Loader color={baseColor} />}
                            {!isLoading && <InteractiveHilbert topPrefix={topPrefix} renderFunctions={renderFunctions} hilbertStore={hilbertStore} maxExpand={maxExpand} />}
                        </div>
                    </Container>
                </AppShell.Main>

                <Container size="xl" py="sm">
                    <Group justify='center' mb="sm">
                        <Group>
                            <Text size="md">
                                Built at <a
                                    style={{
                                        color: baseColor,
                                        textDecorationLine: "none",
                                        fontWeight: 700
                                    }}
                                    href="https://netd.inf.tu-dresden.de/">
                                    TUD NETD
                                </a>
                            </Text>
                        </Group>
                        <Text>|</Text>
                        <Group>
                            <Text size="md">
                                Presented at <a
                                    style={{
                                        color: baseColor,
                                        textDecorationLine: "none",
                                        fontWeight: 700
                                    }}
                                    href="https://doi.org/10.1145/3744969.3748402">
                                    SIGCOMM
                                </a>
                            </Text>
                        </Group>
                    </Group>
                </Container>
            </AppShell>
            <TutorialModal opened={opened} close={close} />
        </>
    )
}

export default App
