import { CSSProperties, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AddressBlock } from "./AddressBlock";
//@ts-ignore
import usePanZoom from "use-pan-and-zoom";
import { HilbertStoreInstance, stateCreator } from "./useControlledHilbert";
import { create } from "zustand";

type SubnetConfig = {
    style: CSSProperties;
    innerContent: ReactNode[];
    properties: Record<string, any>;
}

type RenderFunction = (prefix: string, long: number, netmask: number, config: SubnetConfig) => void;

interface InteractiveHilbertProps {
    topPrefix: string;
    renderFunctions: RenderFunction[];
    hilbertStore?: HilbertStoreInstance;
}

const InteractiveHilbert = (props: InteractiveHilbertProps) => {

    const [size, setSize] = useState<number>(500);
    const ref = useRef<HTMLDivElement>(null);
    const { transform, setContainer, panZoomHandlers} = usePanZoom({ initialZoom: size / 100000, initialPan: { x: -(50000 - size / 2), y: -(50000 - size / 2) },/*minZoom: 0.5*size/8000*/ });

    const hilbertStore = props.hilbertStore === undefined ? create(stateCreator) : props.hilbertStore;

    const resetPrefixes = hilbertStore(state => state.clearAllPrefixes)

    useEffect(() => {
        const handler = () => {
            if (ref.current !== null) {
                //const newSize = Math.min(window.innerHeight, window.innerWidth);
                //setSize(newSize)
                //setPan({x:-(50000) + newSize/2, y: -(50000) + newSize/2})
            }
        }
        window.addEventListener('resize', handler);

        return () => {
            window.removeEventListener("resize", handler);
        }
    }, [setSize]);

    useEffect(() => {
        resetPrefixes();
    }, [props.topPrefix, props.renderFunctions, hilbertStore])

    const content = useMemo(() => {
        return <AddressBlock prefix={props.topPrefix} split={false} topPrefix={props.topPrefix} parentSplit={() => { }} renderFunctions={props.renderFunctions} state={hilbertStore} />;
    }, [props.topPrefix, props.renderFunctions])

    return (
        <div style={{ height: "100%", userSelect: "none", overflow: "hidden" }}>
            <div ref={ref} style={{ height: 100000, width: 100000, }}>
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
