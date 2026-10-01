import React, { useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { FolderItem, FolderListScreen } from "@/components/media/FolderListScreen";
import { DocumentService } from "@/sevicesSupabase/DocumentService";

const imageUrl = (url?: string) => (!url ? null : url.startsWith("http") ? url : `https://upload.beesky.vn/${url}`);

/**
 * Thư viện ảnh của dự án (API giữ nguyên). Bộ lọc dự án cũ dùng dữ liệu mẫu và không lọc thật → bỏ.
 */
export default function PhotoGalleryScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();

  const load = useCallback(async (): Promise<FolderItem[]> => {
    const res: any = await DocumentService.get({ MaDA: Number(projectId), TypeDocument: "GALLERY", InputSearch: "" });
    return (res?.data ?? []).map((item: any) => ({
      id: String(item.ID),
      name: item.Name ?? "Không có tên",
      count: item.SoLuong ?? 0,
      cover: imageUrl(item.FirstFile),
      raw: item,
    }));
  }, [projectId]);

  return (
    <FolderListScreen
      title="Thư viện ảnh"
      countUnit="ảnh"
      emptyTitle="Dự án chưa có album ảnh"
      load={load}
      onOpen={(f) =>
        router.push({ pathname: "/photos/[folderId]", params: { folderId: f.raw?.ID, folder: JSON.stringify(f.raw) } })
      }
    />
  );
}
