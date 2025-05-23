import { CSSProperties, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AddressBlock } from "./AddressBlock";
import usePanZoom from "./use-pan-and-zoom";
import { HilbertStoreInstance, stateCreator } from "./useControlledHilbert";
import { create } from "zustand";

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
    const size = 100000 * 2**((localMaxExpand - 24)/2);
    const ref = useRef<HTMLDivElement>(null);
    const { transform, setContainer, panZoomHandlers,setPan, setZoom} = usePanZoom({ initialZoom: (800 / size), initialPan: { x: -(size/2 - 500 / 2), y: -(size/2 - 500 / 2) }, zoomSensitivity: 0.005, containerSize: size});
    const [, refresh] = useState({});
    const hilbertStore = props.hilbertStore === undefined ? create(stateCreator) : props.hilbertStore;

    const resetPrefixes = hilbertStore(state => state.clearAllPrefixes)
    

    useEffect(() => {
        if (ref.current !== null) {
            const width = ref.current.offsetWidth;
            const height = ref.current.offsetHeight;
            //console.log(width, height);
            //console.log({x:-(50000) + width/2, y: -(50000) + height/2})
            setPan({x:-(size/2) + width/2, y: -(size/2) + height/2});
            setZoom(Math.min(height, width) * (0.8 / size));
            refresh({});
        }
    }, [ref.current]);

    useEffect(() => {
        resetPrefixes();
    }, [props.topPrefix, props.renderFunctions, hilbertStore])

    const content = useMemo(() => {
        return <AddressBlock prefix={props.topPrefix} split={false} topPrefix={props.topPrefix} parentSplit={() => { }} renderFunctions={props.renderFunctions} state={hilbertStore} key={props.topPrefix} maxExpand={localMaxExpand}/>;
    }, [props.topPrefix, props.renderFunctions])

    return (
        <div ref={ref} style={{ maxHeight: "min(100vh, 100%)", maxWidth: "min(100vw, 100%)", userSelect: "none", overflow: "hidden" }}>
            <div  style={{ height: size, width: size, }}>
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
