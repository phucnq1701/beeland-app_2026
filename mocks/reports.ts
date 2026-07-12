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

export interface DebtReportItem {
  id: string;
  customerName: string;
  projectName: string;
  productCode: string;
  contractValue: string;
  paidAmount: string;
  debtAmount: string;
  dueDate: string;
  status: 'overdue' | 'upcoming' | 'on_time';
}

export interface ContractReportItem {
  id: string;
  contractCode: string;
  customerName: string;
  projectName: string;
  productCode: string;
  contractValue: string;
  signDate: string;
  status: 'active' | 'completed' | 'cancelled' | 'pending';
}

export interface PaymentReportItem {
  id: string;
  receiptCode: string;
  customerName: string;
  projectName: string;
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  type: 'booking' | 'deposit' | 'contract' | 'installment';
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

export const debtReportData: DebtReportItem[] = [
  { id: '1', customerName: 'Nguyễn Văn An', projectName: 'Masteri Thảo Điền', productCode: 'MT-A1201', contractValue: '5.2 tỷ', paidAmount: '3.1 tỷ', debtAmount: '2.1 tỷ', dueDate: '15/04/2026', status: 'overdue' },
  { id: '2', customerName: 'Trần Thị Bình', projectName: 'Vinhomes Central Park', productCode: 'VCP-B0805', contractValue: '8.5 tỷ', paidAmount: '6.0 tỷ', debtAmount: '2.5 tỷ', dueDate: '20/04/2026', status: 'upcoming' },
  { id: '3', customerName: 'Lê Hoàng Cường', projectName: 'The Sun Avenue', productCode: 'SA-C1505', contractValue: '3.8 tỷ', paidAmount: '2.5 tỷ', debtAmount: '1.3 tỷ', dueDate: '01/05/2026', status: 'on_time' },
  { id: '4', customerName: 'Phạm Minh Đức', projectName: 'Estella Heights', productCode: 'EH-D2201', contractValue: '12.0 tỷ', paidAmount: '7.0 tỷ', debtAmount: '5.0 tỷ', dueDate: '10/03/2026', status: 'overdue' },
  { id: '5', customerName: 'Hoàng Thị Êm', projectName: 'Masteri Thảo Điền', productCode: 'MT-A0903', contractValue: '4.5 tỷ', paidAmount: '3.5 tỷ', debtAmount: '1.0 tỷ', dueDate: '25/05/2026', status: 'on_time' },
  { id: '6', customerName: 'Vũ Đình Phong', projectName: 'Vinhomes Central Park', productCode: 'VCP-A1102', contractValue: '6.8 tỷ', paidAmount: '4.0 tỷ', debtAmount: '2.8 tỷ', dueDate: '05/04/2026', status: 'upcoming' },
  { id: '7', customerName: 'Đặng Thị Giang', projectName: 'The Sun Avenue', productCode: 'SA-B0710', contractValue: '3.2 tỷ', paidAmount: '1.8 tỷ', debtAmount: '1.4 tỷ', dueDate: '28/02/2026', status: 'overdue' },
  { id: '8', customerName: 'Bùi Quốc Hải', projectName: 'Estella Heights', productCode: 'EH-C1808', contractValue: '9.5 tỷ', paidAmount: '7.5 tỷ', debtAmount: '2.0 tỷ', dueDate: '15/06/2026', status: 'on_time' },
];

export const contractReportData: ContractReportItem[] = [
  { id: '1', contractCode: 'HD-2026-001', customerName: 'Nguyễn Văn An', projectName: 'Masteri Thảo Điền', productCode: 'MT-A1201', contractValue: '5.2 tỷ', signDate: '10/01/2026', status: 'active' },
  { id: '2', contractCode: 'HD-2026-002', customerName: 'Trần Thị Bình', projectName: 'Vinhomes Central Park', productCode: 'VCP-B0805', contractValue: '8.5 tỷ', signDate: '15/01/2026', status: 'active' },
  { id: '3', contractCode: 'HD-2026-003', customerName: 'Lê Hoàng Cường', projectName: 'The Sun Avenue', productCode: 'SA-C1505', contractValue: '3.8 tỷ', signDate: '20/01/2026', status: 'completed' },
  { id: '4', contractCode: 'HD-2026-004', customerName: 'Phạm Minh Đức', projectName: 'Estella Heights', productCode: 'EH-D2201', contractValue: '12.0 tỷ', signDate: '05/02/2026', status: 'active' },
  { id: '5', contractCode: 'HD-2026-005', customerName: 'Hoàng Thị Êm', projectName: 'Masteri Thảo Điền', productCode: 'MT-A0903', contractValue: '4.5 tỷ', signDate: '12/02/2026', status: 'pending' },
  { id: '6', contractCode: 'HD-2026-006', customerName: 'Vũ Đình Phong', projectName: 'Vinhomes Central Park', productCode: 'VCP-A1102', contractValue: '6.8 tỷ', signDate: '18/02/2026', status: 'active' },
  { id: '7', contractCode: 'HD-2026-007', customerName: 'Đặng Thị Giang', projectName: 'The Sun Avenue', productCode: 'SA-B0710', contractValue: '3.2 tỷ', signDate: '25/02/2026', status: 'cancelled' },
  { id: '8', contractCode: 'HD-2026-008', customerName: 'Bùi Quốc Hải', projectName: 'Estella Heights', productCode: 'EH-C1808', contractValue: '9.5 tỷ', signDate: '01/03/2026', status: 'completed' },
  { id: '9', contractCode: 'HD-2026-009', customerName: 'Ngô Thanh Inh', projectName: 'Masteri Thảo Điền', productCode: 'MT-B1505', contractValue: '6.0 tỷ', signDate: '08/03/2026', status: 'active' },
  { id: '10', contractCode: 'HD-2026-010', customerName: 'Cao Thị Kim', projectName: 'Vinhomes Central Park', productCode: 'VCP-C0612', contractValue: '7.2 tỷ', signDate: '15/03/2026', status: 'pending' },
];

export const paymentReportData: PaymentReportItem[] = [
  { id: '1', receiptCode: 'PT-2026-001', customerName: 'Nguyễn Văn An', projectName: 'Masteri Thảo Điền', amount: '500 triệu', paymentDate: '12/01/2026', paymentMethod: 'Chuyển khoản', type: 'deposit' },
  { id: '2', receiptCode: 'PT-2026-002', customerName: 'Trần Thị Bình', projectName: 'Vinhomes Central Park', amount: '1.2 tỷ', paymentDate: '18/01/2026', paymentMethod: 'Chuyển khoản', type: 'contract' },
  { id: '3', receiptCode: 'PT-2026-003', customerName: 'Lê Hoàng Cường', projectName: 'The Sun Avenue', amount: '200 triệu', paymentDate: '22/01/2026', paymentMethod: 'Tiền mặt', type: 'booking' },
  { id: '4', receiptCode: 'PT-2026-004', customerName: 'Phạm Minh Đức', projectName: 'Estella Heights', amount: '2.0 tỷ', paymentDate: '05/02/2026', paymentMethod: 'Chuyển khoản', type: 'contract' },
  { id: '5', receiptCode: 'PT-2026-005', customerName: 'Hoàng Thị Êm', projectName: 'Masteri Thảo Điền', amount: '800 triệu', paymentDate: '15/02/2026', paymentMethod: 'Chuyển khoản', type: 'installment' },
  { id: '6', receiptCode: 'PT-2026-006', customerName: 'Vũ Đình Phong', projectName: 'Vinhomes Central Park', amount: '1.5 tỷ', paymentDate: '20/02/2026', paymentMethod: 'Chuyển khoản', type: 'deposit' },
  { id: '7', receiptCode: 'PT-2026-007', customerName: 'Đặng Thị Giang', projectName: 'The Sun Avenue', amount: '350 triệu', paymentDate: '28/02/2026', paymentMethod: 'Tiền mặt', type: 'installment' },
  { id: '8', receiptCode: 'PT-2026-008', customerName: 'Bùi Quốc Hải', projectName: 'Estella Heights', amount: '3.0 tỷ', paymentDate: '05/03/2026', paymentMethod: 'Chuyển khoản', type: 'contract' },
  { id: '9', receiptCode: 'PT-2026-009', customerName: 'Ngô Thanh Inh', projectName: 'Masteri Thảo Điền', amount: '600 triệu', paymentDate: '10/03/2026', paymentMethod: 'Chuyển khoản', type: 'booking' },
  { id: '10', receiptCode: 'PT-2026-010', customerName: 'Cao Thị Kim', projectName: 'Vinhomes Central Park', amount: '1.0 tỷ', paymentDate: '15/03/2026', paymentMethod: 'Tiền mặt', type: 'deposit' },
];

export const reportCategories = [
  {
    id: 'payment',
    title: 'Báo cáo thu tiền',
    subtitle: 'Theo dõi tình hình thu tiền',
    count: 10,
    totalAmount: '11.15 tỷ',
    color: '#10B981',
    bgColor: '#ECFDF5',
    route: '/reports/payment',
  },
  {
    id: 'debt',
    title: 'Báo cáo công nợ',
    subtitle: 'Quản lý công nợ khách hàng',
    count: 8,
    totalAmount: '18.1 tỷ',
    color: '#EF4444',
    bgColor: '#FEF2F2',
    route: '/reports/debt',
  },
  {
    id: 'contract',
    title: 'Báo cáo hợp đồng',
    subtitle: 'Thống kê tình hình hợp đồng',
    count: 10,
    totalAmount: '66.7 tỷ',
    color: '#3B82F6',
    bgColor: '#EFF6FF',
    route: '/reports/contract',
  },
  {
    id: 'sales',
    title: 'Báo cáo bán hàng',
    subtitle: 'Phân tích doanh số bán hàng',
    count: 363,
    totalAmount: '142.5 tỷ',
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    route: '/reports/sales',
  },
];
