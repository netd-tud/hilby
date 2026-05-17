import { Button, Container, Group, Image, Text, Title } from "@mantine/core";
import { FaBook, FaGithub, FaInfoCircle } from "react-icons/fa";
import ripeLogo from "../ripe_stat_logo.png";
import routeviewsLogo from "../routeviews_logo.png";
import peeringDBLogo from "../peering_db_logo.png";

interface HeaderProps {
    openTutorial: () => void;
}

/**
 * Header component displaying the application title, logos, and action buttons.
 */
export default function Header({ openTutorial }: HeaderProps) {
    return (
        <Container size="xl" py="md">
            <Group justify="space-between">
                <div>
                    <Title order={1}>Hilby</Title>
                    <Text c="dimmed" size="lg">Hilbert Interactive Prefix Plots</Text>
                </div>
                <Group justify="center">
                    <Group mr={"xl"}>
                        <Text size="md" mr={-15}>Live Data provided by</Text>
                        <a target="_blank" href="https://stat.ripe.net/">
                            <Image src={ripeLogo} h={30} w={150} />
                        </a>
                        <a target="_blank" href="https://www.routeviews.org/routeviews/">
                            <Image src={routeviewsLogo} h={30} w={30} />
                        </a>
                        <a target="_blank" href="https://www.peeringdb.com/" style={{ marginLeft: "10px" }}>
                            <Image src={peeringDBLogo} h={35} w={150} />
                        </a>
                    </Group>

                    <Group>
                        <Button.Group mr={"lg"}>
                            <Button component="a" variant="light" leftSection={<FaGithub />}
                                target="_blank" href="https://github.com/netd-tud/hilby">
                                GitHub
                            </Button>
                            <Button variant="light" leftSection={<FaBook />} component='a'
                                target="_blank" href="https://github.com/netd-tud/hilby/blob/master/README.md">
                                Docs
                            </Button>
                            <Button variant="light" onClick={openTutorial} leftSection={<FaInfoCircle />}>
                                Shortcuts
                            </Button>
                        </Button.Group>
                    </Group>
                </Group>
            </Group>
        </Container>
    );
}
