import React, { useState } from 'react';
import { ScrollView, SafeAreaView } from 'react-native';

// Modular Component Imports
import { styles } from './components/styles';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import Details from './components/Details';
import LoanView from './components/LoanView';

type AuthRoleState = 'UNAUTHENTICATED' | 'USER' | 'ADMIN';
type ActiveSubScreen = 'DASHBOARD' | 'DETAILS' | 'LOAN_VIEW';

export default function App() {
  const [currentRoleState, setCurrentRoleState] = useState<AuthRoleState>('UNAUTHENTICATED');
  const [activeTab, setActiveTab] = useState<ActiveSubScreen>('DASHBOARD');

  const [customScore, setCustomScore] = useState<number>(880);
  const [healthStatus, setHealthStatus] = useState<string>("Verifying Pipeline...");
  const [complianceMatrixPayload, setComplianceMatrixPayload] = useState<any>(null);

  // Full-Stack REST API Request Bridge to FastAPI on Port 8000
  const executeFinancialUnderwritingQuery = async () => {
    try {
      const payloadData = {
        company_name: "Alibiya Enterprises Ltd",
        projected_annual_turnover: 50000000,
        annual_purchases: 30000000,
        ebit: 6000000,
        net_profit_after_tax: 3500000,
        depreciation: 800000,
        interest_expense: 4000000,
        current_assets: 12000000,
        inventory: 4000000,
        sundry_debtors: 6500000,
        sundry_creditors: 5000000,
        total_outside_liabilities: 11600000,
        tangible_net_worth: 10000000,
        declared_bank_statement_credits: 48000000,
        days_past_due: 0,
        cibil_score: 740
      };

      const response = await fetch('http://127.0.0.1:8000/api/v2/evaluate-msme-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadData),
      });

      const finalReportResult = await response.json();

      setCustomScore(finalReportResult.metadata.credit_score_index_value);
      setHealthStatus(finalReportResult.metadata.overall_health_assessment);
      setComplianceMatrixPayload(finalReportResult.ratio_compliance_matrix);

    } catch (error) {
      console.error("API Gateway communication handshake failed:", error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>

        {/* 1. UNAUTHENTICATED LANDING MODE */}
        {currentRoleState === 'UNAUTHENTICATED' && (
          <AuthScreen onLoginSuccess={(role) => {
            setCurrentRoleState(role);
            setActiveTab('DASHBOARD'); // Resets view canvas on login success
          }} />
        )}

        {/* 2. LIVE DASHBOARD TERMINAL SCREEN */}
        {currentRoleState !== 'UNAUTHENTICATED' && activeTab === 'DASHBOARD' && (
          <Dashboard
            userRole={currentRoleState}
            onLogout={() => setCurrentRoleState('UNAUTHENTICATED')}
            executeUnderwriting={executeFinancialUnderwritingQuery}
            score={customScore}
            statusText={healthStatus}
            complianceData={complianceMatrixPayload}
            onNavigate={(target: 'DETAILS') => setActiveTab(target)}
          />
        )}

        {/* 3. UNDERLYING BANK DETAIL COMPLIANCE ROWS */}
        {currentRoleState !== 'UNAUTHENTICATED' && activeTab === 'DETAILS' && (
          <Details
            onNavigate={(target: 'DASHBOARD' | 'LOAN_VIEW') => setActiveTab(target)}
          />
        )}

        {/* 4. AUTO LOAN REPAYMENT TIMELINE MATRIX */}
        {currentRoleState !== 'UNAUTHENTICATED' && activeTab === 'LOAN_VIEW' && (
          <LoanView
            onNavigate={(target: 'DETAILS') => setActiveTab(target)}
          />
        )}

      </ScrollView>
    </SafeAreaView>
  );
}