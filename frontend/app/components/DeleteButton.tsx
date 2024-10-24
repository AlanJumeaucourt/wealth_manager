import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Alert, Platform, Pressable, StyleSheet } from "react-native";
import { Text } from "react-native-paper";

interface DeleteButtonProps {
    deleteText: string;
    deleteTextAlert: string;
    deleteFunction: () => Promise<void>; // Ensure this returns a Promise
}

export const DeleteButton: React.FC<DeleteButtonProps> = ({ deleteText, deleteTextAlert, deleteFunction }) => {
    const navigation = useNavigation();

    const handleDelete = () => {
        Alert.alert(
            "Confirm Deletion",
            deleteTextAlert,
            [
                {
                    text: "Cancel",
                    style: "cancel",
                },
                {
                    text: "Delete",
                    onPress: async () => {
                        try {
                            await deleteFunction(); // Await the delete function
                            Alert.alert("Deletion Status", "Deletion successful.", [
                                {
                                    text: "OK",
                                }
                            ]);
                        } catch (error) {
                            // Ensure error is caught and has a message
                            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred.";
                            Alert.alert("Deletion Status", `Error deleting: ${errorMessage}`, [
                                {
                                    text: "OK",
                                }
                            ]);
                        }
                    },
                    style: "destructive"
                }
            ]
        );
    };

    return (
        <Pressable onPress={handleDelete} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={24} color="red" />
            <Text style={styles.deleteButtonText}>{deleteText}</Text>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    deleteButton: {
        marginLeft: 2,
        marginTop: Platform.OS === 'ios' ? 20 : 0,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    deleteButtonText: {
        marginRight: 8,
        color: 'red',
        marginLeft: 8,
    },
});