import { Modal, Text, Title, Stack, ThemeIcon, Group, Code, Timeline, Button, Center } from "@mantine/core"
import { FaInfoCircle, FaFileUpload, FaClock, FaPalette, FaSearch, FaSlidersH } from "react-icons/fa";

type TutorialModalProps = {
    opened: boolean;
    close: () => void;
}

const TutorialModal: React.FC<TutorialModalProps> = (props) => {
    return (
        <Modal 
            opened={props.opened} 
            onClose={props.close} 
            centered 
            size="lg" 
            padding="xl"
            title={<Title order={3}>Welcome to the Hilby Playground</Title>}
        >
            <Stack gap="lg">
                <Text c="dimmed">
                    The playground allows you to inspect and interact with your data without having to implement any Hilby code just yet.
                </Text>

                <Group align="center" gap="sm">
                    <Text fw={600} size="xl">How to use the playground</Text>
                </Group>
                
                <Timeline active={-1} bulletSize={32} lineWidth={2}>
                    <Timeline.Item 
                        bullet={
                            <Center>
                                <FaSlidersH size={16} />
                            </Center>
                        } 
                        title="Configure Settings"
                    >
                        <Text c="dimmed" size="sm">
                            Set your preferred settings for the imported data like aggregation and default value.
                        </Text>
                    </Timeline.Item>

                    <Timeline.Item 
                        bullet={
                            <Center>
                                <FaFileUpload size={16} />
                            </Center>
                        } 
                        title="Upload Data"
                    >
                        <Text c="dimmed" size="sm">
                            Upload your data as a CSV file with the format: <Code>ipaddress/prefix, value</Code>
                        </Text>
                    </Timeline.Item>

                    <Timeline.Item 
                        bullet={
                            <Center>
                                <FaClock size={16} />
                            </Center>
                        } 
                        title="Processing"
                    >
                        <Text c="dimmed" size="sm">
                            Hilby will analyze the data type, covering prefix and resolution for your data. For performance reasons, the resolution is caped at /24. 
                            The collected information is used to store the data in an <a href="https://github.com/netd-tud/hilby/">efficient format for Hilby</a>.
                        </Text>
                    </Timeline.Item>

                    <Timeline.Item 
                        bullet={
                            <Center>
                                <FaPalette size={16} />
                            </Center>
                        } 
                        title="Customize Appearance"
                    >
                        <Text c="dimmed" size="sm">
                            Select the default color scheme or a custom color range to best visualize your data.
                        </Text>
                    </Timeline.Item>

                    <Timeline.Item 
                        bullet={
                            <Center>
                                <FaSearch size={16} />
                            </Center>
                        } 
                        title="Explore"
                    >
                        <Text c="dimmed" size="sm">
                            Explore your data with the help of the controls area!
                        </Text>
                    </Timeline.Item>
                </Timeline>

                <Button fullWidth onClick={props.close} size="md" mt="md">
                    Get Started
                </Button>
            </Stack>
        </Modal>
    )
}

export default TutorialModal;
