import { useState, useMemo, useCallback } from "react";
import { Address4, Address6 } from "ip-address";

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
    const { prefix, topPrefix: topPrefixStr, maxExpand, parentSplit: propsParentSplit, renderFunctions, state } = props;
    const prefixState = useStoreSubscription(state, (s) => s.prefixState[prefix]);
    const [split, setSplit] = useState(prefixState?.split ?? false);

    const isIPv6 = prefix.includes(":");
    const maxSubnetMask = isIPv6 ? 128 : 32;
    const Address = isIPv6 ? Address6 : Address4;

    const block = useMemo(() => new Address(prefix), [prefix, Address]);
    const topPrefixObj = useMemo(() => new Address(topPrefixStr), [topPrefixStr, Address]);

    const prefix_length = block.subnetMask;

    const setPrefixSplit = state.getState().setPrefixSplit;
    const setHoverPrefix = state.getState().setHoverPrefix;

    // memoize event handlers to prevent unnecessary re-renders
    const onClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        if (prefix_length < maxSubnetMask && prefix_length < topPrefixObj.subnetMask + maxExpand) {
            setSplit(true);
        }
    }, [prefix_length, setSplit, maxSubnetMask, topPrefixObj.subnetMask, maxExpand]);

    const onContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        propsParentSplit(false);
    }, [propsParentSplit]);

    const percentage = topPrefixStr === prefix ? "100%" : "50%";

    // Update split state when prefix state changes
    if (prefixState !== undefined && prefixState.split !== null && prefixState.split !== split) {
        setSplit(prefixState.split);
        setPrefixSplit(prefix, null);
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
            const subPrefix = Address.fromBigInt(x);
            return {
                prefix: subPrefix.correctForm() + `/${new_prefix_length}`,
                ...bounding_box(x, BigInt(new_prefix_length), topPrefixObj)
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
    }, [prefix_length, block, maxSubnetMask, Address, topPrefixObj]);

    if (split && prefix_length < maxSubnetMask) {
        return (
            <div style={{
                display: "flex",
                flexDirection: 'row',
                flexWrap: "wrap",
                height: percentage,
                width: percentage
            }}
                key={prefix} >

                {order.map(e =>
                    <AddressBlock
                        prefix={e.prefix}
                        split={false}
                        topPrefix={topPrefixStr}
                        parentSplit={
                            (newSplit: boolean) => {
                                setSplit(newSplit);
                                setPrefixSplit(prefix, null);
                            }
                        }
                        renderFunctions={renderFunctions}
                        key={e.prefix}
                        state={state}
                        maxExpand={maxExpand}
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
            for (const renderFunction of renderFunctions) {
                renderFunction(prefix, long_base, block.subnetMask, config);
            }
        }
        if (configPresentInStore && prefixState.merge) {
            config.innerContent = [...config.innerContent, ...(prefixState.config.innerContent ?? [])];
            config.properties = { ...config.properties, ...prefixState.config.properties };
            config.style = { ...config.style, ...prefixState.config.style };
        }

        const onMouseOver = () => {
            setHoverPrefix(prefix, config);
        };

        return (
            <div
                className={"net"}
                key={prefix}
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