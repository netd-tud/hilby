import { useEffect, useState } from "react";
import { HilbertStoreInstance } from "./useControlledHilbert";
import { Netmask } from "netmask";
import { RenderFunction } from "./InteractiveHilbert";

type KeyBindingsSettings = {
    originalTopPrefix: string;
    minLevel?: number;
    maxLevel?: number;
    zoomInKey?: string;
    zoomOutKey?: string;
}

const useEnableKeyBindings = (hilbertStore: HilbertStoreInstance, settings: KeyBindingsSettings) => {

    const [topPrefix, setTopPrefix] = useState(settings.originalTopPrefix);

    useEffect(() => {
        const x = (e: KeyboardEvent) => {
            if (e.key === (settings.zoomInKey ?? "e")) {

                const hoverPrefix = hilbertStore.getState().hoverPrefix;
                const prefix = hoverPrefix.prefix;
                const netmaskSize = parseInt(prefix.split("/")[1])

                // We only support even prefixes anyways
                if (netmaskSize % 2 !== 0) return;

                if (netmaskSize >= (settings.maxLevel ?? 32)) return;

                setTopPrefix(prefix);
            }

            if (e.key === (settings.zoomOutKey ?? "q")) {
                const top = new Netmask(topPrefix);
                if (top.bitmask < (settings.minLevel ?? 0) + 2) return;
                const oneUp = new Netmask(top.base + "/" + (top.bitmask - 2).toString())

                setTopPrefix(oneUp.base + "/" + oneUp.bitmask.toString())
            }
        }

        window.addEventListener("keyup", x)
        return () => window.removeEventListener("keyup", x);
    }, [settings.originalTopPrefix, hilbertStore])

    return topPrefix;
}

const basicColorRendering: (colorProperty: string, minValue: number, maxValue: number) => RenderFunction = (colorProperty: string, minValue: number, maxValue: number) => {

    return (_prefix: string, _base: number, netmask: number, config: any) => {
        let color = "(0,0,0)";

        const value = config.properties[colorProperty] as number;
        if (value !== undefined) {
            const number_of_ips = 2 ** (32 - netmask);

            let normalizedValue = value / number_of_ips;

            // Ensure legal values for visualization
            if (normalizedValue < minValue) {
                normalizedValue = minValue;
            }
            if (normalizedValue > maxValue) {
                normalizedValue = maxValue;
            }

            // 8-bit color scheme
            const colors = [
                '(0, 0, 255)', '(0, 4, 255)', '(0, 8, 255)', '(0, 12, 255)', '(0, 16, 255)', '(0, 20, 255)', '(0, 24, 255)', '(0, 28, 255)', '(0, 32, 255)',
                '(0, 36, 255)', '(0, 40, 255)', '(0, 44, 255)', '(0, 48, 255)', '(0, 52, 255)', '(0, 56, 255)', '(0, 60, 255)', '(0, 64, 255)', '(0, 68, 255)',
                '(0, 72, 255)', '(0, 76, 255)', '(0, 80, 255)', '(0, 84, 255)', '(0, 88, 255)', '(0, 92, 255)', '(0, 96, 255)', '(0, 100, 255)', '(0, 104, 255)',
                '(0, 108, 255)', '(0, 112, 255)', '(0, 116, 255)', '(0, 120, 255)', '(0, 124, 255)', '(0, 128, 255)', '(0, 132, 255)', '(0, 136, 255)', '(0, 140, 255)',
                '(0, 144, 255)', '(0, 148, 255)', '(0, 152, 255)', '(0, 156, 255)', '(0, 160, 255)', '(0, 164, 255)', '(0, 168, 255)', '(0, 172, 255)', '(0, 176, 255)',
                '(0, 180, 255)', '(0, 184, 255)', '(0, 188, 255)', '(0, 192, 255)', '(0, 196, 255)', '(0, 200, 255)', '(0, 204, 255)', '(0, 208, 255)', '(0, 212, 255)',
                '(0, 216, 255)', '(0, 220, 255)', '(0, 224, 255)', '(0, 228, 255)', '(0, 232, 255)', '(0, 236, 255)', '(0, 240, 255)', '(0, 244, 255)', '(0, 248, 255)',
                '(0, 252, 255)', '(0, 255, 254)', '(0, 255, 250)', '(0, 255, 246)', '(0, 255, 242)', '(0, 255, 238)', '(0, 255, 234)', '(0, 255, 230)', '(0, 255, 226)',
                '(0, 255, 222)', '(0, 255, 218)', '(0, 255, 214)', '(0, 255, 210)', '(0, 255, 206)', '(0, 255, 202)', '(0, 255, 198)', '(0, 255, 194)', '(0, 255, 190)',
                '(0, 255, 186)', '(0, 255, 182)', '(0, 255, 178)', '(0, 255, 174)', '(0, 255, 170)', '(0, 255, 166)', '(0, 255, 162)', '(0, 255, 158)', '(0, 255, 154)',
                '(0, 255, 150)', '(0, 255, 146)', '(0, 255, 142)', '(0, 255, 138)', '(0, 255, 134)', '(0, 255, 130)', '(0, 255, 126)', '(0, 255, 122)', '(0, 255, 118)',
                '(0, 255, 114)', '(0, 255, 110)', '(0, 255, 106)', '(0, 255, 102)', '(0, 255, 98)', '(0, 255, 94)', '(0, 255, 90)', '(0, 255, 86)', '(0, 255, 82)',
                '(0, 255, 78)', '(0, 255, 74)', '(0, 255, 70)', '(0, 255, 66)', '(0, 255, 62)', '(0, 255, 58)', '(0, 255, 54)', '(0, 255, 50)', '(0, 255, 46)',
                '(0, 255, 42)', '(0, 255, 38)', '(0, 255, 34)', '(0, 255, 30)', '(0, 255, 26)', '(0, 255, 22)', '(0, 255, 18)', '(0, 255, 14)', '(0, 255, 10)',
                '(0, 255, 6)', '(0, 255, 2)', '(2, 255, 0)', '(6, 255, 0)', '(10, 255, 0)', '(14, 255, 0)', '(18, 255, 0)', '(22, 255, 0)', '(26, 255, 0)',
                '(30, 255, 0)', '(34, 255, 0)', '(38, 255, 0)', '(42, 255, 0)', '(46, 255, 0)', '(50, 255, 0)', '(54, 255, 0)', '(58, 255, 0)', '(62, 255, 0)',
                '(66, 255, 0)', '(70, 255, 0)', '(74, 255, 0)', '(78, 255, 0)', '(82, 255, 0)', '(86, 255, 0)', '(90, 255, 0)', '(94, 255, 0)', '(98, 255, 0)',
                '(102, 255, 0)', '(106, 255, 0)', '(110, 255, 0)', '(114, 255, 0)', '(118, 255, 0)', '(122, 255, 0)', '(126, 255, 0)', '(130, 255, 0)', '(134, 255, 0)',
                '(138, 255, 0)', '(142, 255, 0)', '(146, 255, 0)', '(150, 255, 0)', '(154, 255, 0)', '(158, 255, 0)', '(162, 255, 0)', '(166, 255, 0)', '(170, 255, 0)',
                '(174, 255, 0)', '(178, 255, 0)', '(182, 255, 0)', '(186, 255, 0)', '(190, 255, 0)', '(194, 255, 0)', '(198, 255, 0)', '(202, 255, 0)', '(206, 255, 0)',
                '(210, 255, 0)', '(214, 255, 0)', '(218, 255, 0)', '(222, 255, 0)', '(226, 255, 0)', '(230, 255, 0)', '(234, 255, 0)', '(238, 255, 0)', '(242, 255, 0)',
                '(246, 255, 0)', '(250, 255, 0)', '(254, 255, 0)', '(255, 252, 0)', '(255, 248, 0)', '(255, 244, 0)', '(255, 240, 0)', '(255, 236, 0)', '(255, 232, 0)',
                '(255, 228, 0)', '(255, 224, 0)', '(255, 220, 0)', '(255, 216, 0)', '(255, 212, 0)', '(255, 208, 0)', '(255, 204, 0)', '(255, 200, 0)', '(255, 196, 0)',
                '(255, 192, 0)', '(255, 188, 0)', '(255, 184, 0)', '(255, 180, 0)', '(255, 176, 0)', '(255, 172, 0)', '(255, 168, 0)', '(255, 164, 0)', '(255, 160, 0)',
                '(255, 156, 0)', '(255, 152, 0)', '(255, 148, 0)', '(255, 144, 0)', '(255, 140, 0)', '(255, 136, 0)', '(255, 132, 0)', '(255, 128, 0)', '(255, 124, 0)',
                '(255, 120, 0)', '(255, 116, 0)', '(255, 112, 0)', '(255, 108, 0)', '(255, 104, 0)', '(255, 100, 0)', '(255, 96, 0)', '(255, 92, 0)', '(255, 88, 0)',
                '(255, 84, 0)', '(255, 80, 0)', '(255, 76, 0)', '(255, 72, 0)', '(255, 68, 0)', '(255, 64, 0)', '(255, 60, 0)', '(255, 56, 0)', '(255, 52, 0)', '(255, 48, 0)',
                '(255, 44, 0)', '(255, 40, 0)', '(255, 36, 0)', '(255, 32, 0)', '(255, 28, 0)', '(255, 24, 0)', '(255, 20, 0)', '(255, 16, 0)', '(255, 12, 0)', '(255, 8, 0)',
                '(255, 4, 0)']


            const index = Math.floor((normalizedValue - minValue) / (maxValue - minValue) * 255);
            color = colors[index];
        }

        const rgb = color.substring(1, color.length - 1).split(",");
        const brightness = Math.round(((parseInt(rgb[0]) * 299) +
            (parseInt(rgb[1]) * 587) +
            (parseInt(rgb[2]) * 114)) / 1000);
        const textColour = (brightness > 125) ? 'black' : 'white';

        config.style.backgroundColor = `rgb${color}`;
        config.style.color = textColour;
    }

};

const addPrefixIntoBody: RenderFunction = (prefix, _base, _netmask, config) => {
    config.innerContent.push(<div key="prefix">{prefix}</div>);
}

export { useEnableKeyBindings, basicColorRendering, addPrefixIntoBody };