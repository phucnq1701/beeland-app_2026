import React, { useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { FolderItem, FolderListScreen } from "@/components/media/FolderListScreen";
import { useToast } from "@/components/ui";
import { shareText } from "@/lib/shareText";
import { DocumentService } from "@/sevicesSupabase/DocumentService";

/** Thư mục tài liệu của dự án (API giữ nguyên). */
export default function FoldersScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const toast = useToast();

  const load = useCallback(async (): Promise<FolderItem[]> => {
    const res: any = await DocumentService.get({ MaDA: Number(projectId), TypeDocument: "DOCUMENT", InputSearch: "" });
    return (res?.data ?? []).map((item: any) => ({
      id: item.ID?.toString() ?? Math.random().toString(),
      name: item.Name ?? "Không có tên",
      count: item.SoLuong ?? 0,
      note: item.GhiChu ?? "",
    }));
  }, [projectId]);

  return (
    <FolderListScreen
      title="Tài liệu dự án"
      countUnit="tài liệu"
      emptyTitle="Dự án chưa có thư mục tài liệu"
      load={load}
      onOpen={(f) => router.push(`/documents/${f.id}?projectId=${projectId}` as any)}
      onShare={async (f) => {
        const res = await shareText(f.name, `Thư mục tài liệu: ${f.name}\nTổng số: ${f.count ?? 0} tài liệu`);
        if (res === "failed") toast.show({ type: "error", message: "Không chia sẻ được thư mục" });
      }}
    />
  );
}
