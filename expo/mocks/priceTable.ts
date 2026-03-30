export type LotStatus = 'Còn bán' | 'Giữ chỗ' | 'Đã bán';

export interface LotRow {
  id: string;
  lot: string;
  area: number;
  price: string;
  status: LotStatus;
}

export const samplePriceRows: LotRow[] = [
  { id: 'A1', lot: 'A1', area: 85, price: '2.3 tỷ', status: 'Còn bán' },
  { id: 'A2', lot: 'A2', area: 90, price: '2.5 tỷ', status: 'Giữ chỗ' },
  { id: 'A3', lot: 'A3', area: 76, price: '2.0 tỷ', status: 'Đã bán' },
  { id: 'B1', lot: 'B1', area: 95, price: '2.8 tỷ', status: 'Còn bán' },
  { id: 'B2', lot: 'B2', area: 88, price: '2.4 tỷ', status: 'Còn bán' },
  { id: 'B3', lot: 'B3', area: 80, price: '2.2 tỷ', status: 'Giữ chỗ' },
  { id: 'C1', lot: 'C1', area: 72, price: '1.9 tỷ', status: 'Đã bán' },
  { id: 'C2', lot: 'C2', area: 84, price: '2.1 tỷ', status: 'Còn bán' },
  { id: 'C3', lot: 'C3', area: 91, price: '2.6 tỷ', status: 'Còn bán' },
];
