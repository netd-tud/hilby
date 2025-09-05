import { Box, Group, Text } from "@mantine/core";
import { calculatePrefixColor, zeroColor } from "./constants";

const Legend: React.FC = () => {
    const image = `linear-gradient(to right, ${calculatePrefixColor(0)}, ${calculatePrefixColor(1)})`
    return (
        <Group>        
            <Group  w={"250px"} h="60px" gap={0} align="center">
                {/* <Group w={"200px"} h={"50px"}>
                    <Text component="div">Color:</Text>
                </Group> */}
                <Group  w={"250px"} h={"60px"} align="center">
                    <Text component="div" fw={600}>% prefixes announced by ASN</Text>
                </Group>
            </Group>        
            <Group>
            <Group w="50px" h="50px" gap={0}>
                <Group w={"50px"} h={"50px"}>
                    <Box w={"50px"} h={"25px"} style={{
                        backgroundColor: zeroColor
                    }}>
                    </Box>
                </Group>
                <Group  w={"50px"} h={"30px"} mt={"-15px"}>
                    <Text component="span" ta={"center"} w="100%">{"0%"}</Text>
                </Group>
            </Group>
            <Group w="200px" h="50px" gap={0}>
                <Group w={"200px"} h={"50px"}>
                    <Box w={"200px"} h={"25px"} style={{
                        backgroundImage: image
                    }}>
                    </Box>
                </Group>
                <Group  w={"200px"} h={"30px"} mt={"-15px"}>
                    <Text component="span" ta={"left"}>{">0%"}</Text>
                    <Text component="span" ta={"right"} ml={"auto"}>{"100%"}</Text>
                </Group>
            </Group>
            </Group>
        </Group>

    )
}

export default Legend;
