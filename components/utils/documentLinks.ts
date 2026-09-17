const OFFICE_HOST = "view.officeapps.live.com";

export const OFFICE_TYPES = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"];

export const OFFICE_MIME: Record<string, string> = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export const OFFICE_UTI: Record<string, string> = {
  doc: "com.microsoft.word.doc",
  docx: "org.openxmlformats.wordprocessingml.document",
  xls: "com.microsoft.excel.xls",
  xlsx: "org.openxmlformats.spreadsheetml.sheet",
  ppt: "com.microsoft.powerpoint.ppt",
  pptx: "org.openxmlformats.presentationml.presentation",
};

/** Accept raw URLs and the encoded route params used by older callers.
 * Never decode an already valid URL: doing so corrupts signed query strings.
 */
export function getRawDocumentUrl(value: string): string {
  let link = value.trim();
  if (/^https?%3a%2f%2f/i.test(link)) {
    link = decodeURIComponent(link);
  }
  // Unwrap legacy Office URLs, including accidentally double-wrapped links.
  for (let i = 0; i < 5; i += 1) {
    const url = new URL(link);
    if (!["https:", "http:"].includes(url.protocol)) {
      throw new Error("Đường dẫn tài liệu phải là HTTP hoặc HTTPS.");
    }
    if (url.hostname.toLowerCase() !== OFFICE_HOST) return link;
    const source = url.searchParams.get("src");
    if (!source) throw new Error("Link Office thiếu đường dẫn file gốc.");
    link = source;
  }
  throw new Error("Link Office bị lồng quá nhiều lần.");
}

export function getDocumentType(type: string, name: string, rawUrl: string): string {
  const normalized = type.trim().replace(/^\./, "").toLowerCase();
  const mimeType = Object.keys(OFFICE_MIME).find((key) => OFFICE_MIME[key] === normalized);
  if (mimeType) return mimeType;
  if (/^[a-z0-9]+$/.test(normalized)) return normalized;
  for (const candidate of [name, rawUrl.split(/[?#]/)[0]]) {
    const extension = candidate.match(/\.([a-z0-9]+)$/i)?.[1];
    if (extension) return extension.toLowerCase();
  }
  return "";
}

export function getOfficeViewerUrl(rawUrl: string): string {
  return `https://${OFFICE_HOST}/op/view.aspx?src=${encodeURIComponent(getRawDocumentUrl(rawUrl))}`;
}

export function getDocumentFileName(name: string, type: string): string {
  const base = name.trim().replace(/[/\\:*?"<>|\u0000-\u001f]/g, "_") || "tai-lieu";
  return type && !base.toLowerCase().endsWith(`.${type}`) ? `${base}.${type}` : base;
}