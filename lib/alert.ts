import { Alert, Platform } from 'react-native';

/**
 * Cross-platform alert. React Native's `Alert.alert` does nothing on
 * react-native-web, so on web we fall back to the browser dialog.
 */
export function notify(title: string, message?: string) {
    if (Platform.OS === 'web') {
        (globalThis as any).alert?.(message ? `${title}\n\n${message}` : title);
    } else {
        Alert.alert(title, message);
    }
}

/**
 * Confirm dialog with a destructive action, cross-platform.
 * On web uses window.confirm; on native uses a two-button Alert.
 */
export function confirmDestructive(
    title: string,
    message: string,
    confirmLabel: string,
    onConfirm: () => void,
) {
    if (Platform.OS === 'web') {
        if ((globalThis as any).confirm?.(`${title}\n\n${message}`)) onConfirm();
    } else {
        Alert.alert(title, message, [
            { text: 'Cancel', style: 'cancel' },
            { text: confirmLabel, style: 'destructive', onPress: onConfirm },
        ]);
    }
}
