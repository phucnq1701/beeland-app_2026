import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle, StatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';

/**
 * Đổi kiểu thanh trạng thái CHỈ khi màn đang được xem; rời màn thì trả về "dark"
 * (mặc định toàn app). Dùng cho màn trưng bày có ảnh tối ở đầu – nếu render
 * <StatusBar style="light" /> thì màn kế tiếp (nền sáng) bị thừa hưởng biểu tượng trắng.
 */
export function FocusStatusBar({ style }: { style: StatusBarStyle }) {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(style);
      return () => setStatusBarStyle('dark');
    }, [style])
  );
  return null;
}
