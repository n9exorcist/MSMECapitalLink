export type ScoreBand = 'EXCELLENT' | 'GOOD' | 'MEDIUM' | 'POOR';

export interface BankingHealthScore {
    currentScore: number;
    previousScore: number;
    band: ScoreBand;
    lastUpdated: string;
}

export interface LiquidityMetrics {
    currentRatio: number;
    dscr: number; // Debt Service Coverage Ratio
    quickRatio: number;
}