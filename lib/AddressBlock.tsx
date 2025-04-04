import './styles.css';

import { useEffect, useState, useMemo, useCallback } from "react";
import { Address4, Address6 } from "ip-address";

import { bounding_box } from "./hilbert";
import { RenderFunction, SubnetConfig } from "./InteractiveHilbert";
import { HilbertStoreInstance } from "./useControlledHilbert";


interface AddressBlockProps {
    split: boolean;
    prefix: string;
    topPrefix: string;
    parentSplit: (newSplit: boolean) => void;
    renderFunctions: RenderFunction[];
    state: HilbertStoreInstance;
}

function AddressBlock(props: AddressBlockProps) {
    const [split, setSplit] = useState(props.split);

    const isIPv6 = props.prefix.includes(":");
    const maxSubnetMask = isIPv6 ? 128 : 32;

    const block = isIPv6 ? new Address6(props.prefix) : new Address4(props.prefix)
    

    //const block = new Netmask(props.prefix);

    const prefix_length = block.subnetMask;

    const prefixState = props.state(state => state.prefixState[props.prefix]);
    const setPrefixSplit = props.state(state => state.setPrefixSplit);
    const setHoverPrefix = props.state(state => state.setHoverPrefix);

    // memoize event handlers to prevent unnecessary re-renders
    const onClick = useCallback(() => {
        if (prefix_length < maxSubnetMask) {
            setSplit(true);
        }
    }, [prefix_length, setSplit]);

    const onContextMenu = useCallback((e: React.MouseEvent) => {
        props.parentSplit(false);
        e.preventDefault();
    }, [props.parentSplit]);

    const onMouseOver = useCallback(() => {
        setHoverPrefix(props.prefix, config)
    }, [props.prefix, setHoverPrefix]);

    const percentage = props.topPrefix === props.prefix ? "100%" : "50%"

    // Update split state when prefix state changes
    useEffect(() => {
        if (prefixState !== undefined && prefixState.split !== null) {
            setSplit(prefixState.split);
            setPrefixSplit(props.prefix, null);
        }
    }, [prefixState, props.prefix, setPrefixSplit]);

    // Memoize the config object to prevent unnecessary recalculations
    // Only recalculate when dependencies change
    const config = useMemo(() => {
        let config: SubnetConfig = {
            style: {
                backgroundColor: "rgb(0,0,0)",
                color: "rgb(255,255,255)",
            },
            innerContent: [],
            properties: {}
        };

        const long_base = block.startAddress().bigInt();

        if (prefixState !== undefined && prefixState.config !== undefined && !prefixState.merge) {
            config = { ...config, ...prefixState.config };
        } else {
            for (const f of props.renderFunctions) {
                f(props.prefix, long_base, block.subnetMask, config);
            }
        }

        if (prefixState !== undefined && prefixState.config !== undefined && prefixState.merge) {
            config.innerContent = [...config.innerContent, ...(prefixState.config.innerContent ?? [])];
            config.properties = { ...config.properties, ...prefixState.config.properties };
            config.style = { ...config.style, ...prefixState.config.style };
        }


        return config;
    }, [props.prefix, prefixState, props.renderFunctions]);

    if (split && prefix_length < maxSubnetMask) {
        const new_prefix_length = prefix_length + 2

        const base_smaller_net = block.startAddress().bigInt();
        const smaller_nets: bigint[] = [];

        const baseClass = isIPv6 ? Address6 : Address4; 

        for (let i = 0; i < 4; i++) {
            smaller_nets.push(base_smaller_net + BigInt( ((1) << (maxSubnetMask - new_prefix_length)) * i ))
        }

        const bboxes = smaller_nets.map((x) => {

            return {
                prefix: baseClass.fromBigInt(x).correctForm(),
                ...bounding_box(x, BigInt(new_prefix_length), block)
            }
        });
        
        const order = bboxes.sort((a, b) => {
            if (a.ymin < b.ymin) {
                return -1;
            } else if (a.ymin > b.ymin) {
                return 1;
            }
            if (a.xmin < b.xmin) {
                return -1;
            } else if (a.xmin > b.xmin) {
                return 1;
            } else {
                return 0;
            }
        })

        return (
            <div style={{ display: "flex", flexDirection: 'row', flexWrap: "wrap", height: percentage, width: percentage }} key={props.prefix} >
                {order.map(e =>
                    <AddressBlock prefix={e.prefix} split={false} topPrefix={props.topPrefix} parentSplit={setSplit} renderFunctions={props.renderFunctions} key={e.prefix} state={props.state} />
                )}
            </div>
        )
    } else {

        return (
            <div className={"net"} key={props.prefix} style={{overflow: "hidden", color: "white", ...config.style, height: percentage, width: percentage, }} onClick={onClick} onMouseOver={onMouseOver} onContextMenu={onContextMenu}>
                {config.innerContent}
            </div>

        )
    }
}

export { AddressBlock };