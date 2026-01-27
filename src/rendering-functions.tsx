import { RenderFunction } from "../";
import { calculatePrefixColor, zeroColor } from "./constants";
import { Address6 } from 'ip-address';

const coloring: RenderFunction = (_prefix: string, _long: bigint, _netmask: number, config) => {
    const normalizedValue = config.properties["subnets"] || 0;
    let color = "";

    if (normalizedValue === 0) {
        color = zeroColor;
    } else {
        color = calculatePrefixColor(normalizedValue);
    }

    config.style.backgroundColor = color;

    const brightness = normalizedValue*200 + 50;
    const textColor = (brightness > 175) ? 'black' : 'white';
    config.style.color = textColor;
}

const getPercentage: RenderFunction = (prefix, _long, _netmask, config) => {
    const normalizedValue = config.properties["subnets"] || 0;
    config.innerContent.push(
        <div style={{fontSize: "8cqw"}} key={prefix}>
            {(normalizedValue*100).toFixed(3)}%
        </div>
    );
}

const newAdd: RenderFunction = (prefix, _long, _netmask, config) => {
    config.innerContent.push(
        <div style={{fontSize: "12cqw", fontWeight:"500", paddingTop: "-1%"}}key="prefix">
            {prefix}
        </div>
    );
}

export const createColorBasedOnDensity = (
    usedData: { maps: Record<number, Record<string, number>>, raw: Uint8Array } | Address6[] | null,
    ipv6: boolean
): RenderFunction => {
    return (prefix: string, long: bigint, netmask: number, config) => {
        if (usedData === null || usedData === undefined) return;

        let maxNumberOfSubnets = 0;
        let actualNumberOfSubnets = 0;

        if (!ipv6) {
            // Required since we might be called in the transition from IPv6 to IPv4
            if (prefix.includes(":")) return;

            const data = usedData as { maps: Record<number, Record<string, number>>, raw: Uint8Array };
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

            const data = usedData as Address6[];
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
    }
}

export { coloring, getPercentage, newAdd };