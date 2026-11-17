import React, { useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { FolderItem, FolderListScreen } from "@/components/media/FolderListScreen";
import { DocumentService, type DocEntry } from "@/services/DocumentService";

/**
 * Thư viện ảnh của dự án (cây album như web — fn_nv_app_tai_lieu_cay, màn 323; ảnh bìa = ảnh đầu tiên của album).
 * `parentId` có ⇒ album con. Mở album còn album con ⇒ vào cấp dưới; không còn ⇒ xem ảnh.
 */
export default function PhotoGalleryScreen() {
  const router = useRouter();
  const { projectId, parentId, title } = useLocalSearchParams<{ projectId?: string; parentId?: string; title?: string }>();

  const load = useCallback(async (): Promise<FolderItem[]> => {
    const rows = await DocumentService.entries("GALLERY", projectId ? String(projectId) : null, parentId ? String(parentId) : null);
    return rows.map((f: DocEntry) => ({
      id: `${f.filesOf ? "f" : "d"}:${f.id}`,
      name: f.filesOf ? (f.isRoot ? "Ảnh chung của dự án" : "Ảnh trong album này") : f.name,
      count: f.fileCount,
      cover: f.cover,
      note: f.filesOf || !f.folderCount ? null : `${f.folderCount} album con`,
      raw: f,
    }));
  }, [projectId, parentId]);

  return (
    <FolderListScreen
      title={title ? String(title) : "Thư viện ảnh"}
      countUnit="ảnh"
      emptyTitle={parentId ? "Album trống" : "Dự án chưa có album ảnh"}
      load={load}
      onOpen={(item) => {
        const f = item.raw as DocEntry;
        if (f.filesOf || f.folderCount === 0)
          router.push({ pathname: "/photos/[folderId]", params: { folderId: f.id, folder: JSON.stringify({ Name: f.name }) } });
        else router.push({ pathname: "/photo-gallery", params: { projectId: String(projectId ?? ""), parentId: f.id, title: f.name } });
      }}
    />
  );
}
