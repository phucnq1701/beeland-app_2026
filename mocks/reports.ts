export interface SalesReportData {
  month: string;
  sales: number;
  revenue: number;
}

export interface RevenueByProjectData {
  projectName: string;
  revenue: number;
  percentage: number;
}

export interface MonthlyRevenueData {
  month: string;
  booking: number;
  contract: number;
  collected: number;
}

export const salesReportData: SalesReportData[] = [
  { month: 'T1', sales: 15, revenue: 4500 },
  { month: 'T2', sales: 22, revenue: 6600 },
  { month: 'T3', sales: 18, revenue: 5400 },
  { month: 'T4', sales: 28, revenue: 8400 },
  { month: 'T5', sales: 35, revenue: 10500 },
  { month: 'T6', sales: 42, revenue: 12600 },
  { month: 'T7', sales: 38, revenue: 11400 },
  { month: 'T8', sales: 45, revenue: 13500 },
  { month: 'T9', sales: 52, revenue: 15600 },
  { month: 'T10', sales: 48, revenue: 14400 },
];

export const revenueByProjectData: RevenueByProjectData[] = [
  { projectName: 'Masteri Thảo Điền', revenue: 35000, percentage: 35 },
  { projectName: 'Vinhomes Central Park', revenue: 28000, percentage: 28 },
  { projectName: 'The Sun Avenue', revenue: 22000, percentage: 22 },
  { projectName: 'Estella Heights', revenue: 15000, percentage: 15 },
];

export const monthlyRevenueData: MonthlyRevenueData[] = [
  { month: 'T1', booking: 450, contract: 380, collected: 320 },
  { month: 'T2', booking: 520, contract: 450, collected: 400 },
  { month: 'T3', booking: 480, contract: 420, collected: 380 },
  { month: 'T4', booking: 650, contract: 580, collected: 520 },
  { month: 'T5', booking: 720, contract: 650, collected: 600 },
  { month: 'T6', booking: 800, contract: 720, collected: 680 },
  { month: 'T7', booking: 750, contract: 680, collected: 640 },
  { month: 'T8', booking: 850, contract: 780, collected: 720 },
  { month: 'T9', booking: 920, contract: 850, collected: 800 },
  { month: 'T10', booking: 880, contract: 820, collected: 780 },
];

export interface SummaryStats {
  totalRevenue: string;
  totalRevenueValue: number;
  totalSales: number;
  pendingPayments: string;
  pendingPaymentsValue: number;
  completedContracts: number;
}

export const summaryStats: SummaryStats = {
  totalRevenue: '142.5 tỷ',
  totalRevenueValue: 142500000000,
  totalSales: 363,
  pendingPayments: '28.5 tỷ',
  pendingPaymentsValue: 28500000000,
  completedContracts: 285,
};
