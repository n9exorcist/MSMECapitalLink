import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { styles } from './styles';

interface LoanViewProps {
    onNavigate: (target: 'DETAILS') => void;
}

export default function LoanView({ onNavigate }: LoanViewProps) {
    return (
        <View style={styles.phoneFrame}>
            <View style={styles.navigationHeaderBackBar}>
                <TouchableOpacity style={styles.roundIconButton} onPress={() => onNavigate('DETAILS')}>
                    <Text style={styles.chevronIconStyle}>←</Text>
                </TouchableOpacity>
                <Text style={styles.navigationHeaderMiddleTitle}>Auto Loan</Text>
                <TouchableOpacity style={styles.roundIconButton}><Text style={{ fontSize: 14 }}>📅</Text></TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 20 }}>
                <View>
                    <Text style={styles.largeProductHeaderHeadlineText}>Smart Bank Uk</Text>
                    <Text style={[styles.metricsGridDimmedCaptionLabel, { marginTop: 10 }]}>Paid Amount</Text>
                    <Text style={[styles.prominentBoldMetricCashValueDisplay, { fontSize: 34, marginTop: 5 }]}>$15,850</Text>
                    <Text style={[styles.metricBoldDetailsValueDisplay, { marginTop: 15, color: '#4B5563' }]}>Terms ; 36 Weeks</Text>
                </View>

                <View style={styles.radialGaugeCircleOuterRingComponent}>
                    <View style={styles.radialGaugeInnerFaceCircleCenterPlatter}>
                        <Text style={{ fontSize: 18, marginBottom: 2 }}>🕒</Text>
                        <Text style={styles.radialPercentageCoreCenterDigitLabelText}>65%</Text>
                        <Text style={styles.radialSubtextCaptionDescriptionText}>On Time</Text>
                    </View>
                </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
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

            <Text style={[styles.innerCardBoldSubheading, { marginTop: 20, marginBottom: 15 }]}>Payments Timeline</Text>

            <View style={styles.premiumGlassCreditDetailsCardFrame}>
                <Text style={styles.timelineTargetTopHeaderCaptionAnchorText}>1st Payments: 15/03/2025</Text>

                <View style={styles.calendarMatrixFlexLayoutGrid}>
                    {/* Row A */}
                    <View style={styles.gridMatrixCellItem}><Text style={styles.matrixMonthTextLabel}>Jan</Text><View style={styles.matrixStatusGreyPillCircle}><Text style={styles.matrixStatusTextLabel}>—</Text></View></View>
                    <View style={styles.gridMatrixCellItem}><Text style={styles.matrixMonthTextLabel}>Feb</Text><View style={styles.matrixStatusBluePillCircle}><Text style={styles.matrixStatusTextLabel}>✓</Text></View></View>
                    <View style={styles.gridMatrixCellItem}><Text style={styles.matrixMonthTextLabel}>Mar</Text><View style={styles.matrixStatusBluePillCircle}><Text style={styles.matrixStatusTextLabel}>✓</Text></View></View>
                    <View style={styles.gridMatrixCellItem}><Text style={styles.matrixMonthTextLabel}>Apr</Text><View style={styles.matrixStatusRedPillCircle}><Text style={styles.matrixStatusTextLabel}>✕</Text></View></View>
                    <View style={styles.gridMatrixCellItem}><Text style={styles.matrixMonthTextLabel}>May</Text><View style={styles.matrixStatusBluePillCircle}><Text style={styles.matrixStatusTextLabel}>✓</Text></View></View>
                    <View style={styles.gridMatrixCellItem}><Text style={styles.matrixMonthTextLabel}>Jun</Text><View style={styles.matrixStatusRedPillCircle}><Text style={styles.matrixStatusTextLabel}>✕</Text></View></View>

                    {/* Row B */}
                    <View style={styles.gridMatrixCellItem}><Text style={styles.matrixMonthTextLabel}>Jul</Text><View style={styles.matrixStatusGreyPillCircle}><Text style={styles.matrixStatusTextLabel}>✓</Text></View></View>
                    <View style={styles.gridMatrixCellItem}><Text style={styles.matrixMonthTextLabel}>Aug</Text><View style={styles.matrixStatusBluePillCircle}><Text style={styles.matrixStatusTextLabel}>✓</Text></View></View>
                    <View style={styles.gridMatrixCellItem}><Text style={styles.matrixMonthTextLabel}>Sep</Text><View style={styles.matrixStatusBluePillCircle}><Text style={styles.matrixStatusTextLabel}>✓</Text></View></View>
                    <View style={styles.gridMatrixCellItem}><Text style={styles.matrixMonthTextLabel}>Oct</Text><View style={styles.matrixStatusBluePillCircle}><Text style={styles.matrixStatusTextLabel}>✓</Text></View></View>
                    <View style={styles.gridMatrixCellItem}><Text style={styles.matrixMonthTextLabel}>Nov</Text><View style={styles.matrixStatusBluePillCircle}><Text style={styles.matrixStatusTextLabel}>✓</Text></View></View>
                    <View style={styles.gridMatrixCellItem}><Text style={styles.matrixMonthTextLabel}>Dec</Text><View style={styles.matrixStatusBluePillCircle}><Text style={styles.matrixStatusTextLabel}>✓</Text></View></View>
                </View>
            </View>

            <View style={styles.actionFooterButtonsRowWrapperBox}>
                <TouchableOpacity style={styles.callToActionButtonSolidLargePrimaryButton} onPress={() => alert('Processing payment request...')}>
                    <Text style={styles.callToActionButtonTextPayloadLabel}>Make a Payment</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.squareIconActionButtonAlternativeContainer}><Text style={{ fontSize: 16 }}>💬</Text></TouchableOpacity>
                <TouchableOpacity style={styles.squareIconActionButtonAlternativeContainer}><Text style={{ fontSize: 16 }}>🧮</Text></TouchableOpacity>
            </View>
        </View>
    );
}