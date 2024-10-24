import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Alert, Platform, Pressable, StyleSheet } from "react-native";
import { Text } from "react-native-paper";

interface EditButtonProps {
    editText: string;
    editTextAlert: string;
    editFunction: () => Promise<void>;
}

export const EditButton: React.FC<EditButtonProps> = ({ editText, editTextAlert, editFunction }) => {
    const navigation = useNavigation();

    const handleEdit = () => {
        Alert.alert(
            "Confirm Edit",
            editTextAlert,
            [
                {
                    text: "Cancel",
                    style: "cancel",
                },
                {
                    text: "Edit",
                    onPress: async () => {
                        try {
                            await editFunction();
                            Alert.alert("Edit Status", "Edit successful.", [
                                {
                                    text: "OK",
                                }
                            ]);
                        } catch (error) {
                            // Ensure error is caught and has a message
                            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred.";
                            Alert.alert("Edit Status", `Error editing: ${errorMessage}`, [
                                {
                                    text: "OK",
                                }
                            ]);
                        }
                    },
                }
            ]
        );
    };

    return (
        <Pressable onPress={handleEdit} style={styles.editButton}>
            <Ionicons name="create-outline" size={24} color="blue" />
            <Text style={styles.editButtonText}>{editText}</Text>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    editButton: {
        marginLeft: 2,
        marginTop: Platform.OS === 'ios' ? 20 : 0,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    editButtonText: {
        marginRight: 8,
        color: 'blue',
        marginLeft: 8,
    },
});