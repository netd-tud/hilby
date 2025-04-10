import { Address6 } from "ip-address";
import { ip2long, long2ip } from "netmask";

interface DataInterface {
    data: {
        ipv6: boolean;
        data: string[];
    }
}

self.onmessage = function (e: DataInterface) {
    console.log("Started parsing");

     if (e.data.ipv6) {
        const parsedPrefixes: Address6[] = [];
        const sortedData = e.data.data.filter((v:string) => v.includes(":")).sort((a,b) => parseInt(a.split("/")[1]) - parseInt(b.split("/")[1]))
        for (const prefix of sortedData) {
        const convertedPrefix = new Address6(prefix);
        let flag = false;
        //console.log(prefix)
        for (const givenPrefix of parsedPrefixes) {
            if (convertedPrefix.isInSubnet(givenPrefix)){
            flag = true;
            break;
            }
        }
    
        if (!flag) {
            parsedPrefixes.push(convertedPrefix);
        }
        }
        //console.log("finished parsing")
        self.postMessage({ipv6: true, data: parsedPrefixes.map(v => v.correctForm() + `/${v.subnetMask}`)});
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
        const lookUpRaw = new Uint8Array(2**24);
        
        const unique24s = new Set<number>();
        
        e.data.data.filter((v:string) => !v.includes(":")).forEach((prefix: string) => {
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
        
        self.postMessage({ ipv6: false, data: {maps: lookUpMaps, raw: lookUpRaw}});
    }
    console.log("Finished parsing");
};