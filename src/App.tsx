import './App.css'

import { useCallback, useDeferredValue, useEffect, useState } from 'react'
import { AppShell, Button, Group, Input, Loader, Switch, Text, Title, Image } from "@mantine/core";
import { useDebouncedState } from '@mantine/hooks';
import { ip2long, long2ip } from 'netmask';
import { useQuery } from "@tanstack/react-query";
import { InteractiveHilbert, RenderFunction, useControlledHilbert, useEnableKeyBindings } from "../";
import { FaGithub } from "react-icons/fa";

import Worker from './parse-api-data?worker';
import { response } from './response';
import { newAdd, coloring, getPercentage } from './rendering-functions';
import { Address6 } from 'ip-address';

import ripeLogo from "./ripe_stat_logo.png";

function App() {

    const [ipv6, setipv6] = useState(false);
    const [worker, setWorker] = useState<Worker | null>(null);
    const [usedData, setUsedData] = useState<{ maps: Record<number, Record<string, number>>, raw: Uint8Array } | Address6[] | null>(null);

    const [selectedAS, setSelectedAS] = useDebouncedState("16509", 1000);
    const deferredUsedData = useDeferredValue(usedData);

    const [hilbertStore, prefixManipulation, _useHoveredPrefix] = useControlledHilbert();
    const [topPrefix, setTopPrefix] = useEnableKeyBindings(hilbertStore, { originalTopPrefix: "0.0.0.0/0" });

    const [noData, setNoData] = useState(false);

    let isLoading = true;
    useEffect(() => {
        console.log(noData);
    }, [noData])
    useEffect(() => {
        const workerInstance = new Worker();
        setWorker(workerInstance);

        workerInstance.onmessage = function (e) {
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
            isLoading = (usedData as { maps: Record<number, Record<string, number>>, raw: Uint8Array }).raw.length === 0;
        }
    } else {
        isLoading = true;
    }

    const getAnnouncedPrefixes = useCallback(async (as: string): Promise<string[]> => {
        // const response = await fetch(`https://api.routeviews.org/guest/asn/${as}?af=4`, {           
        //   redirect: 'follow',
        // });

        // console.log(await response.text())
        // return await response.json();

        const response = await fetch(`https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS${as}`)
        const parsedResponse = await response.json();


        return parsedResponse["data"]["prefixes"].map((v: { prefix: string }) => v["prefix"]);
    }, [])

    const result = useQuery({
        queryKey: [selectedAS],
        queryFn: () => getAnnouncedPrefixes(selectedAS),
        initialData: () => response,
    })

    useEffect(() => {
        if (!result.isSuccess) return;

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


    return (
        <AppShell m="lg">
            <Title order={1}>Hilby</Title>
            <Text style={{ "opacity": 0.7 }} fw={500} size="xl" mb={10}>Hilbert Interactive Prefix Plots</Text>
            <Group mb={20}>
                <Button component="a" color='gray' leftSection={<FaGithub size={"22"} />} target="_blank" href="https://github.com/netd-tud/hilby">See on Github</Button>
                <Button color='gray' component='a' target="_blank" href="https://github.com/netd-tud/hilby/blob/master/README.md">Documentation</Button>
                <Switch onChange={(e) => {
                    setipv6(e.currentTarget.checked);
                    setUsedData(null);
                    setTopPrefix(e.currentTarget.checked ? "2000::/4" : "0.0.0.0/0");
                }
                }
                    checked={ipv6}
                    onLabel="IPv6" offLabel="IPv4"
                    size='lg'
                    color="oklch(0.55 0.1357 267.88)"
                />
                
            </Group>

            <Group mb={20} >
                <Text fw={700} size='lg'>Announced prefixes in {topPrefix} from AS</Text>
                {/*AS{oldAS} <Text>Enter AS Number:</Text> */}
                <Input
                    defaultValue={selectedAS}
                    style={{ fontWeight: "700" }}
                    fs={"1rem"}
                    size='md'
                    onChange={(event) => setSelectedAS(event.currentTarget.value)}
                ></Input>
                {!ipv6 && <Button color="oklch(0.55 0.1357 267.88)"
                    size='md'
                    onClick={() => {
                        const base = ip2long("0.0.0.0");
                        const prefixes: string[] = [];

                        for (let i = 0; i < 8; i += 2) {
                            let itr = base;
                            const ctr = (1 << (32 - i));
                            for (let j = 0; j < (1 << (i)) * 0.875; j++) {
                                const prefix = long2ip(itr) + "/" + i.toString();
                                //prefixManipulation.setPrefixSplit(prefix, true);
                                prefixes.push(prefix)
                                itr += ctr;
                            }
                        }

                        prefixManipulation.setPrefixSplit(prefixes, true);

                    }}>
                    Show all /8s
                </Button>}
                {ipv6 && <Button color="oklch(0.55 0.1357 267.88)"
                    size='md'
                    onClick={() => {
                        const base = new Address6(topPrefix).bigInt();
                        const prefixes: string[] = [];
                        for (let i = 4n; i < 10n; i += 2n) {
                            let itr = base;
                            const ctr = (1n << (128n - i));
                            for (let j = 0n; j < (1n << (i - 4n)); j++) {
                                const prefix = Address6.fromBigInt(itr).correctForm() + "/" + i.toString();
                                //prefixManipulation.setPrefixSplit(prefix, true);
                                prefixes.push(prefix)
                                itr += ctr;
                            }
                        }

                        prefixManipulation.setPrefixSplit(prefixes, true);

                    }}>
                    Show all /10s
                </Button>}
                <Text> {result.isFetching ? `Fetching data from RIPEStat for AS${selectedAS}` : ""}</Text>
                <Group ml={"auto"}>
                    <Text ms={20}>Data used in example provided by </Text>
                    <a href="https://stat.ripe.net/" target='_blank'>
                        <Image h="60" src={ripeLogo} w="auto"
                            fit="contain"
                        />
                    </a>
                </Group>
            </Group>
            <div className="hilbert-container" style={{ backgroundColor: "var(--mantine-color-gray-6)" }}>
                {isLoading && <Loader color="oklch(0.55 0.1357 267.88)" />}
                {!isLoading && <InteractiveHilbert topPrefix={topPrefix} renderFunctions={renderFunctions} hilbertStore={hilbertStore} />}
            </div>
        </AppShell>
    )
}

export default App
