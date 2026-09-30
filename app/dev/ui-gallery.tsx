import { Redirect, Stack } from 'expo-router';
import { Camera, Image as ImageIcon, MoreVertical, QrCode, Trash2, Upload } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppHeader,
  Avatar,
  Badge,
  BottomActionBar,
  BottomSheet,
  Button,
  Card,
  Chip,
  confirm,
  CountdownPill,
  EmptyState,
  ErrorState,
  IconButton,
  KeyValueRow,
  ListItem,
  MoneyText,
  ProgressSteps,
  Screen,
  SearchBar,
  SectionHeader,
  SelectField,
  SheetOption,
  Skeleton,
  SkeletonList,
  StatusBadge,
  Text,
  TextField,
  useToast,
} from '@/components/ui';
import { colors, space, TextVariant } from '@/theme';

// eslint-disable-next-line no-restricted-syntax -- mô phỏng color_code trả về từ API
const SAMPLE_STATUS_COLORS: (string | null)[] = ['#3B82F6', '#FDE68A', null];
const STATUS_LABELS = ['Đang bán', 'Lock', 'Chưa có màu'];
const VARIANTS: TextVariant[] = ['display', 'title', 'heading', 'subhead', 'body', 'caption', 'label'];
const STEPS = ['Giữ chỗ', 'Đã thu tiền', 'Đặt cọc', 'Hợp đồng'] as const;
const SAN_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: `san-${i + 1}`,
  label: i === 0 ? 'Sàn Beeland Hà Nội' : i === 1 ? 'Sàn Đông Đô' : `Sàn giao dịch số ${i + 1}`,
}));

/** Màn xem toàn bộ component design system – chỉ có ở bản dev. */
export default function UiGalleryScreen() {
  const toast = useToast();
  const [pressCount, setPressCount] = useState(0);
  const [chip, setChip] = useState('all');
  const [query, setQuery] = useState('');
  const [san, setSan] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const expiresNormal = useMemo(() => Date.now() + 200_000, []);
  const expiresUrgent = useMemo(() => Date.now() + 90_000, []);
  const expiredAt = useMemo(() => Date.now() - 1_000, []);

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        header={
          <AppHeader
            title="UI Gallery"
            subtitle="Design system – Giai đoạn 0"
            actions={<IconButton icon={MoreVertical} accessibilityLabel="Tuỳ chọn" onPress={() => setSheetOpen(true)} />}
          />
        }
        footer={
          <BottomActionBar>
            <Button variant="secondary" title="Chứng từ" icon={Upload} onPress={() => setSheetOpen(true)} />
            <Button
              title="Thu tiền QR"
              icon={QrCode}
              style={styles.flex}
              onPress={() => toast.show({ type: 'success', message: 'Đã bấm nút chính' })}
            />
          </BottomActionBar>
        }
      >
        <SectionHeader title="Chữ" />
        <Card>
          {VARIANTS.map((v) => (
            <Text key={v} variant={v}>
              {v} – Căn hộ Beeland Riverside
            </Text>
          ))}
        </Card>

        <SectionHeader title="Nút" />
        <Card>
          <View style={styles.wrap}>
            <Button title="Chính" onPress={() => {}} />
            <Button variant="secondary" title="Phụ" onPress={() => {}} />
            <Button variant="ghost" title="Liên kết" onPress={() => {}} />
            <Button variant="danger" title="Huỷ booking" onPress={() => {}} />
            <Button title="Không khả dụng" disabled onPress={() => {}} />
          </View>
          <View style={styles.gap} />
          <Button size="lg" fullWidth title="Tạo booking (lg)" onPress={() => {}} />
          <View style={styles.gap} />
          <Button
            size="lg"
            fullWidth
            loading
            title="Đang tạo… (bấm thử)"
            onPress={() => setPressCount((n) => n + 1)}
          />
          <Text variant="caption" color="textSecondary">
            Số lần nút loading nhận bấm: {pressCount} (phải luôn là 0)
          </Text>
          <View style={styles.wrap}>
            <IconButton icon={Trash2} accessibilityLabel="Xoá" onPress={() => {}} />
            <IconButton icon={Camera} variant="filled" accessibilityLabel="Chụp ảnh" onPress={() => {}} />
          </View>
        </Card>

        <SectionHeader title="Badge · Chip · Avatar · Tiền" />
        <Card>
          <View style={styles.wrap}>
            <Badge label="Trung tính" />
            <Badge label="Thương hiệu" tone="brand" />
            <Badge label="Đã thu" tone="success" />
            <Badge label="Chờ thu" tone="warning" />
            <Badge label="Hết hạn" tone="danger" />
            <Badge label="Thông tin" tone="info" />
          </View>
          <View style={styles.gap} />
          <View style={styles.wrap}>
            {SAMPLE_STATUS_COLORS.map((c, i) => (
              <StatusBadge key={STATUS_LABELS[i]} label={STATUS_LABELS[i]} color={c} />
            ))}
          </View>
          <View style={styles.gap} />
          <View style={styles.wrap}>
            {[
              ['all', 'Tất cả', 42],
              ['pending', 'Chờ thu', 7],
              ['paid', 'Đã thu', 30],
            ].map(([key, label, count]) => (
              <Chip
                key={key as string}
                label={label as string}
                count={count as number}
                selected={chip === key}
                onPress={() => setChip(key as string)}
              />
            ))}
          </View>
          <View style={styles.gap} />
          <View style={styles.wrap}>
            <Avatar name="Nguyễn Minh Anh" size={32} />
            <Avatar name="Trần Hoàng" />
            <Avatar name="Lê Phương" size={56} />
          </View>
          <View style={styles.gap} />
          <MoneyText value={50000000} variant="display" />
          <MoneyText value={3482600000} short variant="title" />
          <MoneyText value={null} />
        </Card>

        <SectionHeader title="Dòng danh sách · Key/Value" actionLabel="Xem tất cả" onAction={() => {}} />
        <Card padding={0}>
          <ListItem
            title="Nguyễn Minh Anh"
            subtitle="A1-12.08 · Beeland Riverside"
            meta="30/09/2026"
            leading={<Avatar name="Nguyễn Minh Anh" />}
            trailing={
              <>
                <MoneyText value={3482600000} short />
                <StatusBadge label="Chờ duyệt" color={SAMPLE_STATUS_COLORS[0]} />
              </>
            }
            onPress={() => {}}
          />
          <ListItem title="Trần Hoàng" subtitle="Khách mới" chevron onPress={() => {}} />
        </Card>
        <Card>
          <KeyValueRow label="Ngân hàng" value="Vietcombank" />
          <KeyValueRow label="Số tài khoản" value="1023 4567 89" copyValue="1023456789" />
          <KeyValueRow label="Nội dung" value="BK24100137" copyValue="BK24100137" last />
        </Card>

        <SectionHeader title="Card trưng bày" />
        <Card tone="showcase">
          <Text variant="caption" color={colors.showcase.textMuted}>
            Beeland Riverside · Toà A1
          </Text>
          <Text variant="heading" color={colors.showcase.text}>
            Căn A1-12.08 · 2PN
          </Text>
          <MoneyText value={3482600000} short variant="title" color={colors.showcase.accent} />
        </Card>

        <SectionHeader title="Form" />
        <Card>
          <View style={styles.form}>
            <TextField label="Số điện thoại" placeholder="VD: 0912 345 678" helper="Dùng để gửi xác nhận booking" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <TextField label="CCCD" required value="0012345" error="CCCD phải gồm 12 số" />
            <SearchBar value={query} onChangeText={setQuery} placeholder="Tên, SĐT hoặc mã KH" />
            <SelectField label="Sàn giao dịch" required value={san} options={SAN_OPTIONS} onChange={setSan} />
          </View>
        </Card>

        <SectionHeader title="Tiến độ · Đếm ngược" />
        <Card>
          <View style={styles.form}>
            {[0, 1, 2, 3].map((c) => (
              <ProgressSteps key={c} steps={STEPS} current={c} />
            ))}
            <ProgressSteps steps={STEPS} current={1} cancelled />
            <CountdownPill expiresAt={expiresNormal} />
            <CountdownPill expiresAt={expiresUrgent} />
            <CountdownPill expiresAt={expiredAt} />
            <CountdownPill expiresAt={expiresNormal} compact />
          </View>
        </Card>

        <SectionHeader title="Trạng thái" />
        <Card padding={0}>
          <SkeletonList count={2} />
        </Card>
        <Skeleton height={80} />
        <Card>
          <EmptyState title="Chưa có booking nào" description="Tạo booking từ màn Sản phẩm hoặc Lock căn." actionLabel="Đến Sản phẩm" onAction={() => {}} />
        </Card>
        <Card>
          <ErrorState onRetry={() => toast.show({ type: 'info', message: 'Đang thử lại…' })} />
        </Card>

        <SectionHeader title="Toast · Xác nhận" />
        <Card>
          <View style={styles.wrap}>
            <Button variant="secondary" title="Toast thành công" onPress={() => toast.show({ type: 'success', message: 'Đã tạo booking cho Nguyễn Minh Anh' })} />
            <Button
              variant="secondary"
              title="Toast lỗi"
              onPress={() =>
                toast.show({
                  type: 'error',
                  message: 'Không tải được chứng từ',
                  action: { label: 'Thử lại', onPress: () => toast.show({ type: 'info', message: 'Đang thử lại…' }) },
                })
              }
            />
            <Button variant="secondary" title="Toast thông tin" onPress={() => toast.show({ type: 'info', message: 'Mã QR đã được lưu vào thư viện ảnh' })} />
            <Button
              variant="danger"
              title="Xác nhận huỷ"
              onPress={async () => {
                const ok = await confirm({
                  title: 'Huỷ mã QR',
                  message: 'Người chuyển tiền vào tài khoản này sẽ không được ghi nhận.',
                  confirmText: 'Huỷ mã QR',
                  destructive: true,
                });
                toast.show({ type: 'info', message: ok ? 'Đã chọn: Huỷ mã QR' : 'Đã chọn: Không' });
              }}
            />
          </View>
        </Card>
      </Screen>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Tải chứng từ">
        <SheetOption icon={Camera} label="Chụp ảnh" onPress={() => setSheetOpen(false)} />
        <SheetOption icon={ImageIcon} label="Chọn từ thư viện" onPress={() => setSheetOpen(false)} />
        <SheetOption icon={Trash2} label="Huỷ mã QR này để tạo lại" destructive onPress={() => setSheetOpen(false)} />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  gap: { height: space.md },
  form: { gap: space.lg },
});
