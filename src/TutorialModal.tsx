import { Modal, List, Kbd, Text} from "@mantine/core"

type TutorialModalProps = {
    opened: boolean;
    close: () => void;
}

const TutorialModal: React.FC<TutorialModalProps> = (props) => {
    return (
        <Modal opened={props.opened} onClose={props.close} withCloseButton={false} centered size="auto" lockScroll={false}>
            <h3>How to use Hilby</h3>
            <Text>
                The Hilbert Plot is completely interactive, allowing you to:
            </Text>
            <List>
                <List.Item>Pan by holding the left mouse button or dragging with a finger.</List.Item>
                <List.Item>Zoom in and out by using the scroll wheel or a two finger zoom gesture.</List.Item>
            </List>
            <Text mt={"md"} fw={700}>
                Controls:
            </Text>
            <List>
                <List.Item><Text fw={500} component='span'>Left-click (touch): </Text><Text component='span'>Expand the hovered prefix into its four more specific prefixes by increasing the netmask by 2.</Text></List.Item>
                <List.Item><Text fw={500} component='span'>Right-click (long touch): </Text><Text component='span'>Collapse the prefix and its siblings into its less specific prefix by decreasing the netmask by 2.</Text></List.Item>
                <List.Item><Text fw={500} component='span'><Kbd>E</Kbd>: </Text><Text component='span'>Set the hovered prefix as the root prefix, allowing for a more detailed inspection. (Max depth with expanding is 24)</Text></List.Item>
                <List.Item><Text fw={500} component='span'><Kbd>Q</Kbd>: </Text><Text component='span'>Set the root prefix to the less specific covering prefix of the current root prefix by decreasing the netmask of the root prefix by 2.</Text></List.Item>
            </List>
        </Modal>
    )
}

export default TutorialModal;
