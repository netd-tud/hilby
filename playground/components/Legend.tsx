import { Stack, Text, Group } from '@mantine/core';
import { Scale } from 'chroma-js';

export const Legend = ({ scale }: { scale: Scale; }) => {
    let domain;

    //@ts-expect-error typing is incorrect for chromajs, empty classes returns false if no classes are used, else the classes
    const classes = scale.classes() as false | number[];
    if (classes) {
        domain = classes as unknown as number[];
    } else {

        domain = scale.domain();
    }

    // For quantile scales, domain() returns the threshold values.
    // We want to display the color for each bucket.
    // Buckets are between domain[i] and domain[i+1].
    const segments = [];

    // If domain has only 1 value (no data or constant), handle gracefully
    if (domain.length < 2) {
        return (
            <Stack gap={4} mt="xs">
                <Text size="sm" fw={500}>Legend</Text>
                <div style={{ height: 20, width: '100%', backgroundColor: scale(domain[0]).css(), borderRadius: 4 }} />
                <Group justify="center">
                    <Text size="xs">{domain[0]?.toFixed(2) ?? "N/A"}</Text>
                </Group>
            </Stack>
        );
    }

    for (let i = 0; i < domain.length - 1; i++) {
        // Sample a value inside the bucket to get its color
        // (For quantile scales, any value in [domain[i], domain[i+1]) should yield the same color, 
        // or a color in that segment of the gradient)
        const val = (domain[i] + domain[i + 1]) / 2;
        segments.push(
            <div key={i} style={{ flex: 1, backgroundColor: scale(val).css() }} />
        );
    }

    let showValues;

    if (domain.length < 6) {
        showValues = domain.map(v => v.toFixed(2));
    } else {
        showValues = [];
        for (let i = 0; i < 5; i++) {
            showValues.push(domain[Math.floor((domain.length - 1) / 4 * i)]?.toFixed(2))

        }
    }

    return (
        <Stack gap={4} mt="xs">
            <Text size="sm" fw={500}>Legend</Text>
            <div style={{ display: 'flex', height: 20, width: '100%', borderRadius: 4, overflow: 'hidden' }}>
                {segments}
            </div>
            <Group justify="space-between">
                {showValues.map(v => (
                    <Text size="xs">{v}</Text>
                ))}
            </Group>
        </Stack>
    );
};
