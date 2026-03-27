export interface Property {
  id: string;
  title: string;
  location: string;
  price: string;
  image: string;
  images?: string[];
  area?: number;
  clearArea?: number;
  priceValue?: number;
  code?: string;
}

export const featuredProperties: Property[] = [
  {
    id: '1',
    title: 'Masteri Thảo Điền',
    location: 'Không gian sống hiện đại tại quận 2',
    price: 'Từ 3.8 tỷ',
    image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop',
    ],
    area: 75,
    clearArea: 68.5,
    priceValue: 3800000000,
    code: 'MT-001',
  },
  {
    id: '2',
    title: 'Vinhomes Central Park',
    location: 'Căn hộ cao cấp view sông Sài Gòn',
    price: 'Từ 5.2 tỷ',
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',
    ],
    area: 95,
    clearArea: 87.2,
    priceValue: 5200000000,
    code: 'VCP-002',
  },
  {
    id: '3',
    title: 'The Sun Avenue',
    location: 'Căn hộ thông minh khu vực An Phú',
    price: 'Từ 2.9 tỷ',
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800&h=600&fit=crop',
    ],
    area: 62,
    clearArea: 56.8,
    priceValue: 2900000000,
    code: 'TSA-003',
  },
  {
    id: '4',
    title: 'Saigon Pearl',
    location: 'View sông Sài Gòn, Bình Thạnh',
    price: 'Từ 12.5 tỷ',
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop',
    ],
    area: 120,
    clearArea: 110.5,
    priceValue: 12500000000,
    code: 'B2.05-08',
  },
  {
    id: '5',
    title: 'Sunrise City View',
    location: 'Khu Nam Sài Gòn, Quận 7',
    price: 'Từ 2.8 tỷ',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop',
    ],
    area: 58,
    clearArea: 52.3,
    priceValue: 2800000000,
    code: 'C3.10-12',
  },
  {
    id: '6',
    title: 'Diamond Island',
    location: 'Đảo Kim Cương, Quận 2',
    price: 'Từ 3.2 tỷ',
    image: 'https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=800&h=600&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
    ],
    area: 68,
    clearArea: 62.1,
    priceValue: 3200000000,
    code: 'A2.15-20',
  },
  {
    id: '7',
    title: 'Estella Heights',
    location: 'Khu An Phú, Quận 2',
    price: 'Từ 5.8 tỷ',
    image: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800&h=600&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop',
    ],
    area: 104,
    clearArea: 96.2,
    priceValue: 5800000000,
    code: 'B1.08-05',
  },
  {
    id: '8',
    title: 'The Nassim',
    location: 'Thảo Điền, Quận 2',
    price: 'Từ 4.1 tỷ',
    image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop',
    ],
    area: 82,
    clearArea: 75.4,
    priceValue: 4100000000,
    code: 'C2.12-18',
  },
  {
    id: '9',
    title: 'Gateway Thảo Điền',
    location: 'Xa lộ Hà Nội, Quận 2',
    price: 'Từ 6.5 tỷ',
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop',
    ],
    area: 115,
    clearArea: 105.8,
    priceValue: 6500000000,
    code: 'A3.05-10',
  },
  {
    id: '10',
    title: 'Metropole Thủ Thiêm',
    location: 'Khu đô thị Thủ Thiêm, TP. Thủ Đức',
    price: 'Từ 7.2 tỷ',
    image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800&h=600&fit=crop',
    ],
    area: 130,
    clearArea: 119.6,
    priceValue: 7200000000,
    code: 'B3.07-22',
  },
  {
    id: '11',
    title: 'City Garden',
    location: 'Ngô Tất Tố, Bình Thạnh',
    price: 'Từ 3.6 tỷ',
    image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop',
    ],
    area: 72,
    clearArea: 66.0,
    priceValue: 3600000000,
    code: 'C1.15-09',
  },
  {
    id: '12',
    title: 'Feliz En Vista',
    location: 'Thanh Đa, Bình Thạnh',
    price: 'Từ 5.1 tỷ',
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',
    ],
    area: 98,
    clearArea: 90.1,
    priceValue: 5100000000,
    code: 'A4.20-14',
  },
  {
    id: '13',
    title: 'The Marq',
    location: 'Nguyễn Đình Chiểu, Quận 1',
    price: 'Từ 8.9 tỷ',
    image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop',
    ],
    area: 145,
    clearArea: 133.4,
    priceValue: 8900000000,
    code: 'B4.12-18',
  },
  {
    id: '14',
    title: 'Thảo Điền Green',
    location: 'Thảo Điền, TP. Thủ Đức',
    price: 'Từ 4.7 tỷ',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=800&h=600&fit=crop',
    ],
    area: 88,
    clearArea: 80.9,
    priceValue: 4700000000,
    code: 'C4.08-25',
  },
  {
    id: '15',
    title: 'Lumiere Riverside',
    location: 'An Phú, TP. Thủ Đức',
    price: 'Từ 6.3 tỷ',
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop',
    ],
    area: 108,
    clearArea: 99.4,
    priceValue: 6300000000,
    code: 'A5.03-11',
  },
];

export type ProductStatus = 'available' | 'cancelled' | 'pending';

export interface Product {
  id: string;
  code: string;
  status: ProductStatus;
  price: string;
  priceValue: number;
}

export const products: Product[] = [
  { id: '1', code: 'A1.01-15', status: 'available', price: '4.200.000.000', priceValue: 4200000000 },
  { id: '2', code: 'A1.02-14', status: 'cancelled', price: '3.950.000.000', priceValue: 3950000000 },
  { id: '3', code: 'A1.03-16', status: 'pending', price: '4.500.000.000', priceValue: 4500000000 },
  { id: '4', code: 'B2.05-08', status: 'available', price: '12.500.000.000', priceValue: 12500000000 },
  { id: '5', code: 'C3.10-12', status: 'available', price: '2.800.000.000', priceValue: 2800000000 },
  { id: '6', code: 'A2.15-20', status: 'available', price: '3.200.000.000', priceValue: 3200000000 },
  { id: '7', code: 'B1.08-05', status: 'pending', price: '5.800.000.000', priceValue: 5800000000 },
  { id: '8', code: 'C2.12-18', status: 'cancelled', price: '4.100.000.000', priceValue: 4100000000 },
  { id: '9', code: 'A3.05-10', status: 'available', price: '6.500.000.000', priceValue: 6500000000 },
  { id: '10', code: 'B3.07-22', status: 'available', price: '7.200.000.000', priceValue: 7200000000 },
  { id: '11', code: 'C1.15-09', status: 'pending', price: '3.600.000.000', priceValue: 3600000000 },
  { id: '12', code: 'A4.20-14', status: 'cancelled', price: '5.100.000.000', priceValue: 5100000000 },
  { id: '13', code: 'B4.12-18', status: 'available', price: '8.900.000.000', priceValue: 8900000000 },
  { id: '14', code: 'C4.08-25', status: 'available', price: '4.700.000.000', priceValue: 4700000000 },
  { id: '15', code: 'A5.03-11', status: 'pending', price: '6.300.000.000', priceValue: 6300000000 },
];
