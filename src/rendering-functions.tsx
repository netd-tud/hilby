import { RenderFunction } from "../";

const coloring: RenderFunction = (_prefix: string, _long: bigint, _netmask: number, config) => {
    const normalizedValue = config.properties["subnets"] || 0;
    let color = "";

    if (normalizedValue === 0) {
        color = "oklch(0.25 0.0543 244.06)";
    } else {
        color = `oklch(${normalizedValue*0.6 +0.4} 0.1357 267.88)`
    }

    config.style.backgroundColor = color;

    const brightness = normalizedValue*200 + 50;
    const textColor = (brightness > 175) ? 'black' : 'white';
    config.style.color = textColor;
}

const getPercentage: RenderFunction = (prefix, _long, _netmask, config) => {
    const normalizedValue = config.properties["subnets"] || 0;
    config.innerContent.push(<div style={{fontSize: "8cqw"}} key={prefix}>{(normalizedValue*100).toFixed(3)}%</div>);
}

const newAdd: RenderFunction = (prefix, _long, _netmask, config) => {
    config.innerContent.push(<div style={{fontSize: "12cqw", fontWeight:"500", paddingTop: "-1%"}}key="prefix">{prefix}</div>);
}

export { coloring, getPercentage, newAdd };