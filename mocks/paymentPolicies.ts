export interface Discount {
  type: 'percentage' | 'amount';
  value: number;
  description: string;
}

export interface PaymentPolicy {
  id: string;
  name: string;
  description: string;
  downPayment: number;
  milestones: PaymentMilestone[];
  discounts: Discount[];
  benefits: string[];
}

export interface PaymentMilestone {
  name: string;
  percentage: number;
  description: string;
  paymentTimeDays: number;
}

export const paymentPolicies: PaymentPolicy[] = [
  {
    id: '1',
    name: 'Thanh toán nhanh - Ưu đãi cao',
    description: 'Thanh toán 95% trong vòng 30 ngày',
    downPayment: 95,
    discounts: [
      { type: 'percentage', value: 5, description: 'CK thanh toán sớm' },
      { type: 'percentage', value: 3, description: 'CK khách hàng thân thiết' },
      { type: 'amount', value: 50000000, description: 'CK đặc biệt' },
    ],
    milestones: [
      { name: 'Đợt 1', percentage: 30, description: 'Ký HĐMB', paymentTimeDays: 0 },
      { name: 'Đợt 2', percentage: 65, description: 'Trong vòng 30 ngày', paymentTimeDays: 30 },
      { name: 'Đợt 3', percentage: 5, description: 'Nhận bàn giao', paymentTimeDays: 365 },
    ],
    benefits: [
      'Chiết khấu tổng 8% + 50 triệu đồng',
      'Tặng gói nội thất cao cấp',
      'Miễn phí 2 năm phí quản lý',
    ],
  },
  {
    id: '2',
    name: 'Thanh toán tiêu chuẩn',
    description: 'Thanh toán theo tiến độ thi công',
    downPayment: 30,
    discounts: [
      { type: 'percentage', value: 3, description: 'CK tiêu chuẩn' },
      { type: 'percentage', value: 2, description: 'CK đặt cọc sớm' },
      { type: 'amount', value: 30000000, description: 'CK tri ân' },
    ],
    milestones: [
      { name: 'Đợt 1', percentage: 30, description: 'Ký HĐMB', paymentTimeDays: 0 },
      { name: 'Đợt 2', percentage: 30, description: 'Hoàn thiện phần thô', paymentTimeDays: 180 },
      { name: 'Đợt 3', percentage: 30, description: 'Hoàn thiện hoàn tất', paymentTimeDays: 300 },
      { name: 'Đợt 4', percentage: 10, description: 'Nhận bàn giao', paymentTimeDays: 365 },
    ],
    benefits: [
      'Chiết khấu tổng 5% + 30 triệu đồng',
      'Hỗ trợ vay 70% giá trị',
      'Miễn phí 1 năm phí quản lý',
    ],
  },
  {
    id: '3',
    name: 'Thanh toán linh hoạt',
    description: 'Trả góp trong 24 tháng',
    downPayment: 20,
    discounts: [
      { type: 'percentage', value: 2, description: 'CK linh hoạt' },
      { type: 'percentage', value: 1, description: 'CK khuyến mãi' },
      { type: 'amount', value: 20000000, description: 'CK hấp dẫn' },
    ],
    milestones: [
      { name: 'Đợt 1', percentage: 20, description: 'Ký HĐMB', paymentTimeDays: 0 },
      { name: 'Đợt 2', percentage: 10, description: 'Sau 3 tháng', paymentTimeDays: 90 },
      { name: 'Đợt 3', percentage: 10, description: 'Sau 6 tháng', paymentTimeDays: 180 },
      { name: 'Đợt 4', percentage: 30, description: 'Hoàn thiện phần thô', paymentTimeDays: 365 },
      { name: 'Đợt 5', percentage: 30, description: 'Nhận bàn giao', paymentTimeDays: 540 },
    ],
    benefits: [
      'Chiết khấu tổng 3% + 20 triệu đồng',
      'Hỗ trợ vay 80% giá trị',
      'Lãi suất ưu đãi 0% trong 12 tháng đầu',
    ],
  },
  {
    id: '4',
    name: 'Thanh toán sớm - Ưu đãi đặc biệt',
    description: 'Thanh toán 100% ngay',
    downPayment: 100,
    discounts: [
      { type: 'percentage', value: 8, description: 'CK thanh toán 100%' },
      { type: 'percentage', value: 4, description: 'CK đặc biệt VIP' },
      { type: 'amount', value: 100000000, description: 'CK siêu khủng' },
    ],
    milestones: [
      { name: 'Một lần', percentage: 100, description: 'Thanh toán ngay khi ký HĐMB', paymentTimeDays: 0 },
    ],
    benefits: [
      'Chiết khấu tổng 12% + 100 triệu đồng',
      'Tặng gói nội thất Smart Home',
      'Miễn phí 3 năm phí quản lý',
      'Tặng 2 chỗ đậu xe',
    ],
  },
];
