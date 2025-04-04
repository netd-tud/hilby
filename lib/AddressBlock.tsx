import './styles.css';

import { ip2long, Netmask } from "netmask";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
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
    const ref = useRef<HTMLDivElement>(null);
    const block = new Netmask(props.prefix);

    const prefix_length = block.bitmask;

    const prefixState = props.state(state => state.prefixState[props.prefix]);
    const setPrefixSplit = props.state(state => state.setPrefixSplit);
    const setHoverPrefix = props.state(state => state.setHoverPrefix);

    if (prefixState === undefined) {
    }

    useEffect(() => {
        if (ref.current === null) return;

        //const baseWidth = 100000 / 2**((prefix_length - parseInt(props.topPrefix.split("/")[1]))/2)
        //ref.current.style.fontSize = baseWidth / 15 + "px";
        //ref.current.style.borderRadius = baseWidth / 20 + "px";
        
        if (!split) {
           //ref.current.style.padding = baseWidth / 15 + "px";
        } else {
            //ref.current.style.padding = "0px";
        }
    }, [split])

    // memoize event handlers to prevent unnecessary re-renders
    const onClick = useCallback(() => {
        if (prefix_length < 32) {
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

        const long_base = ip2long(block.base);

        if (prefixState !== undefined && prefixState.config !== undefined && !prefixState.merge) {
            config = { ...config, ...prefixState.config };
        } else {
            for (const f of props.renderFunctions) {
                f(props.prefix, long_base, block.bitmask, config);
            }
        }

        if (prefixState !== undefined && prefixState.config !== undefined && prefixState.merge) {
            config.innerContent = [...config.innerContent, ...(prefixState.config.innerContent ?? [])];
            config.properties = { ...config.properties, ...prefixState.config.properties };
            config.style = { ...config.style, ...prefixState.config.style };
        }


        return config;
    }, [props.prefix, block.base, block.bitmask, prefixState, props.renderFunctions]);

    if (split && prefix_length < 32) {
        const new_prefix_length = prefix_length + 2
        const base_smaller_net = new Netmask(block.base + "/" + new_prefix_length);
        const smaller_nets = [base_smaller_net, base_smaller_net.next(), base_smaller_net.next().next(), base_smaller_net.next().next().next()]

        const bboxes = smaller_nets.map((x) => {
            console.log(ip2long(new Netmask(x.base, new_prefix_length).first), new_prefix_length, props.topPrefix)
            return {
                prefix: x.toString(),
                ...bounding_box(ip2long(new Netmask(x.base, new_prefix_length).first), new_prefix_length, props.topPrefix)
            }
        });
        console.log(bboxes)
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
            <div ref={ref} style={{ display: "flex", flexDirection: 'row', flexWrap: "wrap", height: percentage, width: percentage }} key={props.prefix} >
                {order.map(e =>
                    <AddressBlock prefix={e.prefix} split={false} topPrefix={props.topPrefix} parentSplit={setSplit} renderFunctions={props.renderFunctions} key={e.prefix} state={props.state} />
                )}
            </div>
        )
    } else {

        return (
            <div className={"net"} ref={ref} key={props.prefix} style={{overflow: "hidden", color: "white", ...config.style, height: percentage, width: percentage, }} onClick={onClick} onMouseOver={onMouseOver} onContextMenu={onContextMenu}>
                {config.innerContent}
            </div>

        )
    }
}

export { AddressBlock };