import React, { createContext, useContext } from 'react';

/**
 * Cho component chữ biết Be Vietnam Pro đã nạp xong chưa. Mặc định true để màn
 * không nằm trong provider (vd test, storybook) vẫn dùng font thương hiệu.
 */
const FontStatusContext = createContext(true);

export function FontStatusProvider({ loaded, children }: { loaded: boolean; children: React.ReactNode }) {
  return <FontStatusContext.Provider value={loaded}>{children}</FontStatusContext.Provider>;
}

export function useFontsLoaded(): boolean {
  return useContext(FontStatusContext);
}
