export type UnitStatus = 'available' | 'deposit' | 'holding' | 'pending_kitchen' | 'sold' | 'locked';

export interface OverviewUnit {
  id: string;
  code: string;
  price: string;
  status: UnitStatus;
}

export interface Floor {
  name: string;
  totalUnits: number;
  units: OverviewUnit[];
}

export interface BuildingBlock {
  id: string;
  name: string;
  floors: Floor[];
}

export const statusConfig: Record<UnitStatus, { label: string; color: string; bgColor: string }> = {
  available: { label: 'Trống', color: '#FFFFFF', bgColor: '#22C55E' },
  deposit: { label: 'Đã cọc', color: '#FFFFFF', bgColor: '#3B82F6' },
  holding: { label: 'Giữ chỗ', color: '#FFFFFF', bgColor: '#F59E0B' },
  pending_kitchen: { label: 'Bếp chờ', color: '#FFFFFF', bgColor: '#F97316' },
  sold: { label: 'Đã bán', color: '#FFFFFF', bgColor: '#EF4444' },
  locked: { label: 'Lock', color: '#FFFFFF', bgColor: '#6B7280' },
};

export const overviewBlocks: BuildingBlock[] = [
  {
    id: 'block-a',
    name: 'Block A',
    floors: [
      {
        name: 'Tầng 7',
        totalUnits: 16,
        units: [
          { id: 'P0701', code: 'P0701', price: '2.500', status: 'deposit' },
          { id: 'P0714', code: 'P0714', price: '2.800', status: 'available' },
          { id: 'P01', code: 'P01', price: '3.200', status: 'holding' },
          { id: 'P0705', code: 'P0705', price: '2.600', status: 'available' },
          { id: 'P04', code: 'P04', price: '4.200', status: 'sold' },
          { id: 'P0702', code: 'P0702', price: '2.500', status: 'available' },
          { id: 'P0704', code: 'P0704', price: '2.700', status: 'pending_kitchen' },
          { id: 'P0706', code: 'P0706', price: '2.900', status: 'available' },
          { id: 'P0707', code: 'P0707', price: '3.100', status: 'deposit' },
          { id: 'P0708', code: 'P0708', price: '2.450', status: 'sold' },
          { id: 'P0709', code: 'P0709', price: '2.550', status: 'available' },
          { id: 'P0710', code: 'P0710', price: '3.000', status: 'holding' },
          { id: 'P0711', code: 'P0711', price: '2.650', status: 'available' },
          { id: 'P0712', code: 'P0712', price: '2.750', status: 'sold' },
          { id: 'P0703', code: 'P0703', price: '2.850', status: 'deposit' },
          { id: 'P0713', code: 'P0713', price: '2.950', status: 'available' },
        ],
      },
      {
        name: 'Tầng 8',
        totalUnits: 16,
        units: [
          { id: 'P0801', code: 'P0801', price: '2.600', status: 'available' },
          { id: 'P0802', code: 'P0802', price: '2.700', status: 'deposit' },
          { id: 'P0803', code: 'P0803', price: '2.800', status: 'sold' },
          { id: 'P0804', code: 'P0804', price: '3.000', status: 'available' },
          { id: 'P0805', code: 'P0805', price: '2.500', status: 'holding' },
          { id: 'P0806', code: 'P0806', price: '2.650', status: 'available' },
          { id: 'P0807', code: 'P0807', price: '3.200', status: 'pending_kitchen' },
          { id: 'P0808', code: 'P0808', price: '2.750', status: 'deposit' },
          { id: 'P0809', code: 'P0809', price: '2.900', status: 'available' },
          { id: 'P0810', code: 'P0810', price: '3.100', status: 'sold' },
          { id: 'P0811', code: 'P0811', price: '2.450', status: 'available' },
          { id: 'P0812', code: 'P0812', price: '2.550', status: 'holding' },
          { id: 'P0813', code: 'P0813', price: '2.850', status: 'deposit' },
          { id: 'P0814', code: 'P0814', price: '2.950', status: 'available' },
          { id: 'P0815', code: 'P0815', price: '3.050', status: 'sold' },
          { id: 'P0816', code: 'P0816', price: '2.400', status: 'available' },
        ],
      },
      {
        name: 'Tầng 10',
        totalUnits: 15,
        units: [
          { id: 'P1001', code: 'P1001', price: '3.200', status: 'deposit' },
          { id: 'P1002', code: 'P1002', price: '3.000', status: 'available' },
          { id: 'P1003', code: 'P1003', price: '3.400', status: 'sold' },
          { id: 'P1004', code: 'P1004', price: '2.800', status: 'available' },
          { id: 'P1005', code: 'P1005', price: '3.100', status: 'holding' },
          { id: 'P1006', code: 'P1006', price: '2.900', status: 'available' },
          { id: 'P1007', code: 'P1007', price: '3.300', status: 'pending_kitchen' },
          { id: 'P1008', code: 'P1008', price: '2.750', status: 'deposit' },
          { id: 'P1009', code: 'P1009', price: '3.050', status: 'sold' },
          { id: 'P1010', code: 'P1010', price: '2.650', status: 'available' },
          { id: 'P1011', code: 'P1011', price: '3.150', status: 'available' },
          { id: 'P1012', code: 'P1012', price: '2.850', status: 'holding' },
          { id: 'P1013', code: 'P1013', price: '3.250', status: 'deposit' },
          { id: 'P1014', code: 'P1014', price: '2.950', status: 'sold' },
          { id: 'P1015', code: 'P1015', price: '3.500', status: 'available' },
        ],
      },
      {
        name: 'Tầng 12',
        totalUnits: 16,
        units: [
          { id: 'P1201', code: 'P1201', price: '3.500', status: 'available' },
          { id: 'P1202', code: 'P1202', price: '3.200', status: 'deposit' },
          { id: 'P1203', code: 'P1203', price: '3.800', status: 'sold' },
          { id: 'P1204', code: 'P1204', price: '3.000', status: 'available' },
          { id: 'P1205', code: 'P1205', price: '3.400', status: 'pending_kitchen' },
          { id: 'P1206', code: 'P1206', price: '3.100', status: 'holding' },
          { id: 'P1207', code: 'P1207', price: '3.600', status: 'available' },
          { id: 'P1208', code: 'P1208', price: '3.300', status: 'deposit' },
          { id: 'P1209', code: 'P1209', price: '3.700', status: 'sold' },
          { id: 'P1210', code: 'P1210', price: '2.900', status: 'available' },
          { id: 'P1211', code: 'P1211', price: '3.450', status: 'available' },
          { id: 'P1212', code: 'P1212', price: '3.150', status: 'holding' },
          { id: 'P1213', code: 'P1213', price: '3.550', status: 'deposit' },
          { id: 'P1214', code: 'P1214', price: '3.250', status: 'sold' },
          { id: 'P1215', code: 'P1215', price: '3.900', status: 'available' },
          { id: 'P1216', code: 'P1216', price: '3.050', status: 'locked' },
        ],
      },
      {
        name: 'Tầng 15',
        totalUnits: 14,
        units: [
          { id: 'P1501', code: 'P1501', price: '4.200', status: 'deposit' },
          { id: 'P1502', code: 'P1502', price: '3.800', status: 'available' },
          { id: 'P1503', code: 'P1503', price: '4.500', status: 'sold' },
          { id: 'P1504', code: 'P1504', price: '3.600', status: 'available' },
          { id: 'P1505', code: 'P1505', price: '4.000', status: 'holding' },
          { id: 'P1506', code: 'P1506', price: '3.900', status: 'available' },
          { id: 'P1507', code: 'P1507', price: '4.300', status: 'pending_kitchen' },
          { id: 'P1508', code: 'P1508', price: '3.700', status: 'deposit' },
          { id: 'P1509', code: 'P1509', price: '4.100', status: 'available' },
          { id: 'P1510', code: 'P1510', price: '3.500', status: 'sold' },
          { id: 'P1511', code: 'P1511', price: '4.400', status: 'available' },
          { id: 'P1512', code: 'P1512', price: '3.950', status: 'locked' },
          { id: 'P1513', code: 'P1513', price: '4.600', status: 'deposit' },
          { id: 'P1514', code: 'P1514', price: '3.850', status: 'sold' },
        ],
      },
    ],
  },
];

export function getOverviewStats(block: BuildingBlock) {
  const allUnits = block.floors.flatMap((f) => f.units);
  const total = allUnits.length;
  const available = allUnits.filter((u) => u.status === 'available').length;
  const deposit = allUnits.filter((u) => u.status === 'deposit').length;
  const holding = allUnits.filter((u) => u.status === 'holding').length;
  const pendingKitchen = allUnits.filter((u) => u.status === 'pending_kitchen').length;
  const sold = allUnits.filter((u) => u.status === 'sold').length;
  const locked = allUnits.filter((u) => u.status === 'locked').length;

  return { total, available, deposit, holding, pendingKitchen, sold, locked };
}
