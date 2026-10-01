import React, { useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { FolderItem, FolderListScreen } from "@/components/media/FolderListScreen";
import { DocumentService } from "@/sevices/DocumentService";

/** Thư mục video của dự án – danh sách loại (MaLoai, TenLoai), API giữ nguyên. */
export default function VideoFoldersScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();

  const load = useCallback(async (): Promise<FolderItem[]> => {
    const res: any = await DocumentService.getFolderVideo({ InputSearch: "", MaDA: Number(projectId), TypeDocument: "GALLERY" });
    return (res?.data ?? []).map((item: any) => ({
      id: item.MaLoai?.toString() ?? Math.random().toString(),
      name: item.TenLoai ?? "Không có tên",
    }));
  }, [projectId]);

  return (
    <FolderListScreen
      title="Video dự án"
      countUnit="video"
      emptyTitle="Dự án chưa có video"
      load={load}
      onOpen={(f) =>
        router.push({ pathname: `/videos/${f.id}`, params: { projectId, folderName: f.name, maLoai: f.id } } as any)
      }
    />
  );
}
