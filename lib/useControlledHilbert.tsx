import { create, StateCreator, StoreApi, UseBoundStore } from "zustand";
import { SubnetConfig } from "./InteractiveHilbert";

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
    prefixState: Record<string, SubnetSettings>;
    hoverPrefix: HoverPrefix;
}

type HilbertActions = {
    setPrefixConfig: (prefix: string, state: Partial<SubnetConfig>, merge?: boolean) => void;
    setPrefixSplit: (prefix: string, split: boolean | null) => void;
    clearAllPrefixes: () => void;
    clearPrefix: (prefix: string) => void;
    setHoverPrefix: (prefix: string, config: SubnetConfig) => void;
}

type HoveredPrefixHook = () => HoverPrefix;

type PrefixStateManipulation = {
    setPrefixConfig: (prefix: string, state: Partial<SubnetConfig>) => void;
    clearPrefixState: (prefix: string) => void;
    clearAllPrefixes: () => void;
    setPrefixSplit: (prefix: string, split: boolean | null) => void;
}

type HilbertStore = HilbertState & HilbertActions;

type HilbertStoreInstance = UseBoundStore<StoreApi<HilbertStore>>;

const stateCreator: StateCreator<HilbertStore, [], []> = (set) => ({
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
        const current = state.prefixState[prefix];

        return {
            ...state,
            prefixState: {
                ...state.prefixState,
                [prefix]: {
                    ...current,
                    split: split
                }
            }
        } as HilbertStore;
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
    })
})


const useControlledHilbert = () => {

    const useHilbertStore = create<HilbertStore>(stateCreator);

    const setPrefixConfig = useHilbertStore((state) => state.setPrefixConfig);
    const clearPrefixState = useHilbertStore((state) => state.clearPrefix);
    const clearAllPrefixes = useHilbertStore((state) => state.clearAllPrefixes);
    const setPrefixSplit = useHilbertStore((state) => state.setPrefixSplit);
    const useHoveredPrefix = () => {
        return useHilbertStore((state) => state.hoverPrefix);
    };
    return [useHilbertStore as HilbertStoreInstance, { setPrefixConfig, clearPrefixState, clearAllPrefixes, setPrefixSplit } as PrefixStateManipulation, useHoveredPrefix as HoveredPrefixHook] as const;
}

export { useControlledHilbert, stateCreator };

export type { HilbertStoreInstance, HoverPrefix };