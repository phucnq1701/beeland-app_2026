import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { FileItem, FileListScreen } from "@/components/media/FileListScreen";
import { useToast } from "@/components/ui";
import { getDocumentType, getRawDocumentUrl, OFFICE_TYPES } from "@/components/utils/documentLinks";
import { DocumentService } from "@/sevicesSupabase/DocumentService";

type Doc = FileItem & { link: string };

const WEB_VIEW_TYPES = ["pdf", "jpg", "jpeg", "png", "txt", "html", "doc", "docx", "xls", "xlsx"];

/** Tài liệu trong thư mục: tìm kiếm phía máy chủ (chờ 500ms như cũ), mở bằng trình xem hoặc ứng dụng ngoài. */
export default function DocumentsScreen() {
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  const toast = useToast();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const version = useRef(0);

  const load = useCallback(
    async (search = "", refresh = false) => {
      const v = ++version.current;
      if (refresh) setRefreshing(true);
      try {
        const res: any = await DocumentService.getDetail({ DocumentID: Number(folderId), InputSearch: search });
        if (v !== version.current) return;
        setDocs(
          (res?.data ?? []).map((doc: any) => ({
            id: doc.ID,
            name: doc.Name,
            type: getDocumentType(doc.Type || "", doc.Name || "", doc.Link || ""),
            size: doc.Size > 0 ? `${doc.Size} MB` : undefined,
            date: doc.CreatedAt ? new Date(doc.CreatedAt).toLocaleDateString("vi-VN") : undefined,
            link: !doc.Link ? "" : /^https?:\/\//i.test(doc.Link) ? doc.Link : `https://upload.beesky.vn/${doc.Link.replace(/^\/+/, "")}`,
            note: doc.GhiChu,
          }))
        );
        setError(false);
      } catch (e) {
        console.error("Load documents error:", e);
        if (v === version.current) setError(true);
      } finally {
        if (v === version.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [folderId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const onQueryChange = (text: string) => {
    setQuery(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(text), 500);
  };

  const open = (item: FileItem) => {
    const doc = item as Doc;
    try {
      const rawUrl = getRawDocumentUrl(doc.link);
      const fileType = getDocumentType(doc.type, doc.name, rawUrl);
      // Office luôn qua màn xem (có lựa chọn/dự phòng); định dạng xem được trong app → màn xem
      if (OFFICE_TYPES.includes(fileType) || (Platform.OS !== "web" && WEB_VIEW_TYPES.includes(fileType.toLowerCase()))) {
        router.push({ pathname: "/documents/viewer", params: { link: rawUrl, type: fileType, name: doc.name } });
        return;
      }
      if (Platform.OS === "web") window.open(rawUrl, "_blank", "noopener,noreferrer");
      else Linking.openURL(rawUrl).catch(() => toast.show({ type: "error", message: "Không thể mở tài liệu" }));
    } catch {
      toast.show({ type: "error", message: "Đường dẫn tài liệu trống hoặc không hợp lệ" });
    }
  };

  return (
    <FileListScreen
      title="Tài liệu"
      items={docs}
      loading={loading}
      error={error}
      refreshing={refreshing}
      onRefresh={() => void load(query, true)}
      onOpen={open}
      query={query}
      onQueryChange={onQueryChange}
    />
  );
}
