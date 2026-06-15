export interface MSME {
    id: string;
    ownerName: string;
    companyName: string;
    industry: string;
    incorporationDate: string;
    gstin: string;
}

export interface FinancialPeriod {
    month: number;
    year: number;
    label: string; // e.g., "June 2026"
}

export interface CashRunway {
    days: number;
    cashBalance: number;
    accountsCount: number;
    monthlyBurn: number;
}