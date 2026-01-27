import { Address6 } from "ip-address";
import { ip2long, long2ip } from "netmask";

interface WorkerInputMessage {
    source?: string;
    ipv6: boolean;
    data: string[];
}

interface WorkerScope {
    onmessage: ((this: WorkerScope, ev: MessageEvent<WorkerInputMessage>) => void) | null;
    postMessage: (message: object) => void;
}

// Cast self to a minimal WorkerScope interface to avoid 'any'
// We use 'unknown' first because 'self' in the DOM lib (Window) is not compatible with our WorkerScope definition directly
const ctx = self as unknown as WorkerScope;

ctx.onmessage = function (e: MessageEvent<WorkerInputMessage>) {
    if (e.data?.source !== 'hilby-app') {
        return;
    }

    console.log("Started parsing", e.data);

    if (!e.data || !e.data.data) {
        console.error("Received empty data in worker", e.data);
        return;
    }

    if (e.data.ipv6) {
        const parsedPrefixes: Address6[] = [];
        const sortedData = e.data.data.filter((v: string) => v.includes(":")).sort((a, b) => parseInt(a.split("/")[1]) - parseInt(b.split("/")[1]))
        for (const prefix of sortedData) {
            const convertedPrefix = new Address6(prefix);
            let flag = false;
            //console.log(prefix)
            for (const givenPrefix of parsedPrefixes) {
                if (convertedPrefix.isInSubnet(givenPrefix)) {
                    flag = true;
                    break;
                }
            }

            if (!flag) {
                parsedPrefixes.push(convertedPrefix);
            }
        }
        console.log("finished parsing")
        ctx.postMessage({ ipv6: true, data: parsedPrefixes.map(v => v.correctForm() + `/${v.subnetMask}`) });
    } else {
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
        const lookUpRaw = new Uint8Array(2 ** 24);

        let unique24s = new Set<number>();
        const mapIndexes = Object.keys(lookUpMaps) as unknown as Array<keyof typeof lookUpMaps>;
        let current_first_octet = 0;
        const filtered_prefixes = e.data.data.filter(v => parseInt(v.split("/")[1]) >= 8)
        for (const prefix of filtered_prefixes.sort((a, b) => parseInt(a.split(".")[0]) - parseInt(b.split(".")[0]))) {
            if (prefix.includes(":")) continue;

            const [ip, mask] = prefix.split("/");
            const netmask = parseInt(mask);
            const first_octet = parseInt(ip.split(".")[0])

            if (first_octet > current_first_octet) {
                for (const prefix of unique24s) {
                    for (const i of mapIndexes) {
                        const base = long2ip(((prefix & (0xFFFFFFFF << (32 - i))) & 0xFFFFFFFF) >>> 0) + `/${i}`;
                        if (base in lookUpMaps[i]) {
                            lookUpMaps[i][base] += 1;
                        } else {
                            lookUpMaps[i][base] = 1;
                        }
                    }
                    lookUpRaw[prefix >>> 8] = 1;
                }

                unique24s = new Set<number>();
                current_first_octet = first_octet;
            }

            const long = ip2long(ip);
            const bitmask = 0xFFFFFFFF << (32 - netmask)
            const base = (long & bitmask & 0xFFFFFFFF) >>> 0;

            if (netmask < 24) {

                for (let i = 0; i < (2 ** (24 - netmask)); i++) {
                    unique24s.add(base + (i << 8));
                }
            } else {
                unique24s.add(base);
            }
        }

        ctx.postMessage({ ipv6: false, data: { maps: lookUpMaps, raw: lookUpRaw } });
    }
    console.log("Finished parsing");
};

interface PeeringDBNet {
    name: string;
    asn: number;
    [key: string]: unknown;
}

export const getPeeringDBData = async (inputValue: string, callback: (options: { label: string, value: number }[]) => void) => {
    const tryInt = parseInt(inputValue);
    let response;

    if (!isNaN(tryInt)) {
        response = await fetch(`https://www.peeringdb.com/api/net?asn=${inputValue.toLowerCase()}&limit=10`);
        if (response.status === 404) {
            callback([{
                label: `AS${tryInt}`,
                value: tryInt
            }])
            return;
        }

    } else {
        if (inputValue.length < 3) return [];

        response = await fetch(`https://www.peeringdb.com/api/net?name_search=${inputValue.toLowerCase()}&limit=10`);

    }
    const json = await response.json();
    const value = json["data"].map((e: unknown) => {
        if (typeof e === "object" && e !== null && "name" in e && "asn" in e) {
            const net = e as PeeringDBNet;
            return {
                label: net.name + ` (AS${net.asn})`,
                value: net.asn
            }
        } else {
            return undefined;
        }
    }).filter((item: { label: string, value: number } | undefined): item is { label: string, value: number } => item !== undefined);
    
    console.log(value)
    callback(value);
}

export const getAnnouncedPrefixes = async (source: "ripe" | "routeviews", as: string, selectedDate: string | null): Promise<string[]> => {
    if (source === "routeviews") {
        const response = await fetch(`https://api.routeviews.org/guest/asn/${as}`);
        return await response.json();
    }
    if (source === "ripe") {
        let response;
        console.log(selectedDate)

        if (selectedDate !== null) {
            response = await fetch(`https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS${as}&starttime=${selectedDate}T00:00&endtime=${selectedDate}T22:00`)
        } else {
            response = await fetch(`https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS${as}`)
        }
        const parsedResponse = await response.json();

        return parsedResponse["data"]["prefixes"].map((v: { prefix: string }) => v["prefix"]);
    }
    return [];
}
