import { Alert, Button, Divider, Group, Input, Paper, Stack, Switch, Text } from "@mantine/core";
import { DatePickerInput } from '@mantine/dates';
import AsyncSelect from 'react-select/async';
import { IoWarningOutline } from "react-icons/io5";
import { baseColor } from "../constants";
import Legend from "../Legend";
import { generateIPv4ExpansionPrefixes, generateIPv6ExpansionPrefixes } from "../utils/prefix-utils";
import { UsedData } from "../hooks/useHilbyWorker";

export interface DataSourceConfig {
    selectedAS: string;
    setSelectedAS: (val: string) => void;
    debouncedGetName: (inputValue: string, callback: (options: { label: string; value: number }[]) => void) => void;
    selectedDate: string | null;
    handleDateSelect: (val: string | null) => void;
    source: "ripe" | "routeviews";
    setSource: (val: "ripe" | "routeviews") => void;
    lockSource: boolean;
    ipv6: boolean;
    setIpv6: (val: boolean) => void;
}

export interface MapControls {
    collapseStatus: boolean;
    setCollapseStatus: (val: boolean) => void;
    topPrefix: string;
    setTopPrefix: (val: string) => void;
    prefixManipulation: { setPrefixSplit: (prefix: string | string[], split: boolean | null) => void };
    zoomManipulation: { resetZoom: () => void; zoomToPrefix: (prefix: string) => boolean };
    setUsedData: (val: UsedData | null) => void;
}

export interface SearchConfig {
    target: string;
    setTarget: (val: string) => void;
    status: boolean;
    setStatus: (val: boolean) => void;
}

export interface UIState {
    isLoading: boolean;
    parsingText: string;
}

interface ControlPanelProps {
    dataSource: DataSourceConfig;
    mapControls: MapControls;
    search: SearchConfig;
    ui: UIState;
}

/**
 * Control Panel component containing all the controls for the Hilbert Map.
 */
export default function ControlPanel({
    dataSource,
    mapControls,
    search,
    ui
}: ControlPanelProps) {

    const handleIPv6Change = (e: React.ChangeEvent<HTMLInputElement>) => {
        const isIPv6 = e.currentTarget.checked;
        dataSource.setIpv6(isIPv6);
        mapControls.setUsedData(null);
        mapControls.setCollapseStatus(false);
        mapControls.setTopPrefix(isIPv6 ? "2000::/4" : "0.0.0.0/0");
    };

    const handleExpandCollapse = () => {
        if (!mapControls.collapseStatus) {
            let prefixes: string[] = [];
            if (!dataSource.ipv6) {
                prefixes = generateIPv4ExpansionPrefixes();
            } else {
                prefixes = generateIPv6ExpansionPrefixes(mapControls.topPrefix);
            }
            mapControls.prefixManipulation.setPrefixSplit(prefixes, true);
            mapControls.setCollapseStatus(true);
        } else {
            mapControls.prefixManipulation.setPrefixSplit(mapControls.topPrefix, false);
            mapControls.setCollapseStatus(false);
        }
    };

    return (
        <Paper shadow="sm" p="md" mb="md">
            <Stack gap="md">
                {dataSource.selectedDate !== null && (
                    <Alert variant="light" color="yellow" title="Potentially Inaccurate AS Names" icon={<IoWarningOutline />} mb={"md"}>
                        Please note that the AS names shown are the current names according to PeeringDB. Therefore, the displayed name may not match the actual name of the AS at the selected date.
                    </Alert>
                )}
                
                <Group justify='space-between'>
                    <Group>
                        <Group>
                            <Text fw={700}>AS:</Text>
                            <div style={{ width: "250px" }}>
                                <AsyncSelect
                                    cacheOptions
                                    defaultValue={[{ label: "Amazon.com (AS16509)", value: 16509 }]}
                                    loadOptions={dataSource.debouncedGetName}
                                    onChange={(newValue: { label: string; value: number } | null) => {
                                        if (newValue === null) return;
                                        console.log(newValue.value);
                                        dataSource.setSelectedAS(newValue.value.toString());
                                    }}
                                    components={{
                                        DropdownIndicator: () => null,
                                        IndicatorSeparator: () => null
                                    }}
                                    styles={{
                                        input: (baseStyle) => ({
                                            ...baseStyle,
                                            height: "31.5px",
                                        }),
                                        control: (baseStyle) => ({
                                            ...baseStyle,
                                            borderColor: "var(--mantine-color-gray-4)"
                                        })
                                    }}
                                />
                            </div>
                            <DatePickerInput
                                placeholder="Go back in time"
                                maxDate={new Date()}
                                value={dataSource.selectedDate ? (() => {
                                    const [y, m, d] = dataSource.selectedDate.split('-').map(Number);
                                    return new Date(y, m - 1, d);
                                })() : null}
                                onChange={(date: Date | string | null) => {
                                    if (!date) {
                                        dataSource.handleDateSelect(null);
                                        return;
                                    }

                                    // If it's already a string in YYYY-MM-DD format, use it directly
                                    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
                                        dataSource.handleDateSelect(date);
                                        return;
                                    }

                                    // Fallback for Date objects or other formats
                                    const actualDate = date instanceof Date ? date : new Date(date);
                                    
                                    if (!isNaN(actualDate.getTime())) {
                                       const year = actualDate.getFullYear();
                                       const month = String(actualDate.getMonth() + 1).padStart(2, '0');
                                       const day = String(actualDate.getDate()).padStart(2, '0');
                                       dataSource.handleDateSelect(`${year}-${month}-${day}`);
                                    } else {
                                        dataSource.handleDateSelect(null);
                                    }
                                }}
                                clearable
                                size="md"
                                w="210px"
                            />
                        </Group>
                        <Group>
                            <Text fw={700}>Protocol:</Text>
                            <Switch
                                onChange={handleIPv6Change}
                                disabled={ui.isLoading}
                                checked={dataSource.ipv6}
                                onLabel="IPv6" offLabel="IPv4"
                                size='lg'
                                color={baseColor}
                                styles={{
                                    track: {
                                        backgroundColor: "oklch(0.55 0.1357 267.88)",
                                        borderColor: "oklch(0.55 0.1357 267.88)",
                                        color: "white",
                                        '&[data-checked]': {
                                            backgroundColor: "oklch(0.55 0.1357 267.88)",
                                            borderColor: "oklch(0.55 0.1357 267.88)",
                                        }
                                    }
                                }}
                            />
                        </Group>
                        <Group>
                            <Text fw={700}>Data Provider:</Text>
                            <Switch
                                onChange={() => {
                                    dataSource.setSource(dataSource.source === "routeviews" ? "ripe" : "routeviews")
                                }}
                                disabled={ui.isLoading || dataSource.lockSource}
                                checked={dataSource.source === "ripe"}
                                onLabel="RIPEstat RIS" offLabel="Routeviews"
                                size='lg'
                                color={baseColor}
                                styles={{
                                    track: {
                                        backgroundColor: "oklch(0.55 0.1357 267.88)",
                                        borderColor: "oklch(0.55 0.1357 267.88)",
                                        color: "white",
                                        '&[data-checked]': {
                                            backgroundColor: "oklch(0.55 0.1357 267.88)",
                                            borderColor: "oklch(0.55 0.1357 267.88)",
                                        }
                                    }
                                }}
                            />
                        </Group>
                    </Group>
                    <Group>
                        {/* Action buttons */}
                        <Button color={baseColor}
                            size='md'
                            w="152px"
                            onClick={handleExpandCollapse}>
                            {!mapControls.collapseStatus ? (dataSource.ipv6 ? "Expand all /10s" : "Expand all /8s") : "Collapse to /0"}
                        </Button>
                        <Button color={baseColor} size='md' onClick={() => {
                            mapControls.zoomManipulation.resetZoom();
                        }}>
                            Reset Zoom
                        </Button>
                    </Group>
                </Group>

                <Divider />

                <Group justify="space-between">
                    <Group w="100%">
                        <Legend />
                        <Group>
                            <Text> Search for prefix:</Text>
                            <Input
                                value={search.target}
                                onChange={(e) => { search.setTarget(e.currentTarget.value); search.setStatus(true); }}
                                onKeyUp={(e) => {
                                    if (e.key === "Enter") {
                                        const result = mapControls.zoomManipulation.zoomToPrefix(search.target);
                                        search.setStatus(result);
                                    }
                                }}
                                error={!search.status}
                            ></Input>
                        </Group>
                        <Text ml="auto"> {ui.parsingText}</Text>
                    </Group>
                </Group>
            </Stack>
        </Paper>
    );
}
