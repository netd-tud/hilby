import { Stack, Text, Group, Popover, ColorPicker, UnstyledButton, ColorSwatch } from '@mantine/core';
import { PlaygroundColorScale } from '../rendering-functions';

export const Legend = ({
    scale,
    categoryColors,
    onCategoryColorChange
}: {
    scale: PlaygroundColorScale;
    categoryColors?: Record<string, string>;
    onCategoryColorChange?: (value: number, color: string) => void;
}) => {
    if (scale.kind === 'categorical') {
        const domain = scale.values;
        return (
            <Stack gap={4} mt="xs">
                <Text size="sm" fw={500}>Legend</Text>
                <Group gap="xs" style={{ flexWrap: 'wrap' }}>
                    {domain.map((val) => (
                        <Group key={val} gap={4}>
                            <Popover width={220} position="bottom" withArrow shadow="md">
                                <Popover.Target>
                                    <UnstyledButton
                                        title={`Category ${val}`}
                                        aria-label={`Set color for category ${val}`}
                                        style={{ display: 'inline-flex', cursor: 'pointer' }}
                                    >
                                        <ColorSwatch
                                            color={categoryColors?.[String(val)] ?? scale.colorByValue[String(val)] ?? scale.map(val).hex()}
                                            size={20}
                                            style={{ borderRadius: 4, border: 'none', boxShadow: 'none' }}
                                        />
                                    </UnstyledButton>
                                </Popover.Target>
                                {onCategoryColorChange && (
                                    <Popover.Dropdown>
                                        <ColorPicker
                                            format="hex"
                                            value={categoryColors?.[String(val)] ?? scale.colorByValue[String(val)] ?? scale.map(val).hex()}
                                            onChange={(color) => onCategoryColorChange(val, color)}
                                            swatches={[
                                                '#fafa6e',
                                                '#2A4858',
                                                '#000000',
                                                '#FFFFFF',
                                                '#FF0000',
                                                '#00FF00',
                                                '#0000FF'
                                            ]}
                                        />
                                    </Popover.Dropdown>
                                )}
                            </Popover>
                            {domain.length <= 10 && <Text size="xs">{val}</Text>}
                        </Group>
                    ))}
                </Group>
            </Stack>
        );
    }

    const domain = scale.classes || scale.domain;

    // For quantile scales, domain() returns the threshold values.
    // We want to display the color for each bucket.
    // Buckets are between domain[i] and domain[i+1].
    const segments = [];

    // If domain has only 1 value (no data or constant), handle gracefully
    if (domain.length < 2) {
        return (
            <Stack gap={4} mt="xs">
                <Text size="sm" fw={500}>Legend</Text>
                <div style={{ height: 20, width: '100%', backgroundColor: scale.scale(domain[0]).css(), borderRadius: 4 }} />
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
            <div key={i} style={{ flex: 1, backgroundColor: scale.scale(val).css() }} />
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
