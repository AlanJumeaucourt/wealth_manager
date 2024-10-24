import { Ionicons } from "@expo/vector-icons";
import React from 'react';
import { Alert, Platform, Pressable, StyleSheet } from "react-native";
import { Text } from "react-native-paper";

interface AddButtonProps {
    addText: string;
    addTextAlert: string;
    addFunction: () => void;
}

export const AddButton: React.FC<AddButtonProps> = ({ addText, addTextAlert, addFunction }) => {
    const handleAdd = () => {
        Alert.alert(
            "Confirm Addition",
            addTextAlert,
            [
                {
                    text: "Cancel",
                    style: "cancel",
                },
                {
                    text: "Add",
                    onPress: () => {
                        addFunction();
                        Alert.alert("Addition Status", "Addition successful.", [
                            {
                                text: "OK",
                            }
                        ]);
                    },
                    style: "default"
                }
            ]
        );
    };

    return (
        <Pressable onPress={handleAdd} style={styles.addButton}>
            <Ionicons name="add-circle-outline" size={24} color="green" />
            <Text style={styles.addButtonText}>{addText}</Text>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    addButton: {
        marginLeft: 2,
        marginTop: Platform.OS === 'ios' ? 20 : 0,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    addButtonText: {
        marginRight: 8,
        color: 'green',
        marginLeft: 8,
    },
});