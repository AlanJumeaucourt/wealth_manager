import { darkTheme } from '@/constants/theme';
import { Platform, StyleSheet } from 'react-native';

export const sharedStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: darkTheme.colors.background,
    },
    safeArea: {
        flex: 1,
        backgroundColor: darkTheme.colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: darkTheme.spacing.m,
        paddingTop: Platform.OS === 'ios' ? 60 : darkTheme.spacing.m,
        paddingBottom: darkTheme.spacing.m,
        backgroundColor: darkTheme.colors.surface,
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
        marginRight: 30, // This offsets the logo width to ensure true center alignment
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: darkTheme.colors.text,
    },
    body: {
        flex: 1,
        backgroundColor: darkTheme.colors.background,
        paddingBottom: Platform.OS === 'ios' ? 0 : 0,
    },
    card: {
        backgroundColor: darkTheme.colors.surface,
        borderRadius: darkTheme.borderRadius.l,
        padding: darkTheme.spacing.m,
        marginBottom: darkTheme.spacing.m,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: darkTheme.colors.text,
        marginBottom: darkTheme.spacing.m,
    },
    text: {
        color: darkTheme.colors.text,
    },
    textSecondary: {
        color: darkTheme.colors.textSecondary,
        fontSize: 14,
    },
    button: {
        backgroundColor: darkTheme.colors.primary,
        paddingVertical: darkTheme.spacing.s,
        paddingHorizontal: darkTheme.spacing.m,
        borderRadius: darkTheme.borderRadius.m,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: darkTheme.colors.text,
        fontSize: 16,
        fontWeight: '600',
    },
    input: {
        backgroundColor: darkTheme.colors.surface,
        borderRadius: darkTheme.borderRadius.m,
        padding: darkTheme.spacing.m,
        color: darkTheme.colors.text,
        borderWidth: 1,
        borderColor: darkTheme.colors.border,
        marginBottom: darkTheme.spacing.m,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        backgroundColor: darkTheme.colors.surface,
        borderRadius: darkTheme.borderRadius.l,
        padding: darkTheme.spacing.l,
        width: '90%',
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: darkTheme.colors.text,
        marginBottom: darkTheme.spacing.m,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: darkTheme.spacing.m,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: darkTheme.colors.background,
    },
    error: {
        color: darkTheme.colors.error,
        fontSize: 14,
        marginBottom: darkTheme.spacing.m,
    },
    success: {
        color: darkTheme.colors.success,
        fontSize: 14,
        marginBottom: darkTheme.spacing.m,
    },
    divider: {
        height: 1,
        backgroundColor: darkTheme.colors.border,
        marginVertical: darkTheme.spacing.m,
    },
    icon: {
        color: darkTheme.colors.text,
    },
    iconButton: {
        padding: darkTheme.spacing.s,
    },
    list: {
        flex: 1,
    },
    listItem: {
        backgroundColor: darkTheme.colors.surface,
        padding: darkTheme.spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: darkTheme.colors.border,
    },
    chart: {
        marginVertical: darkTheme.spacing.m,
        padding: darkTheme.spacing.m,
        backgroundColor: darkTheme.colors.surface,
        borderRadius: darkTheme.borderRadius.l,
    },
    textBold: {
        fontWeight: 'bold',
    },
});

export default sharedStyles;
