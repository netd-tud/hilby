import { createStore, StateCreator, StoreApi, UseBoundStore } from "zustand";
import { useState } from "react";

import { SubnetConfig } from "./InteractiveHilbert";
import { useStoreSubscription } from "./helpers";

type HoverPrefix = {
    prefix: string;
    config: SubnetConfig;
}

type SubnetSettings = {
    config: Partial<SubnetConfig>;
    split: boolean | null;
    merge: boolean;
}

type HilbertState = {
    resetZoom: () => void;
    zoomToPrefix: (prefix: string) => boolean;
    prefixState: Record<string, SubnetSettings>;
    hoverPrefix: HoverPrefix;
    uuid: string
}

type HilbertActions = {
    setResetZoom: (resetZoom: () => void) => void;
    setZoomToPrefix: (zoomToPrefix: (prefix: string) => boolean) => void;

    setPrefixConfig: (prefix: string, state: Partial<SubnetConfig>, merge?: boolean) => void;
    setPrefixSplit: (prefix: string | string[], split: boolean | null) => void;
    clearAllPrefixes: () => void;
    clearPrefix: (prefix: string) => void;
    setHoverPrefix: (prefix: string, config: SubnetConfig) => void;
}

type HoveredPrefixHook = () => HoverPrefix;

type PrefixStateManipulation = {
    setPrefixConfig: (prefix: string, state: Partial<SubnetConfig>) => void;
    clearPrefixState: (prefix: string) => void;
    clearAllPrefixes: () => void;
    setPrefixSplit: (prefix: string | string[], split: boolean | null) => void;
}

type ZoomManipulation = {
    zoomToPrefix: (prefix: string) => boolean;
    resetZoom: () => void;
}

type HilbertStore = HilbertState & HilbertActions;

type HilbertStoreInstance = UseBoundStore<StoreApi<HilbertStore>>;

const stateCreator: StateCreator<HilbertStore, [], []> = (set) => ({
    uuid: self.crypto.randomUUID(),
    resetZoom: () => { console.log("defautl") },
    zoomToPrefix: (_prefix) => { console.log("defautl"); return true; },

    prefixState: {},
    hoverPrefix: {
        prefix: "",
        config: {
            style: {}, innerContent: [], properties: {}
        }
    },
    setPrefixConfig: (prefix, newPrefixState, merge) => set((state) => {
        const actualMerge = merge ?? true;
        const current = state.prefixState[prefix];
        return {
            ...state,
            prefixState: {
                ...state.prefixState,
                [prefix]: {
                    ...current,
                    merge: actualMerge,
                    config: {
                        ...newPrefixState
                    },
                }
            }
        } as HilbertStore;
    }),
    setPrefixSplit: (prefix, split) => set((state) => {
        let prefixList = [];
        if (!(prefix instanceof Array)) {
            prefixList = [prefix]
        } else {
            prefixList = prefix;
        }

        const newState = {
            ...state,
            prefixState: {
                ...state.prefixState
            }
        }
        for (const it_prefix of prefixList) {
            const current = state.prefixState[it_prefix];
            newState.prefixState[it_prefix] = { ...current, split: split };
        }

        return newState as HilbertStore;
    }),

    clearAllPrefixes: () => set((state) => {
        return {
            ...state,
            prefixState: {}
        }
    }),
    clearPrefix: (prefix: string) => set((state => {
        const newPrefixState = { ...state.prefixState };

        delete newPrefixState[prefix];

        return {
            ...state,
            prefixState: newPrefixState
        }
    })),
    setHoverPrefix: (prefix: string, config: SubnetConfig) => set((state) => {
        return {
            ...state,
            hoverPrefix: {
                prefix: prefix,
                config: config
            }
        }
    }),
    setResetZoom: (resetZoomF) => set({
        resetZoom: resetZoomF
    }),
    setZoomToPrefix: (setZoomToPrefixF) => set({
        zoomToPrefix: setZoomToPrefixF
    })
})


const useControlledHilbert = () => {

    // In order for multiple InteractiveHilbert components to be present on the same page
    // and use different stores, we need to put the store in a state here. This means we
    // cannot use zustands `create()` as it uses a ref in the background and gets confused.
    // For this reason, we need to ship the subscription helper ourself, to be found in helpers.tsx.
    const [useHilbertStore, _] = useState(createStore<HilbertStore>(stateCreator));

    const setPrefixConfig = useHilbertStore.getState().setPrefixConfig;
    const clearPrefixState = useHilbertStore.getState().clearPrefix;
    const clearAllPrefixes = useHilbertStore.getState().clearAllPrefixes;
    const setPrefixSplit = useHilbertStore.getState().setPrefixSplit;
    const zoomToPrefix = useHilbertStore.getState().zoomToPrefix;
    const resetZoom = useHilbertStore.getState().resetZoom;

    const useHoveredPrefix = () => {
        return useStoreSubscription(useHilbertStore, (state) => state.hoverPrefix)
    };
    return [
        useHilbertStore as HilbertStoreInstance,
        { setPrefixConfig, clearPrefixState, clearAllPrefixes, setPrefixSplit } as PrefixStateManipulation,
        { zoomToPrefix, resetZoom } as ZoomManipulation,
        useHoveredPrefix as HoveredPrefixHook
    ] as const;
}

export { useControlledHilbert, stateCreator };

export type { HilbertStoreInstance, HoverPrefix, HilbertStore };