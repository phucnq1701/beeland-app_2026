import React, { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";

import { FileItem, FileListScreen } from "@/components/media/FileListScreen";
import { useToast } from "@/components/ui";
import { shareText } from "@/lib/shareText";
import { DocumentService } from "@/sevices/DocumentService";

type Doc = FileItem & { link: string };

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  pages: "application/octet-stream",
};
const mimeOf = (type: string) => MIME_TYPES[type.toLowerCase()] ?? "application/octet-stream";
const normalizeExt = (raw: string) => raw.replace(/^\./, "").toLowerCase();

/** Loại + link của một mục: YouTube → video → tệp (như màn cũ). */
const detectItemType = (item: any): { type: string; link: string } => {
  const yt = item.LinkYoutube?.trim();
  if (yt) return { type: "youtube", link: yt };
  const video = item.LinkVideo?.trim();
  if (video) return { type: "video", link: video };
  const file = item.DuongDan?.trim();
  if (file) return { type: normalizeExt(item.KieuFile ?? ""), link: file };
  return { type: "file", link: "" };
};

/** Video / tệp trong thư mục video của dự án (API, cách mở và chia sẻ giữ nguyên). */
export default function VideoFilesScreen() {
  const { folderId, folderName, maLoai, projectId } = useLocalSearchParams<{
    folderId: string;
    folderName: string;
    projectId: string;
    maLoai: string;
  }>();
  const toast = useToast();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [sharingId, setSharingId] = useState<string | number | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      const loaiId = Number(maLoai ?? folderId);
      if (!loaiId) {
        setLoading(false);
        return;
      }
      if (refresh) setRefreshing(true);
      try {
        const res: any = await DocumentService.getDetailVideo({ MaDA: Number(projectId), MaLoai: loaiId });
        setDocs(
          (res?.data ?? []).map((item: any) => {
            const { type, link } = detectItemType(item);
            return {
              id: item.ID,
              name: item.TenThuVien ?? "Không có tên",
              type,
              size: item.KichThuoc ? `${item.KichThuoc} KB` : undefined,
              date: item.NgayNhap ? new Date(item.NgayNhap).toLocaleDateString("vi-VN") : undefined,
              link,
              note: [item.KyHieu, item.MoTa].filter(Boolean).join(" · "),
            };
          })
        );
        setError(false);
      } catch (e) {
        console.error("Load videos error:", e);
        setError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [maLoai, folderId, projectId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const open = (item: FileItem) => {
    const doc = item as Doc;
    if (!doc.link) {
      toast.show({ type: "info", message: "Mục này chưa có đường dẫn" });
      return;
    }
    if (Platform.OS === "web") {
      window.open(doc.link, "_blank");
      return;
    }
    router.push({ pathname: "/documents/viewer", params: { link: encodeURIComponent(doc.link), type: doc.type, name: doc.name } });
  };

  const share = async (item: FileItem) => {
    const doc = item as Doc;
    if (!doc.link) {
      toast.show({ type: "error", message: "Mục này không có đường dẫn để chia sẻ" });
      return;
    }
    setSharingId(doc.id);
    try {
      // Web, YouTube/video, hoặc máy không hỗ trợ chia sẻ tệp: chia sẻ link
      if (Platform.OS === "web" || doc.type === "youtube" || doc.type === "video" || !(await Sharing.isAvailableAsync())) {
        const ok = await shareText(doc.name, doc.name, doc.link);
        if (!ok) toast.show({ type: "error", message: "Không thể chia sẻ, vui lòng thử lại" });
        return;
      }
      const safeName = doc.name?.trim() || `file.${doc.type}`;
      const downloaded = await FileSystem.downloadAsync(doc.link, `${FileSystem.cacheDirectory}${safeName}`);
      await Sharing.shareAsync(downloaded.uri, { mimeType: mimeOf(doc.type), dialogTitle: `Chia sẻ ${doc.name}`, UTI: mimeOf(doc.type) });
    } catch (e) {
      console.error("[Videos] Share error:", e);
      toast.show({ type: "error", message: "Không thể chia sẻ, vui lòng thử lại" });
    } finally {
      setSharingId(null);
    }
  };

  return (
    <FileListScreen
      title={folderName || "Video"}
      items={docs}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => void load(true)}
      onOpen={open}
      onShare={(f) => void share(f)}
      sharingId={sharingId}
    />
  );
}
