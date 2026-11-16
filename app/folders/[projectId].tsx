import React, { useCallback } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { FolderItem, FolderListScreen } from "@/components/media/FolderListScreen";
import { useToast } from "@/components/ui";
import { shareText } from "@/lib/shareText";
import { DocumentService, type DocEntry } from "@/sevicesSupabase/DocumentService";

/**
 * Thư mục tài liệu của dự án (cây thư mục như web — fn_nv_app_tai_lieu_cay). `parentId` có ⇒ thư mục con của thư mục đó.
 * Mở thư mục còn thư mục con ⇒ vào cấp dưới; không còn ⇒ danh sách tệp. Tệp nằm thẳng trong thư mục đang xem ⇒ ô đầu.
 */
export default function FoldersScreen() {
  const { projectId, parentId, title } = useLocalSearchParams<{ projectId: string; parentId?: string; title?: string }>();
  const router = useRouter();
  const toast = useToast();

  const load = useCallback(async (): Promise<FolderItem[]> => {
    const rows = await DocumentService.entries("DOCUMENT", projectId ? String(projectId) : null, parentId ? String(parentId) : null);
    return rows.map((f: DocEntry) => ({
      id: `${f.filesOf ? "f" : "d"}:${f.id}`,
      name: f.filesOf ? (f.isRoot ? "Tài liệu chung của dự án" : "Tài liệu trong thư mục này") : f.name,
      count: f.fileCount,
      note: f.filesOf ? null : [f.folderCount ? `${f.folderCount} thư mục con` : "", f.note].filter(Boolean).join(" · "),
      raw: f,
    }));
  }, [projectId, parentId]);

  return (
    <FolderListScreen
      title={title ? String(title) : "Tài liệu dự án"}
      countUnit="tài liệu"
      emptyTitle={parentId ? "Thư mục trống" : "Dự án chưa có thư mục tài liệu"}
      load={load}
      onOpen={(item) => {
        const f = item.raw as DocEntry;
        if (f.filesOf || f.folderCount === 0)
          router.push({ pathname: "/documents/[folderId]", params: { folderId: f.id, title: f.name } });
        else router.push({ pathname: "/folders/[projectId]", params: { projectId: String(projectId ?? ""), parentId: f.id, title: f.name } });
      }}
      onShare={async (f) => {
        const res = await shareText(f.name, `Thư mục tài liệu: ${f.name}\nTổng số: ${f.count ?? 0} tài liệu`);
        if (res === "failed") toast.show({ type: "error", message: "Không chia sẻ được thư mục" });
      }}
    />
  );
}
