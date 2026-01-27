import { Container, Group, Text } from "@mantine/core";
import { baseColor } from "../constants";

/**
 * Footer component displaying credits and links.
 */
export default function Footer() {
    return (
        <Container size="xl" py="sm">
            <Group justify='center' mb="sm">
                <Group>
                    <Text size="md">
                        Built at <a
                            style={{
                                color: baseColor,
                                textDecorationLine: "none",
                                fontWeight: 700
                            }}
                            href="https://netd.inf.tu-dresden.de/">
                            TUD NETD
                        </a>
                    </Text>
                </Group>
                <Text>|</Text>
                <Group>
                    <Text size="md">
                        Presented at <a
                            style={{
                                color: baseColor,
                                textDecorationLine: "none",
                                fontWeight: 700
                            }}
                            href="https://doi.org/10.1145/3744969.3748402">
                            SIGCOMM
                        </a>
                    </Text>
                </Group>
            </Group>
        </Container>
    );
}
