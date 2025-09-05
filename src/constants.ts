const baseColor = "oklch(0.55 0.1357 267.88)";
const zeroColor = "oklch(0.25 0.0543 244.06)";

const calculatePrefixColor = (normalizedValue: number) => {
    return `oklch(${normalizedValue*0.6 +0.4} 0.1357 267.88)`;
}

export {baseColor,zeroColor, calculatePrefixColor};