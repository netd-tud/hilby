import './App.css'

import { useCallback, useDeferredValue, useEffect, useState } from 'react'
import { AppShell, Button, Group, Input, Loader, Text, Title} from "@mantine/core";
import { useDebouncedState } from '@mantine/hooks';
import { ip2long, long2ip } from 'netmask';
import { useQuery } from "@tanstack/react-query";
import { InteractiveHilbert, RenderFunction, useControlledHilbert, useEnableKeyBindings } from "../";
import { FaGithub } from "react-icons/fa";

import { response } from './response';
import { newAdd, coloring, getPercentage } from './rendering-functions';

function App() {

  const [hilbertStore, prefixManipulation, _useHoveredPrefix] = useControlledHilbert();
  const [selectedAS, setSelectedAS] = useDebouncedState("16509", 1000);
  const [usedData, setUsedData] = useState<{maps: Record<number, Record<string, number>>, raw: Uint8Array}>({maps: {}, raw: new Uint8Array(0)});
  const deferredUsedData = useDeferredValue(usedData);
  const topPrefix = useEnableKeyBindings(hilbertStore ,{originalTopPrefix: "0.0.0.0/0"});


  const getAnnouncedPrefixes = async (as: string): Promise<string[]> => {
    // const response = await fetch(`https://api.routeviews.org/guest/asn/${as}?af=4`, {           
    //   redirect: 'follow',
    // });

    // console.log(await response.text())
    // return await response.json();

    const response = await fetch(`https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS${as}`)
    const parsedResponse =  await response.json();
    
    return parsedResponse["data"]["prefixes"].map((v: {prefix: string}) => v["prefix"]).filter((v:string) => !v.includes(":"))
  }

  const result = useQuery({
    queryKey: [selectedAS],
    queryFn: () => getAnnouncedPrefixes(selectedAS),
    initialData: () => response, 
  })

  useEffect(() => {
    if (!result.isSuccess) return;
    
    const lookUpMaps: Record<number, Record<string, number>> = {
      2: {},
      4: {},
      6: {},
      8: {},
      10: {},
      12: {},
      14: {},
      16: {},
    }
    const lookUpRaw = new Uint8Array(2**24);

    const unique24s = new Set<number>();

    result.data.forEach((prefix: string) => {
      const [ip, mask] = prefix.split("/");
      const netmask = parseInt(mask);

      const long = ip2long(ip);
      const bitmask = 0xFFFFFFFF << (32 - netmask)
      const base = (long  & bitmask & 0xFFFFFFFF ) >>>0;

      if (netmask < 24) {
        
        for (let i = 0; i < (2**(24 - netmask)); i++) {
          unique24s.add(base + (i << 8));
        }
      } else {
        unique24s.add(base);
      }
    });

    const mapIndexes = Object.keys(lookUpMaps) as unknown as Array<keyof typeof lookUpMaps>;

    for (const prefix of unique24s) {
      for (const i of mapIndexes) {
        const base = long2ip(((prefix & (0xFFFFFFFF << (32 - i))) & 0xFFFFFFFF) >>>0) + `/${i}`;
        if (base in lookUpMaps[i]) {
          lookUpMaps[i][base] += 1;
        } else {
          lookUpMaps[i][base] = 1;
        }
      } 
      lookUpRaw[prefix >>> 8] = 1;
    }

    setUsedData({maps: lookUpMaps, raw: lookUpRaw});
    console.log("Finished parsing");

  }, [result.data, result.isSuccess, setUsedData]);

  const colorBasedOnDensity: RenderFunction = useCallback((prefix: string, long: bigint, netmask: number, config) => {
    if (deferredUsedData.raw.length === 0) return;

    let value = 0;
    if (netmask === 0) {
      for (const entry of Object.values(deferredUsedData.maps[2])){
        value += entry;
      }
    } else if (netmask < 18) {
      value = deferredUsedData.maps[netmask][prefix] ?? 0;
    } else {
      for (let i = 0; i < 2**(24-netmask); i++) {
        if (deferredUsedData.raw[Number((long >> 8n)) + i] === 1) {
          value++;
        }
      }
    }

    const number_of_ips = 2 ** (24 - netmask);
    const normalizedValue = value / number_of_ips;
    config.properties["subnets"] = normalizedValue; 
  },[deferredUsedData])

  const renderFunctions: RenderFunction[] = [newAdd, colorBasedOnDensity, coloring, getPercentage];

  return (
    <AppShell m="lg">
      <Title order={1}>HIPP</Title>
      <Text style={{"opacity": 0.7}} fw={500} size="xl" mb={10}>Hilbert Interactive Prefix Plots</Text>
      <Group mb={20}>
        <Button color='gray' leftSection={<FaGithub size={"22"}/>} >See on Github</Button>
        <Button color='gray'>Documentation</Button>
      </Group>
        <Group mb={20} >
          <Text fw={700} size='lg'>Announced prefixes from AS</Text>
          {/*AS{oldAS} <Text>Enter AS Number:</Text> */}
         <Input 
          defaultValue={selectedAS}
          style={{fontWeight: "700"}}
          fs={"1rem"}
          size='md'
          onChange={(event) => setSelectedAS(event.currentTarget.value)}
         ></Input>
         <Button color="oklch(0.55 0.1357 267.88)"
          size='md'
          onClick={() => {
          const base = ip2long("0.0.0.0");
          for (let i = 0; i < 8; i+=2) {
            let itr = base;
            const ctr = (1 << (32 - i));
            for (let j = 0; j < (1 << (i))*0.875; j++) {
              const prefix = long2ip(itr) + "/" + i.toString();
              prefixManipulation.setPrefixSplit(prefix, true);
              itr += ctr;
          }
        }}}>
          Show all /8s
        </Button>
         <Text> {result.isFetching ? `Fetching data from RIPEStat for AS${selectedAS}`: ""}</Text>
        </Group>
        <div className="hilbert-container" style={{backgroundColor: "var(--mantine-color-gray-6)"}}>
          {usedData.raw.length === 0 && <Loader color="blue" />}
          {usedData.raw.length !== 0 && <InteractiveHilbert topPrefix={topPrefix} renderFunctions={renderFunctions} hilbertStore={hilbertStore}/>}
        </div>
      </AppShell>
  )
}

export default App
