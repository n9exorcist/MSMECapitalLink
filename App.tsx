import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity
} from 'react-native';

type ScreenTab = 'DASHBOARD' | 'DETAILS' | 'LOAN_VIEW';

export default function App() {
  const [activeTab, setActiveTab] = useState<ScreenTab>('DASHBOARD');

  // Helper calculation to map a credit score (620 - 920) onto a percentage width for the pointer bar
  const getScorePointerPosition = (score: number) => {
    const min = 620;
    const max = 920;
    const percentage = ((score - min) / (max - min)) * 100;
    return `${Math.min(Math.max(percentage, 0), 100)}%`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>

        {/* ======================================================== */}
        {/* SCREEN 1 LAYOUT: DASHBOARD (image_a3d328.png)            */}
        {/* ======================================================== */}
        {activeTab === 'DASHBOARD' && (
          <View style={styles.phoneFrame}>
            {/* Profile Header */}
            <View style={styles.rowHeader}>
              <View style={styles.profileRow}>
                <View style={styles.avatarPlaceholder}>
                  <Text style={{ fontSize: 18 }}>👦</Text>
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.greetingText}>Hello, Alibiya👋</Text>
                  <Text style={styles.subGreetingText}>Good Morning</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.roundIconButton}>
                <Text style={{ fontSize: 16 }}>🔔</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitleText}>Your Statistics</Text>

            {/* Bureau Pill Filters */}
            <View style={styles.pillsRow}>
              <View style={[styles.pillActive]}><Text style={styles.pillTextActive}>Transunion Score</Text></View>
              <View style={styles.pillInactive}><Text style={styles.pillTextInactive}>Experiance</Text></View>
              <View style={styles.pillInactive}><Text style={styles.pillTextInactive}>Equifax</Text></View>
            </View>

            {/* Core Score Summary Counter Display */}
            <View style={styles.scoreDataContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                <View style={styles.scoreDeltaBadge}><Text style={styles.scoreDeltaText}>+8pts ↗</Text></View>
                <View style={styles.scoreUpdateBadge}><Text style={styles.scoreUpdateText}>2 Day Left Updated</Text></View>
              </View>
              <View style={styles.scoreAbsolutePlacement}>
                <Text style={styles.hugeScoreDigit}>880</Text>
                <Text style={styles.scoreStatusLabelText}>Success</Text>
              </View>
            </View>

            {/* Dynamic Multi-Color Custom Slider Progress Bar System */}
            <View style={{ marginVertical: 10, paddingHorizontal: 5 }}>
              <View style={styles.gradientTrackBackground}>
                <View style={[styles.sliderIndicatorPointerPin, { left: getScorePointerPosition(880) as any }]} />
              </View>
              <View style={styles.gradientAxisLabelsRow}>
                <Text style={styles.axisTicksText}>620</Text>
                <Text style={styles.axisTicksText}>720</Text>
                <Text style={styles.axisTicksText}>820</Text>
                <Text style={styles.axisTicksText}>920</Text>
              </View>
            </View>

            {/* Accordion Blocks - Clicking "Recent Change" now navigates to Screen 2 */}
            <TouchableOpacity
              style={styles.accordionCardContainer}
              onPress={() => setActiveTab('DETAILS')}
            >
              <Text style={styles.accordionHeaderTitle}>Recent Change</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.redAlertNotificationBadge}><Text style={styles.redAlertNotificationText}>2</Text></View>
                <Text style={styles.chevronIconStyle}>&gt;</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.accordionCardContainer, { flexDirection: 'column', alignItems: 'stretch', height: 'auto' }]}
              onPress={() => setActiveTab('DETAILS')}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <Text style={styles.accordionHeaderTitle}>Credit History</Text>
                <Text style={styles.chevronIconStyle}>∧</Text>
              </View>

              {/* Graphical Trend Line Mockup Container */}
              <View style={styles.chartWrapperPlaceholderBlock}>
                <Text style={styles.chartDateLabelBubbleText}>13 March 2026</Text>
                <View style={styles.chartFloatingMetricIndicatorBox}>
                  <Text style={styles.chartFloatingMetricIndicatorText}>880 Transit</Text>
                </View>
                <View style={styles.mockVerticalGridAxisMarkers}>
                  <Text style={styles.axisTicksText}>920</Text>
                  <Text style={styles.axisTicksText}>820</Text>
                  <Text style={styles.axisTicksText}>720</Text>
                  <Text style={styles.axisTicksText}>620</Text>
                </View>
                <View style={styles.simulatedGraphSplineLine} />
                <View style={styles.simulatedGraphVerticalMarkerDropLine} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.accordionCardContainer}
              onPress={() => setActiveTab('DETAILS')}
            >
              <Text style={styles.accordionHeaderTitle}>Credit Factors</Text>
              <Text style={styles.chevronIconStyle}>∧</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ======================================================== */}
        {/* SCREEN 2 LAYOUT: DETAILS (image_a3d2ec.png)              */}
        {/* ======================================================== */}
        {activeTab === 'DETAILS' && (
          <View style={styles.phoneFrame}>
            <View style={styles.navigationHeaderBackBar}>
              {/* Connected Back Arrow */}
              <TouchableOpacity style={styles.roundIconButton} onPress={() => setActiveTab('DASHBOARD')}>
                <Text style={styles.chevronIconStyle}>←</Text>
              </TouchableOpacity>
              <Text style={styles.navigationHeaderMiddleTitle}>Details</Text>
              <TouchableOpacity style={styles.roundIconButton}><Text style={styles.chevronIconStyle}>☰</Text></TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 }}>
              <Text style={styles.innerCardBoldSubheading}>Payments On Time</Text>
              <TouchableOpacity style={styles.miniRoundArrowButton} onPress={() => setActiveTab('LOAN_VIEW')}>
                <Text style={{ color: '#fff', fontSize: 12 }}>→</Text>
              </TouchableOpacity>
            </View>

            {/* Calendar Horizontal Scroller Row Component */}
            <View style={styles.horizontalCalendarTimelineRow}>
              <View style={styles.calendarDayColumnItem}><Text style={styles.calDayLabel}>Mon</Text><Text style={styles.calDateLabel}>22</Text></View>
              <View style={styles.calendarDayColumnItem}><Text style={styles.calDayLabel}>Tue</Text><Text style={styles.calDateLabel}>23</Text></View>
              <View style={styles.calendarDayColumnItem}><Text style={styles.calDayLabel}>Wed</Text><Text style={styles.calDateLabel}>24</Text></View>
              <View style={styles.calendarDayColumnItemActive}><Text style={styles.calDayLabelActive}>Thu</Text><Text style={styles.calDateLabelActive}>25</Text></View>
              <View style={styles.calendarDayColumnItem}><Text style={styles.calDayLabel}>Fri</Text><Text style={styles.calDateLabel}>26</Text></View>
              <View style={styles.calendarDayColumnItem}><Text style={styles.calDayLabel}>Sat</Text><Text style={styles.calDateLabel}>27</Text></View>
            </View>

            <Text style={[styles.innerCardBoldSubheading, { marginTop: 20, marginBottom: 12 }]}>Your Credits</Text>

            {/* Toggle Tab Row Layout */}
            <View style={styles.pillsRow}>
              <View style={styles.pillActive}><Text style={styles.pillTextActive}>All</Text></View>
              <View style={styles.pillInactive}><Text style={styles.pillTextInactive}>Active</Text></View>
              <View style={styles.pillInactive}><Text style={styles.pillTextInactive}>In Active</Text></View>
              <View style={styles.pillInactive}><Text style={styles.pillTextInactive}>🎛</Text></View>
            </View>

            {/* Core Bank Account Metric Card Block - Pressing anywhere on this card navigates to Screen 3 */}
            <TouchableOpacity
              style={styles.premiumGlassCreditDetailsCardFrame}
              onPress={() => setActiveTab('LOAN_VIEW')}
            >
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

              {/* Slider Component inside individual card view */}
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
        )}

        {/* ======================================================== */}
        {/* SCREEN 3 LAYOUT: AUTO LOAN VIEW (image_a3d027.png)       */}
        {/* ======================================================== */}
        {activeTab === 'LOAN_VIEW' && (
          <View style={styles.phoneFrame}>
            <View style={styles.navigationHeaderBackBar}>
              {/* Connected Back Arrow to return to Screen 2 */}
              <TouchableOpacity style={styles.roundIconButton} onPress={() => setActiveTab('DETAILS')}>
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

              {/* Neumorphic Circle Arc Progress Representation Ring */}
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

            {/* Slider Scale Integration Node */}
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

            {/* Calendar Matrix Card Presentation Block Layout */}
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

            {/* Action Buttons Cluster Platform Frame Row Footer */}
            <View style={styles.actionFooterButtonsRowWrapperBox}>
              <TouchableOpacity style={styles.callToActionButtonSolidLargePrimaryButton} onPress={() => alert('Processing payment request...')}>
                <Text style={styles.callToActionButtonTextPayloadLabel}>Make a Payment</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.squareIconActionButtonAlternativeContainer}><Text style={{ fontSize: 16 }}>💬</Text></TouchableOpacity>
              <TouchableOpacity style={styles.squareIconActionButtonAlternativeContainer}><Text style={{ fontSize: 16 }}>🧮</Text></TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E4EDF7',
  },
  scrollContainer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  phoneFrame: {
    width: 375,
    borderRadius: 40,
    backgroundColor: '#EBF2FA',
    padding: 24,
    shadowColor: '#A3B1C6',
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#D1E3F8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  greetingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  subGreetingText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  roundIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F4FA',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A3B1C6',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#fff',
  },
  sectionTitleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2937',
    marginVertical: 10,
  },
  pillsRow: {
    flexDirection: 'row',
    marginVertical: 10,
    justifyContent: 'flex-start',
  },
  pillActive: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginRight: 8,
    shadowColor: '#A3B1C6',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#fff',
  },
  pillTextActive: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  pillInactive: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  pillTextInactive: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  scoreDataContainer: {
    marginTop: 20,
    marginBottom: 5,
  },
  scoreDeltaBadge: {
    backgroundColor: '#E0F2FE',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 15,
    marginRight: 10,
  },
  scoreDeltaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  scoreUpdateBadge: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 15,
  },
  scoreUpdateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  scoreAbsolutePlacement: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 5,
  },
  hugeScoreDigit: {
    fontSize: 68,
    fontWeight: '300',
    color: '#111827',
    letterSpacing: -1,
  },
  scoreStatusLabelText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
  },
  gradientTrackBackground: {
    height: 8,
    borderRadius: 4,
    position: 'relative',
    marginTop: 15,
    shadowColor: '#A3B1C6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    backgroundColor: '#4ade80',
  },
  sliderIndicatorPointerPin: {
    position: 'absolute',
    top: -8,
    width: 4,
    height: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#111827',
    borderRadius: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
  },
  triangleBlackPointerArrowPinIndicator: {
    position: 'absolute',
    bottom: -15,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#111827',
  },
  gradientAxisLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  axisTicksText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  accordionCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
    shadowColor: '#A3B1C6',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    cursor: 'pointer'
  },
  accordionHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  chevronIconStyle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4B5563',
  },
  redAlertNotificationBadge: {
    backgroundColor: '#EF4444',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  redAlertNotificationText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  chartWrapperPlaceholderBlock: {
    height: 160,
    backgroundColor: 'rgba(240, 244, 250, 0.5)',
    borderRadius: 16,
    marginTop: 10,
    padding: 12,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  chartDateLabelBubbleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
    alignSelf: 'center',
  },
  chartFloatingMetricIndicatorBox: {
    position: 'absolute',
    top: 50,
    right: 40,
    backgroundColor: '#FFFFFF',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    zIndex: 5,
  },
  chartFloatingMetricIndicatorText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1F2937',
  },
  mockVerticalGridAxisMarkers: {
    justifyContent: 'space-between',
    height: '85%',
    position: 'absolute',
    left: 12,
    bottom: 12,
  },
  simulatedGraphSplineLine: {
    position: 'absolute',
    bottom: 40,
    left: 50,
    width: 240,
    height: 60,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#3B82F6',
    borderTopLeftRadius: 120,
    transform: [{ scaleY: -1 }],
    opacity: 0.8,
  },
  simulatedGraphVerticalMarkerDropLine: {
    position: 'absolute',
    bottom: 15,
    right: 105,
    width: 1,
    height: 85,
    backgroundColor: '#34D399',
    borderStyle: 'dashed',
  },
  navigationHeaderBackBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  navigationHeaderMiddleTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
  },
  innerCardBoldSubheading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
  },
  miniRoundArrowButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizontalCalendarTimelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 15,
  },
  calendarDayColumnItem: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    width: 46,
    height: 70,
    borderRadius: 23,
    shadowColor: '#A3B1C6',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  calendarDayColumnItemActive: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    width: 46,
    height: 70,
    borderRadius: 23,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  calDayLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 6,
  },
  calDateLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  calDayLabelActive: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 6,
    opacity: 0.9,
  },
  calDateLabelActive: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  premiumGlassCreditDetailsCardFrame: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20,
    marginTop: 15,
    shadowColor: '#A3B1C6',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    cursor: 'pointer'
  },
  bankAvatarIconEmblemBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bankAccountCorporateTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  bankAccountLoanProductTagLabelText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 2,
  },
  metricsGridDimmedCaptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  prominentBoldMetricCashValueDisplay: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginTop: 4,
  },
  metricBoldDetailsValueDisplay: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 4,
  },
  dividerHairlineSeparatorLine: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 15,
  },
  largeProductHeaderHeadlineText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
  },
  radialGaugeCircleOuterRingComponent: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 6,
    borderColor: '#F3F4F6',
    borderTopColor: '#F59E0B',
    borderRightColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },
  radialGaugeInnerFaceCircleCenterPlatter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-45deg' }],
  },
  radialPercentageCoreCenterDigitLabelText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  radialSubtextCaptionDescriptionText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginTop: 1,
  },
  timelineTargetTopHeaderCaptionAnchorText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
    textAlign: 'center',
    marginBottom: 15,
  },
  calendarMatrixFlexLayoutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridMatrixCellItem: {
    width: '16%',
    alignItems: 'center',
    marginVertical: 10,
  },
  matrixMonthTextLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '700',
    marginBottom: 6,
  },
  matrixStatusBluePillCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#93C5FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matrixStatusRedPillCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FCA5A5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matrixStatusGreyPillCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matrixStatusTextLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  actionFooterButtonsRowWrapperBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 25,
  },
  callToActionButtonSolidLargePrimaryButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: '#A3B1C6',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#fff',
  },
  callToActionButtonTextPayloadLabel: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
  },
  squareIconActionButtonAlternativeContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    shadowColor: '#A3B1C6',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#fff',
  }
});