import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from "react-native";
import { Icon } from "react-native-elements";
import { Text } from "react-native-paper";

export const BackButton = () => {
    const router = useRouter();

    return (
        <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Icon name="arrow-back" type="ionicon" color="#007AFF" size={24} />
            <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
    );
};


const styles = StyleSheet.create({
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButtonText: {
        marginLeft: 3,
        fontSize: 18,
        color: '#007AFF',
    },
});