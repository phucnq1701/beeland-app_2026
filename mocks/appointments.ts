export type Appointment = {
  id: string;
  title: string;
  clientName: string;
  clientPhone: string;
  type: 'viewing' | 'consultation' | 'signing' | 'meeting';
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  property?: string;
  notes?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
};

export const appointments: Appointment[] = [
  {
    id: '1',
    title: 'Xem căn hộ A1-05',
    clientName: 'Nguyễn Văn A',
    clientPhone: '0901234567',
    type: 'viewing',
    date: '2025-10-27',
    startTime: '09:00',
    endTime: '10:00',
    location: 'Vinhomes Grand Park',
    property: 'Căn hộ A1-05',
    status: 'confirmed',
    notes: 'Khách muốn xem hướng Đông Nam',
  },
  {
    id: '2',
    title: 'Tư vấn dự án',
    clientName: 'Trần Thị B',
    clientPhone: '0907654321',
    type: 'consultation',
    date: '2025-10-27',
    startTime: '14:00',
    endTime: '15:00',
    location: 'Văn phòng',
    status: 'pending',
    notes: 'Khách quan tâm căn 2PN',
  },
  {
    id: '3',
    title: 'Ký hợp đồng',
    clientName: 'Lê Văn C',
    clientPhone: '0912345678',
    type: 'signing',
    date: '2025-10-28',
    startTime: '10:00',
    endTime: '11:30',
    location: 'Phòng giao dịch',
    property: 'Căn hộ B2-12',
    status: 'confirmed',
    notes: 'Chuẩn bị đầy đủ hồ sơ',
  },
  {
    id: '4',
    title: 'Xem nhà mẫu',
    clientName: 'Phạm Thị D',
    clientPhone: '0923456789',
    type: 'viewing',
    date: '2025-10-28',
    startTime: '15:00',
    endTime: '16:00',
    location: 'The Peak Residence',
    status: 'pending',
  },
  {
    id: '5',
    title: 'Họp nhóm sale',
    clientName: 'Team Sale',
    clientPhone: '',
    type: 'meeting',
    date: '2025-10-29',
    startTime: '09:00',
    endTime: '10:30',
    location: 'Phòng họp A',
    status: 'confirmed',
  },
  {
    id: '6',
    title: 'Tư vấn pháp lý',
    clientName: 'Võ Văn E',
    clientPhone: '0934567890',
    type: 'consultation',
    date: '2025-10-29',
    startTime: '13:00',
    endTime: '14:00',
    location: 'Văn phòng',
    status: 'confirmed',
  },
  {
    id: '7',
    title: 'Xem penthouse',
    clientName: 'Hoàng Thị F',
    clientPhone: '0945678901',
    type: 'viewing',
    date: '2025-10-30',
    startTime: '11:00',
    endTime: '12:00',
    location: 'Sunshine City',
    property: 'Penthouse P01',
    status: 'pending',
  },
  {
    id: '8',
    title: 'Ký phụ lục hợp đồng',
    clientName: 'Đặng Văn G',
    clientPhone: '0956789012',
    type: 'signing',
    date: '2025-10-31',
    startTime: '14:00',
    endTime: '15:00',
    location: 'Phòng giao dịch',
    status: 'confirmed',
  },
  {
    id: '9',
    title: 'Tư vấn thanh toán',
    clientName: 'Bùi Thị H',
    clientPhone: '0967890123',
    type: 'consultation',
    date: '2025-11-01',
    startTime: '10:00',
    endTime: '11:00',
    location: 'Văn phòng',
    status: 'pending',
  },
];
