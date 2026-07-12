export type HandoverStatus = 'pending' | 'scheduled' | 'completed' | 'rejected';

export interface HandoverIssue {
  id: string;
  category: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'resolved';
  images?: string[];
  reportedAt: string;
  resolvedAt?: string;
}

export interface Handover {
  id: string;
  apartmentCode: string;
  projectName: string;
  customerName: string;
  status: HandoverStatus;
  scheduledDate?: string;
  completedDate?: string;
  address: string;
  floor: number;
  area: number;
  clearArea: number;
  image: string;
  images?: string[];
  issues?: HandoverIssue[];
  notes?: string;
  inspector?: string;
  priceValue: number;
}

export const handovers: Handover[] = [
  {
    id: '1',
    apartmentCode: 'A1.01-15',
    projectName: 'Masteri Thảo Điền',
    customerName: 'Nguyễn Văn An',
    status: 'scheduled',
    scheduledDate: '2025-11-05T09:00:00',
    address: 'Tầng 15, Block A1',
    floor: 15,
    area: 75,
    clearArea: 68.5,
    image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
    ],
    inspector: 'Trần Minh Tuấn',
    priceValue: 4200000000,
  },
  {
    id: '2',
    apartmentCode: 'B2.05-08',
    projectName: 'Vinhomes Central Park',
    customerName: 'Lê Thị Bình',
    status: 'pending',
    address: 'Tầng 8, Block B2',
    floor: 8,
    area: 95,
    clearArea: 87.2,
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop',
    ],
    priceValue: 12500000000,
  },
  {
    id: '3',
    apartmentCode: 'C3.10-12',
    projectName: 'The Sun Avenue',
    customerName: 'Phạm Quốc Cường',
    status: 'completed',
    scheduledDate: '2025-10-15T10:00:00',
    completedDate: '2025-10-15T14:30:00',
    address: 'Tầng 12, Block C3',
    floor: 12,
    area: 62,
    clearArea: 56.8,
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop',
    ],
    issues: [],
    inspector: 'Nguyễn Văn Đức',
    notes: 'Bàn giao thành công, không có lỗi phát sinh',
    priceValue: 2800000000,
  },
  {
    id: '4',
    apartmentCode: 'A2.15-20',
    projectName: 'Masteri Thảo Điền',
    customerName: 'Hoàng Minh Đức',
    status: 'scheduled',
    scheduledDate: '2025-11-08T14:00:00',
    address: 'Tầng 20, Block A2',
    floor: 20,
    area: 68,
    clearArea: 62.3,
    image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop',
    ],
    inspector: 'Trần Minh Tuấn',
    priceValue: 3200000000,
  },
  {
    id: '5',
    apartmentCode: 'B1.08-05',
    projectName: 'Vinhomes Central Park',
    customerName: 'Đỗ Thị Nga',
    status: 'completed',
    scheduledDate: '2025-10-20T09:00:00',
    completedDate: '2025-10-20T15:00:00',
    address: 'Tầng 5, Block B1',
    floor: 5,
    area: 88,
    clearArea: 80.5,
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop',
    ],
    issues: [
      {
        id: 'i1',
        category: 'Điện',
        description: 'Công tắc phòng ngủ chính không hoạt động',
        severity: 'medium',
        status: 'resolved',
        reportedAt: '2025-10-20T10:30:00',
        resolvedAt: '2025-10-20T14:00:00',
      },
    ],
    inspector: 'Lê Văn Hùng',
    notes: 'Đã khắc phục lỗi công tắc, bàn giao thành công',
    priceValue: 5800000000,
  },
  {
    id: '6',
    apartmentCode: 'C2.12-18',
    projectName: 'The Sun Avenue',
    customerName: 'Vũ Quang Huy',
    status: 'pending',
    address: 'Tầng 18, Block C2',
    floor: 18,
    area: 70,
    clearArea: 64.2,
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop',
    ],
    priceValue: 4100000000,
  },
];
