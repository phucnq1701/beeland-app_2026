export type CustomerType = 'personal' | 'business';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  type: CustomerType;
  company?: string;
  taxCode?: string;
  projects: string[];
  status: 'active' | 'potential' | 'inactive';
  createdAt: string;
  images?: string[];
}

export const customers: Customer[] = [
  {
    id: '1',
    name: 'Nguyễn Văn A',
    phone: '0901234567',
    email: 'nguyenvana@gmail.com',
    type: 'personal',
    projects: ['Masteri Thảo Điền', 'Vinhomes Central Park'],
    status: 'active',
    createdAt: '2024-01-15',
    images: ['https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=400', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400'],
  },
  {
    id: '2',
    name: 'Trần Thị B',
    phone: '0902345678',
    email: 'tranthib@gmail.com',
    type: 'personal',
    projects: ['The Sun Avenue'],
    status: 'potential',
    createdAt: '2024-02-20',
  },
  {
    id: '3',
    name: 'Công ty TNHH ABC',
    phone: '0283456789',
    email: 'contact@abc.com',
    type: 'business',
    company: 'Công ty TNHH ABC',
    taxCode: '0123456789',
    projects: ['Masteri Thảo Điền', 'The Sun Avenue'],
    status: 'active',
    createdAt: '2024-01-10',
  },
  {
    id: '4',
    name: 'Lê Văn C',
    phone: '0903456789',
    email: 'levanc@gmail.com',
    type: 'personal',
    projects: ['Vinhomes Central Park'],
    status: 'active',
    createdAt: '2024-03-05',
  },
  {
    id: '5',
    name: 'Công ty CP XYZ',
    phone: '0284567890',
    email: 'info@xyz.vn',
    type: 'business',
    company: 'Công ty CP XYZ',
    taxCode: '0987654321',
    projects: ['Masteri Thảo Điền'],
    status: 'potential',
    createdAt: '2024-02-15',
  },
  {
    id: '6',
    name: 'Phạm Thị D',
    phone: '0904567890',
    email: 'phamthid@gmail.com',
    type: 'personal',
    projects: [],
    status: 'inactive',
    createdAt: '2024-01-25',
  },
  {
    id: '7',
    name: 'Tập đoàn DEF',
    phone: '0285678901',
    email: 'contact@def.vn',
    type: 'business',
    company: 'Tập đoàn DEF',
    taxCode: '0246813579',
    projects: ['Vinhomes Central Park', 'The Sun Avenue'],
    status: 'active',
    createdAt: '2024-01-20',
  },
  {
    id: '8',
    name: 'Hoàng Văn E',
    phone: '0905678901',
    email: 'hoangvane@gmail.com',
    type: 'personal',
    projects: ['Masteri Thảo Điền'],
    status: 'potential',
    createdAt: '2024-03-10',
  },
];
