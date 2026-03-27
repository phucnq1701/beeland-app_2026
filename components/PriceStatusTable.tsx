import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Colors from '@/constants/colors';
import { LotRow } from '@/mocks/priceTable';

interface PriceStatusTableProps {
  rows?: LotRow[];
  title?: string;
}

export default function PriceStatusTable({ rows, title }: PriceStatusTableProps) {
  const data = rows ?? [];


  return (
    <View style={styles.container} testID="price-status-table">
      {!!title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.tableCard}>
        <View style={styles.headerRow} testID="table-header">
          <Text style={[styles.headerCell, styles.colLot]}>Lô/Nền</Text>
          <Text style={[styles.headerCell, styles.colArea]}>Diện tích</Text>
          <Text style={[styles.headerCell, styles.colPrice]}>Giá</Text>
          <Text style={[styles.headerCell, styles.colStatus]}>Trạng thái</Text>
        </View>
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          {data.map((row, idx) => (
            <View
              key={row.id}
              style={[styles.bodyRow, idx % 2 === 1 ? styles.rowAlt : undefined]}
              testID={`row-${row.id}`}
            >
              <Text numberOfLines={1} style={[styles.cell, styles.colLot]}>{row.lot}</Text>
              <Text style={[styles.cell, styles.colArea]}>{row.area} m²</Text>
              <Text style={[styles.cell, styles.colPrice]}>{row.price}</Text>
              <View style={[styles.cell, styles.colStatus, styles.statusCell]}> 
                <View style={[styles.badge, getBadgeStyle(row.status)]}>
                  <Text style={styles.badgeText}>{row.status}</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={styles.legend}>
          <LegendItem color="#10B981" label="Còn bán" />
          <LegendItem color="#F59E0B" label="Giữ chỗ" />
          <LegendItem color="#EF4444" label="Đã bán" />
        </View>
      </View>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function getBadgeStyle(status: LotRow['status']) {
  switch (status) {
    case 'Còn bán':
      return { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: '#10B981' };
    case 'Giữ chỗ':
      return { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: '#F59E0B' };
    case 'Đã bán':
      return { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: '#EF4444' };
    default:
      return { backgroundColor: Colors.featureBlue, borderColor: Colors.iconBlue };
  }
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  title: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  tableCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerCell: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
  },
  body: { maxHeight: 360 },
  bodyContent: { paddingBottom: 8 },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowAlt: { backgroundColor: '#FAFAFA' },
  cell: { paddingVertical: 14, paddingHorizontal: 12, color: Colors.text, fontSize: 14 },
  colLot: { flex: 1.1 },
  colArea: { flex: 1 },
  colPrice: { flex: 1 },
  colStatus: { flex: 1 },
  statusCell: { justifyContent: 'center' },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { fontSize: 12, fontWeight: '700' as const, color: Colors.text },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: Colors.textSecondary, fontSize: 12 },
});
