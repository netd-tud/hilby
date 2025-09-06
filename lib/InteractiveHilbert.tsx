import { CSSProperties, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import { Address4, Address6 } from "ip-address";

import { AddressBlock } from "./AddressBlock";
import usePanZoom from "./use-pan-and-zoom";
import { HilbertStoreInstance, stateCreator } from "./useControlledHilbert";
import { bounding_box } from "./hilbert";

type SubnetConfig = {
    style: CSSProperties;
    innerContent: ReactNode[];
    properties: Record<string, any>;
}

type RenderFunction = (prefix: string, long: bigint, netmask: number, config: SubnetConfig) => void;

interface InteractiveHilbertProps {
    topPrefix: string;
    renderFunctions: RenderFunction[];
    hilbertStore?: HilbertStoreInstance;
    maxExpand?: number;
}

const InteractiveHilbert = (props: InteractiveHilbertProps) => {
    const localMaxExpand = props.maxExpand ?? 24;

    // 100k gives us 24 steps down, but is otherwise arbitrarily chosen
    const size = 100000 * 2 ** ((localMaxExpand - 24) / 2);

    const {
        transform,
        setContainer,
        panZoomHandlers,
        setPanAndZoom
    } = usePanZoom({
        initialZoom: (800 / size),
        initialPan: {
            x: -(size / 2 - 650 / 2),
            y: -(size / 2 - 500 / 2)
        },
        zoomSensitivity: 0.005,
        containerSize: size
    });

    const ref = useRef<HTMLDivElement>(null);
    const [, refresh] = useState({});

    const hilbertStore = props.hilbertStore === undefined ? create(stateCreator) : props.hilbertStore;

    const resetPrefixes = hilbertStore.getState().clearAllPrefixes;
    const setResetZoom = hilbertStore.getState().setResetZoom
    const setZoomToPrefix = hilbertStore.getState().setZoomToPrefix
    const setPrefixSplit = hilbertStore.getState().setPrefixSplit;


    const resetZoom = useCallback(() => {
        if (ref.current !== null) {

            const width = ref.current.offsetWidth;
            const height = ref.current.offsetHeight;

            setPanAndZoom(
                {
                    x: -(size / 2) + width / 2,
                    y: -(size / 2) + height / 2
                },
                Math.min(height, width) * (0.8 / size)
            );
            refresh({});
        }
    }, [setPanAndZoom, refresh]);

    const zoomToPrefix = useCallback((prefix: string) => {

        if (ref.current === null) return false;

        const isTargetIPv6 = prefix.includes(":")
        const isTopPrefixIPv6 = props.topPrefix.includes(":")

        if (isTargetIPv6 != isTopPrefixIPv6) return false;

        const Address = isTargetIPv6 ? Address6 : Address4
        const subnetSize = isTargetIPv6 ? 128 : 32;


        let targetAddress, topPrefixAddress;

        // Parse and match Address with entered subnet mask.
        // Otherwise the location and zoom do not correctly match.
        try {
            targetAddress = new Address(prefix)
            topPrefixAddress = new Address(props.topPrefix);

            const mask = (0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn << BigInt(subnetSize - targetAddress.subnetMask));
            const cleanedAddress = Address.fromBigInt(targetAddress.bigInt() & mask);
            const correctedCIDR = cleanedAddress.correctForm() + `/${targetAddress.subnetMask}`;

            targetAddress = new Address(correctedCIDR);

            if (!targetAddress.isInSubnet(topPrefixAddress)) return false;

        } catch (error) {
            return false;
        }

        if (targetAddress.subnetMask > localMaxExpand) return false;

        const diffToTopPrefix = targetAddress.subnetMask - topPrefixAddress.subnetMask;

        const prefixesToSplit: string[] = [];

        for (let i = topPrefixAddress.subnetMask; i < targetAddress.subnetMask; i = i + 2) {
            const supernet = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn << BigInt(subnetSize - i) & targetAddress.bigInt();
            const supernetParsed = Address.fromBigInt(supernet);
            prefixesToSplit.push(supernetParsed.correctForm() + "/" + i.toString())
        }

        setPrefixSplit(prefixesToSplit, true);

        const bbox = bounding_box(targetAddress.bigInt(), BigInt(targetAddress.subnetMask), topPrefixAddress);
        const bboxTopPrefix = bounding_box(topPrefixAddress.bigInt(), BigInt(topPrefixAddress.subnetMask), topPrefixAddress);

        const width = ref.current.offsetWidth;
        const height = ref.current.offsetHeight;


        const relativePositionOfSubnetToCenter = {
            // calculate middle of target bbox: ((bbox.xmax - bbox.xmin)/2 + bbox.xmin)
            // calculate location relative within topPrefix: ((bbox.xmax - bbox.xmin)/2 + bbox.xmin) / bboxTopPrefix.xmax
            // invert to match the coordinate system: 1 - ((bbox.xmax - bbox.xmin)/2 + bbox.xmin) / bboxTopPrefix.xmax
            // change scale to be 1 at center position: result * 2 - 1
            x: (1 - ((bbox.xmax - bbox.xmin) / 2 + bbox.xmin) / bboxTopPrefix.xmax) * 2 - 1,
            y: (1 - ((bbox.ymax - bbox.ymin) / 2 + bbox.ymin) / bboxTopPrefix.ymax) * 2 - 1

        };

        // Center the zoom and scale to the targeted prefix size
        const centerZoomValue = Math.min(height, width) * (0.8 / size);
        const newZoomValue = centerZoomValue * 2 ** (diffToTopPrefix / 2);

        // center position for current screen size
        const newPos = {
            x: -(size / 2) + width / 2,
            y: -(size / 2) + height / 2
        };

        // The size in pixel of the topPrefix is zoomscale * start size 
        const fullSize = newZoomValue * size;


        newPos.x += fullSize / 2 * relativePositionOfSubnetToCenter.x;
        newPos.y += fullSize / 2 * relativePositionOfSubnetToCenter.y;

        setPanAndZoom(
            newPos,
            newZoomValue
        );
        refresh({});

        return true;
    }, [setPrefixSplit, localMaxExpand, refresh, setPanAndZoom])

    // We need to override the functions in the store that `useHilbertStore` exposes, as 
    // the ref will only become available once the curve gets rendered
    useEffect(() => {
        setResetZoom(resetZoom);
        setZoomToPrefix(zoomToPrefix);
    }, [zoomToPrefix, resetZoom, props.hilbertStore])

    // Reset zoom once when the curve gets rendered
    useEffect(() => {
        resetZoom();
    }, [ref.current]);

    // If any config changes, we want to recollapse the prefixes (maybe not on renderFunctions though)
    useEffect(() => {
        resetPrefixes();
    }, [props.topPrefix, props.renderFunctions, hilbertStore])

    const content = useMemo(() => {
        return <AddressBlock prefix={props.topPrefix} split={false} topPrefix={props.topPrefix} parentSplit={() => { }} renderFunctions={props.renderFunctions} state={hilbertStore} key={props.topPrefix} maxExpand={localMaxExpand} />;
    }, [props.topPrefix, props.renderFunctions])

    return (
        <div ref={ref} style={{ maxHeight: "min(100vh, 100%)", maxWidth: "min(100vw, 100%)", userSelect: "none", overflow: "hidden" }}>
            <div style={{ height: size, width: size, }}>
                <div ref={(el) => { setContainer(el) }} {...panZoomHandlers} style={{ touchAction: "none", width: "100%", height: "100%" }}>
                    <div style={{ transform, width: "100%", height: "100%" }}>
                        {content}
                    </div>
                </div>
            </div>
        </div>
    )
}
export type { RenderFunction, SubnetConfig };

export { InteractiveHilbert };
