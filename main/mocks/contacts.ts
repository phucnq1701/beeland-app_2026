export interface Contact {
  id: string;
  name: string;
  avatar?: string;
  phone?: string;
  email?: string;
  role?: string;
  department?: string;
  lastSeen?: Date;
  isOnline: boolean;
}

export const contacts: Contact[] = [
  {
    id: 'user-2',
    name: 'Trần Thị B',
    phone: '0912345678',
    email: 'tranb@company.com',
    role: 'Quản lý bán hàng',
    department: 'Kinh doanh',
    isOnline: true,
  },
  {
    id: 'user-3',
    name: 'Lê Văn C',
    phone: '0923456789',
    email: 'levanc@company.com',
    role: 'Nhân viên kinh doanh',
    department: 'Kinh doanh',
    isOnline: false,
    lastSeen: new Date('2024-01-20T15:30:00'),
  },
  {
    id: 'user-4',
    name: 'Phạm Thị D',
    phone: '0934567890',
    email: 'phamd@company.com',
    role: 'Nhân viên hỗ trợ',
    department: 'Chăm sóc khách hàng',
    isOnline: true,
  },
  {
    id: 'user-5',
    name: 'Hoàng Văn E',
    phone: '0945678901',
    email: 'hoange@company.com',
    role: 'Trưởng phòng Marketing',
    department: 'Marketing',
    isOnline: false,
    lastSeen: new Date('2024-01-20T14:00:00'),
  },
  {
    id: 'user-6',
    name: 'Đỗ Thị F',
    phone: '0956789012',
    email: 'dof@company.com',
    role: 'Nhân viên Marketing',
    department: 'Marketing',
    isOnline: true,
  },
  {
    id: 'user-7',
    name: 'Võ Văn G',
    phone: '0967890123',
    email: 'vog@company.com',
    role: 'Kỹ sư xây dựng',
    department: 'Kỹ thuật',
    isOnline: false,
    lastSeen: new Date('2024-01-19T18:00:00'),
  },
  {
    id: 'user-8',
    name: 'Mai Thị H',
    phone: '0978901234',
    email: 'maih@company.com',
    role: 'Kiến trúc sư',
    department: 'Thiết kế',
    isOnline: true,
  },
  {
    id: 'user-9',
    name: 'Ngô Văn I',
    phone: '0989012345',
    email: 'ngoi@company.com',
    role: 'Kế toán trưởng',
    department: 'Tài chính',
    isOnline: false,
    lastSeen: new Date('2024-01-20T12:00:00'),
  },
  {
    id: 'user-10',
    name: 'Bùi Thị K',
    phone: '0990123456',
    email: 'buik@company.com',
    role: 'Nhân sự',
    department: 'Hành chính',
    isOnline: true,
  },
  {
    id: 'user-11',
    name: 'Đặng Văn L',
    phone: '0901234567',
    email: 'dangl@company.com',
    role: 'IT Support',
    department: 'Công nghệ',
    isOnline: false,
    lastSeen: new Date('2024-01-20T16:00:00'),
  },
];
