import { useState, useMemo, useCallback } from "react";
import { Address4, Address6 } from "ip-address";

// @ts-ignore
import './styles.css';
import { bounding_box } from "./hilbert";
import { RenderFunction, SubnetConfig } from "./InteractiveHilbert";
import { HilbertStoreInstance } from "./useControlledHilbert";
import { useStoreSubscription } from './helpers';


interface AddressBlockProps {
    split: boolean;
    prefix: string;
    topPrefix: string;
    parentSplit: (newSplit: boolean) => void;
    renderFunctions: RenderFunction[];
    state: HilbertStoreInstance;
    maxExpand: number;
}

function AddressBlock(props: AddressBlockProps) {
    const prefixState = useStoreSubscription(props.state, (state) => state.prefixState[props.prefix]);
    const [split, setSplit] = useState(prefixState?.split ?? false);

    const isIPv6 = props.prefix.includes(":");
    const maxSubnetMask = isIPv6 ? 128 : 32;
    const Address = isIPv6 ? Address6 : Address4;

    const block = new Address(props.prefix);
    const topPrefix = new Address(props.topPrefix);

    const prefix_length = block.subnetMask;

    const setPrefixSplit = props.state.getState().setPrefixSplit;
    const setHoverPrefix = props.state.getState().setHoverPrefix;

    // memoize event handlers to prevent unnecessary re-renders
    const onClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        if (prefix_length < maxSubnetMask && prefix_length < topPrefix.subnetMask + props.maxExpand) {
            setSplit(true);
        }
    }, [prefix_length, setSplit]);

    const onContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        props.parentSplit(false);
    }, [props.parentSplit]);

    const percentage = props.topPrefix === props.prefix ? "100%" : "50%";

    // Update split state when prefix state changes
    if (prefixState !== undefined && prefixState.split !== null && prefixState.split !== split) {
        setSplit(prefixState.split);
        setPrefixSplit(props.prefix, null);
    }

    const order = useMemo(() => {
        const new_prefix_length = prefix_length + 2

        const base_smaller_net = block.bigInt();
        const smaller_nets: bigint[] = [];

        for (let i = 0n; i < 4n; i++) {
            const newValue = base_smaller_net + (1n << BigInt((maxSubnetMask - new_prefix_length))) * i
            smaller_nets.push(newValue)
        }

        const bboxes = smaller_nets.map((x) => {
            const prefix = Address.fromBigInt(x);
            return {
                prefix: prefix.correctForm() + `/${new_prefix_length}`,
                ...bounding_box(x, BigInt(new_prefix_length), topPrefix)
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
        return order;
    }, [props.prefix])

    if (split && prefix_length < maxSubnetMask) {
        return (
            <div style={{
                display: "flex",
                flexDirection: 'row',
                flexWrap: "wrap",
                height: percentage,
                width: percentage
            }}
                key={props.prefix} >

                {order.map(e =>
                    <AddressBlock
                        prefix={e.prefix}
                        split={false}
                        topPrefix={props.topPrefix}
                        parentSplit={
                            (split: boolean) => {
                                setSplit(split);
                                setPrefixSplit(props.prefix, null);
                            }
                        }
                        renderFunctions={props.renderFunctions}
                        key={e.prefix}
                        state={props.state}
                        maxExpand={props.maxExpand}
                    />
                )}
            </div>
        )
    } else {

        let config: SubnetConfig = {
            style: {
                backgroundColor: "rgb(0,0,0)",
                color: "rgb(255,255,255)",
            },
            innerContent: [],
            properties: {}
        };

        const long_base = block.startAddress().bigInt();
        const configPresentInStore = prefixState !== undefined && prefixState.config !== undefined;

        if (configPresentInStore && !prefixState.merge) {
            config = { ...config, ...prefixState.config };
        } else {
            for (const renderFunction of props.renderFunctions) {
                renderFunction(props.prefix, long_base, block.subnetMask, config);
            }

            config.innerContent = [...config.innerContent, ...(prefixState.config.innerContent ?? [])];
            config.properties = { ...config.properties, ...prefixState.config.properties };
            config.style = { ...config.style, ...prefixState.config.style };
        }

        const onMouseOver = () => {
            setHoverPrefix(props.prefix, config);
        };

        return (
            <div
                className={"net"}
                key={props.prefix}
                style={{ ...config.style, height: percentage, width: percentage, }}
                onClick={onClick}
                onMouseOver={onMouseOver}
                onContextMenu={onContextMenu}
            >
                {config.innerContent}
            </div>

        )
    }
}

export { AddressBlock };