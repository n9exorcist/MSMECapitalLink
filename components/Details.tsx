import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { styles } from './styles';

interface DetailsProps {
    onNavigate: (target: 'DASHBOARD' | 'LOAN_VIEW') => void;
}

export default function Details({ onNavigate }: DetailsProps) {
    return (
        <View style={styles.phoneFrame}>
            <View style={styles.navigationHeaderBackBar}>
                <TouchableOpacity style={styles.roundIconButton} onPress={() => onNavigate('DASHBOARD')}>
                    <Text style={styles.chevronIconStyle}>←</Text>
                </TouchableOpacity>
                <Text style={styles.navigationHeaderMiddleTitle}>Details</Text>
                <TouchableOpacity style={styles.roundIconButton}><Text style={styles.chevronIconStyle}>☰</Text></TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 }}>
                <Text style={styles.innerCardBoldSubheading}>Payments On Time</Text>
                <TouchableOpacity style={styles.miniRoundArrowButton} onPress={() => onNavigate('LOAN_VIEW')}>
                    <Text style={{ color: '#fff', fontSize: 12 }}>→</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.horizontalCalendarTimelineRow}>
                <View style={styles.calendarDayColumnItem}><Text style={styles.calDayLabel}>Mon</Text><Text style={styles.calDateLabel}>22</Text></View>
                <View style={styles.calendarDayColumnItem}><Text style={styles.calDayLabel}>Tue</Text><Text style={styles.calDateLabel}>23</Text></View>
                <View style={styles.calendarDayColumnItem}><Text style={styles.calDayLabel}>Wed</Text><Text style={styles.calDateLabel}>24</Text></View>
                <View style={styles.calendarDayColumnItemActive}><Text style={styles.calDayLabelActive}>Thu</Text><Text style={styles.calDateLabelActive}>25</Text></View>
                <View style={styles.calendarDayColumnItem}><Text style={styles.calDayLabel}>Fri</Text><Text style={styles.calDateLabel}>26</Text></View>
                <View style={styles.calendarDayColumnItem}><Text style={styles.calDayLabel}>Sat</Text><Text style={styles.calDateLabel}>27</Text></View>
            </View>

            <Text style={[styles.innerCardBoldSubheading, { marginTop: 20, marginBottom: 12 }]}>Your Credits</Text>

            <View style={styles.pillsRow}>
                <View style={styles.pillActive}><Text style={styles.pillTextActive}>All</Text></View>
                <View style={styles.pillInactive}><Text style={styles.pillTextInactive}>Active</Text></View>
                <View style={styles.pillInactive}><Text style={styles.pillTextInactive}>In Active</Text></View>
                <View style={styles.pillInactive}><Text style={styles.pillTextInactive}>🎛</Text></View>
            </View>

            <TouchableOpacity style={styles.premiumGlassCreditDetailsCardFrame} onPress={() => onNavigate('LOAN_VIEW')}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={styles.bankAvatarIconEmblemBox}><Text style={{ fontSize: 16 }}>🏛</Text></View>
                        <View style={{ marginLeft: 12 }}>
                            <Text style={styles.bankAccountCorporateTitleText}>Smart Bank Uk</Text>
                            <Text style={styles.bankAccountLoanProductTagLabelText}>Auto Loan</Text>
                        </View>
                    </View>
                    <View style={styles.roundIconButton}><Text style={{ fontSize: 14 }}>↗</Text></View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                    <View>
                        <Text style={styles.metricsGridDimmedCaptionLabel}>Paid Amount</Text>
                        <Text style={styles.prominentBoldMetricCashValueDisplay}>$15,850</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.metricsGridDimmedCaptionLabel}>Term</Text>
                        <Text style={styles.metricBoldDetailsValueDisplay}>36 Weeks</Text>
                    </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                    <Text style={styles.metricsGridDimmedCaptionLabel}>Next Payment Date</Text>
                    <Text style={styles.metricBoldDetailsValueDisplay}>15/03/2026</Text>
                </View>

                <View style={{ marginVertical: 12 }}>
                    <View style={styles.gradientTrackBackground}>
                        <View style={[styles.triangleBlackPointerArrowPinIndicator, { left: '78%' }]} />
                    </View>
                    <View style={styles.gradientAxisLabelsRow}>
                        <Text style={styles.axisTicksText}>$0</Text>
                        <Text style={styles.axisTicksText}>$15,850</Text>
                        <Text style={styles.axisTicksText}>$20,000</Text>
                    </View>
                </View>

                <View style={styles.dividerHairlineSeparatorLine} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                    <View>
                        <Text style={styles.metricsGridDimmedCaptionLabel}>Date of Issued</Text>
                        <Text style={styles.metricBoldDetailsValueDisplay}>15/03/2025</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.metricsGridDimmedCaptionLabel}>Interest Rate</Text>
                        <Text style={styles.metricBoldDetailsValueDisplay}>9.5% ARP</Text>
                    </View>
                </View>
            </TouchableOpacity>
        </View>
    );
}