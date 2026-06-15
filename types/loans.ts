export interface Loan {
    id: string;
    bankName: string;
    productName: string;
    principal: number;
    outstanding: number;
    paidSoFar: number;
    interestRate: number;
    status: 'active' | 'closed' | 'default';
}

export interface EMI {
    id: string;
    loanId: string;
    amount: number;
    dueDate: string;
    status: 'pending' | 'paid' | 'overdue';
}