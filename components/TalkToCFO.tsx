import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Linking, Alert } from 'react-native';
import { C, T } from '@/constants/theme';

export interface CFOAdvisor {
    name: string;
    phone: string;        // E.164, e.g. "+919876543210"
    whatsapp?: string;    // defaults to phone if omitted
    email: string;
    bookingUrl?: string;  // Calendly / Cal.com link for "Schedule a review"
}

// Replace these with the MSME's ASSIGNED advisor (ideally fetched from Supabase),
// or pass an `advisor` prop from the screen.
const DEFAULT_ADVISOR: CFOAdvisor = {
    name: 'Your MFOS CFO',
    phone: '+910000000000',          // TODO
    email: 'cfo@mfos.app',           // TODO
    bookingUrl: 'https://mfos.app/book', // TODO
};

const onlyDigits = (s: string) => s.replace(/[^\d]/g, '');

async function openLink(url: string, fallbackMsg: string) {
    try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
            return;
        }
        throw new Error('unsupported');
    } catch {
        Alert.alert('Could not open', fallbackMsg);
    }
}

interface Props {
    visible: boolean;
    onClose: () => void;
    advisor?: CFOAdvisor;
    /** Pre-filled into the WhatsApp / email body. */
    prefillMessage?: string;
}

export function TalkToCFO({
    visible,
    onClose,
    advisor = DEFAULT_ADVISOR,
    prefillMessage = 'Hi, I need help with my business numbers.',
}: Props) {
    const wa = onlyDigits(advisor.whatsapp ?? advisor.phone);
    const msg = encodeURIComponent(prefillMessage);

    const options = [
        {
            icon: '📞',
            label: 'Call my CFO',
            sub: advisor.name,
            run: () => openLink(`tel:${advisor.phone}`, `Call ${advisor.phone}`),
        },
        {
            icon: '💬',
            label: 'WhatsApp my CFO',
            sub: 'Usually replies in minutes',
            run: () => openLink(`https://wa.me/${wa}?text=${msg}`, `WhatsApp ${advisor.phone}`),
        },
        {
            icon: '✉️',
            label: 'Email my CFO',
            sub: advisor.email,
            run: () =>
                openLink(
                    `mailto:${advisor.email}?subject=${encodeURIComponent('MFOS — need help')}&body=${msg}`,
                    `Email ${advisor.email}`,
                ),
        },
        {
            icon: '📅',
            label: 'Schedule a review',
            sub: 'Pick a slot for a video / office review',
            run: () =>
                advisor.bookingUrl
                    ? openLink(advisor.bookingUrl, 'Open your booking link')
                    : Alert.alert('Booking', 'No booking link set up yet.'),
        },
    ];

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            {/* Tap outside the sheet to close */}
            <Pressable style={styles.backdrop} onPress={onClose}>
                {/* Inner Pressable swallows taps so they don't close the sheet */}
                <Pressable style={styles.sheet} onPress={() => { }}>
                    <View style={styles.handle} />
                    <Text style={styles.title}>Talk to my CFO</Text>
                    <Text style={styles.subtitle}>{advisor.name} • here to help</Text>

                    <View style={styles.list}>
                        {options.map((o) => (
                            <Pressable
                                key={o.label}
                                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                                onPress={() => {
                                    o.run();
                                    onClose();
                                }}
                            >
                                <View style={styles.iconWrap}>
                                    <Text style={styles.icon}>{o.icon}</Text>
                                </View>
                                <View style={styles.rowText}>
                                    <Text style={styles.rowLabel}>{o.label}</Text>
                                    <Text style={styles.rowSub} numberOfLines={1}>{o.sub}</Text>
                                </View>
                                <Text style={styles.chevron}>›</Text>
                            </Pressable>
                        ))}
                    </View>

                    <Pressable style={styles.cancel} onPress={onClose}>
                        <Text style={styles.cancelText}>Close</Text>
                    </Pressable>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: C.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 32,
    },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 16 },
    title: { fontSize: T.lg, fontWeight: '800', color: C.navy },
    subtitle: { fontSize: T.sm, fontWeight: '600', color: C.textSub, marginTop: 2, marginBottom: 16 },
    list: { gap: 10 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.bg,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: C.border,
    },
    rowPressed: { opacity: 0.7 },
    iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: `${C.teal}14`,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    icon: { fontSize: 20, lineHeight: 24 },
    rowText: { flex: 1 },
    rowLabel: { fontSize: T.base, fontWeight: '700', color: C.text },
    rowSub: { fontSize: T.xs, color: C.textMuted, marginTop: 2 },
    chevron: { fontSize: 22, fontWeight: '400', color: C.textMuted, marginLeft: 8 },
    cancel: {
        marginTop: 16,
        paddingVertical: 14,
        alignItems: 'center',
        borderRadius: 14,
        backgroundColor: C.bg,
    },
    cancelText: { fontSize: T.base, fontWeight: '700', color: C.textSub },
});
