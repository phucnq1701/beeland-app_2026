// ⚠️ TỰ SINH — thân component ShiftPickerFields của web src/pages/sales/giao-dich/dat-lich-ky/ShiftPickerFields.tsx chép NGUYÊN VĂN thành hook (scripts/sync-web-pricing.cjs).
// Bỏ câu return JSX + 0 câu giao diện: . KHÔNG SỬA TAY.
// @ts-nocheck
/* eslint-disable */
import { useFieldConfig } from "../../../../hooks/useFieldConfig";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { type BookOptions, SigningBookingService, type BookDiemDs, hoSoForPhanLoai, type BookDiem } from "../../../../services/sales/signing-booking";
import { type ShiftSlot, SigningShiftConfigService } from "../../../../services/SigningShiftConfigService";
import dayjs from "dayjs";
import { listPriceListUnitFunds } from "../../../../services/products/price-list";
import { toast } from "../../../../_shims/sonner";
import { googleMapsLink } from "../../../../services/sales/signing-catalog";

const NGUON_QUY: Record<string, string> = {
  GIAO_DICH: "theo hợp đồng / giao dịch",
  BANG_GIA: "theo bảng giá của giao dịch",
  MAC_DINH: "mặc định",
};

export const buildAppointmentText = (a: {
  thuTuc?: string | null;
  tenKH?: string | null;
  maCan?: string | null;
  ngay?: string | null;
  ca?: string | null;
  diem?: Pick<BookDiem, "ten" | "diaChi" | "viDo" | "kinhDo" | "dienThoai" | "huongDan"> | null;
  hoSo?: { name: string; note?: string | null; ghiChu?: string | null }[];
}) => {
  const L: string[] = [`LỊCH HẸN${a.thuTuc ? ` — ${a.thuTuc.toUpperCase()}` : ""}`];
  if (a.tenKH || a.maCan) L.push(`Khách hàng: ${[a.tenKH, a.maCan ? `căn ${a.maCan}` : null].filter(Boolean).join(" · ")}`);
  if (a.ngay || a.ca) L.push(`Thời gian: ${[a.ca, a.ngay ? `ngày ${a.ngay}` : null].filter(Boolean).join(", ")}`);
  if (a.diem?.ten) L.push(`Địa điểm: ${a.diem.ten}${a.diem.diaChi ? ` — ${a.diem.diaChi}` : ""}`);
  const link = a.diem ? googleMapsLink(a.diem) : null;
  if (link) L.push(`Chỉ đường: ${link}`);
  if (a.diem?.huongDan) L.push(`Hướng dẫn: ${a.diem.huongDan}`);
  if (a.diem?.dienThoai) L.push(`Liên hệ: ${a.diem.dienThoai}`);
  if (a.hoSo?.length) {
    L.push("Hồ sơ cần mang theo:");
    a.hoSo.forEach((h) => L.push(`- ${h.name}${[h.note, h.ghiChu].filter(Boolean).length ? ` (${[h.note, h.ghiChu].filter(Boolean).join("; ")})` : ""}`));
  }
  return L.join("\n");
};

export function useWebShiftPicker({
  value,
  onChange,
  dateField,
  editingId,
}: any = {}) {
  const fc = useFieldConfig("signing");
  const [funds, setFunds] = useState<{ value: string; label: string }[]>([]);
  const [opt, setOpt] = useState<BookOptions | null>(null);
  const [optErr, setOptErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState<ShiftSlot[]>([]);
  const pgc: string | null = value?.MaPGC ? String(value.MaPGC) : null;
  const dateStr = value?.NgayBookKy ? dayjs(value.NgayBookKy).format("YYYY-MM-DD") : "";
  const code: string | null = value?.MaLoaiThuTuc ?? null;
  const quy: string | null = value?.QuyKy ?? null;
  const cfgId: string | null = value?.MaCauHinh ? String(value.MaCauHinh).toLowerCase() : null;
  const aliveRef = useRef(true);
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);
  const patch = useCallback((p: Record<string, any>) => onChange((prev: any) => ({ ...prev, ...p })), [onChange]);
  useEffect(() => {
    listPriceListUnitFunds().then((f) => aliveRef.current && setFunds(f.map((x) => ({ value: x.id.toLowerCase(), label: x.name }))));
  }, []);
  useEffect(() => {
    if (!pgc) {
      setOpt(null);
      return;
    }
    let alive = true;
    setLoading(true);
    SigningBookingService.options({ pgcId: pgc, quyId: quy, thuTuc: code, ngay: dateStr || null })
      .then((o) => {
        if (!alive) return;
        setOpt(o);
        setOptErr(null);
        const cur = valueRef.current;
        const next: Record<string, any> = {};
        // Quỹ do ô Quỹ đầu form chọn (mặc định Quỹ CĐT — DK23), không tự đổi theo giao dịch
        // Chỉ một điểm của quỹ ⇒ chọn sẵn; điểm chỉ một thủ tục ⇒ chọn sẵn
        let ds = cur?.MaCauHinh ? o.diemDs.find((d) => d.configId === String(cur.MaCauHinh).toLowerCase()) : undefined;
        // Đổi giao dịch / quỹ ⇒ điểm đang chọn không còn hợp lệ (thêm mới) ⇒ bỏ
        if (cur?.MaCauHinh && !ds && !editingId) {
          Object.assign(next, { MaCauHinh: null, DiemKy: null, TenDiemKy: null, MaLoaiThuTuc: null, TenLoaiThuTuc: null, LoaiThuTuc: null, MaCa: null, TenCa: null });
        }
        if (!ds && o.diemDs.length === 1 && !(cur?.MaCauHinh && editingId)) {
          ds = o.diemDs[0];
          Object.assign(next, { MaCauHinh: ds.configId, DiemKy: ds.diemKyId, TenDiemKy: ds.ten });
        }
        // Sửa lịch cũ chỉ có id thủ tục: dò mã theo tên đang lưu
        if (!cur?.MaLoaiThuTuc && cur?.TenLoaiThuTuc) {
          const t = (ds?.thuTuc ?? o.thuTuc).find((x) => x.name === cur.TenLoaiThuTuc);
          if (t) next.MaLoaiThuTuc = t.code;
        } else if (!cur?.MaLoaiThuTuc && ds?.thuTuc.length === 1) {
          Object.assign(next, { MaLoaiThuTuc: ds.thuTuc[0].code, TenLoaiThuTuc: ds.thuTuc[0].name });
        }
        if (Object.keys(next).length) patch(next);
      })
      .catch((e: Error) => alive && (setOpt(null), setOptErr(e?.message || "Không tải được điểm ký")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pgc, quy, code, dateStr]);
  const diemDs = opt?.diemDs ?? [];
  const chosenDs = diemDs.find((d) => d.configId === cfgId) ?? null;
  const chosen = (opt?.diem ?? []).find((d) => d.configId === cfgId) ?? null;
  const procId: string | null = chosen?.procedureId ?? (value?.LoaiThuTuc ? String(value.LoaiThuTuc) : null);
  const place = chosen ?? (chosenDs ? { ...chosenDs, viDo: null, kinhDo: null, huongDan: null } : null);
  useEffect(() => {
    if (chosen && String(valueRef.current?.LoaiThuTuc ?? "").toLowerCase() !== chosen.procedureId)
      patch({ LoaiThuTuc: chosen.procedureId, TenLoaiThuTuc: chosen.procedureName });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen?.procedureId]);
  const pickDiem = (d: BookDiemDs | null) => {
    const cur = valueRef.current;
    const keepCode = !!d && !!cur?.MaLoaiThuTuc && d.thuTuc.some((t) => t.code === cur.MaLoaiThuTuc);
    const only = d && !keepCode && d.thuTuc.length === 1 ? d.thuTuc[0] : null;
    patch({
      MaCauHinh: d?.configId ?? null,
      DiemKy: d?.diemKyId ?? null,
      TenDiemKy: d?.ten ?? null,
      LoaiThuTuc: null,
      ...(keepCode ? {} : { MaLoaiThuTuc: only?.code ?? null, TenLoaiThuTuc: only?.name ?? null }),
      ...(String(cur?.MaCauHinh ?? "").toLowerCase() !== (d?.configId ?? "") ? { MaCa: null, TenCa: null } : {}),
    });
  };
  const canQuery = !!dateStr && !!pgc && !!procId && (!!chosen || !!value?.MaCa);
  const refreshSlots = useCallback(async () => {
    if (!canQuery) {
      setSlots([]);
      return;
    }
    const r = await SigningShiftConfigService.slotsByDate(dateStr, procId, pgc);
    if (aliveRef.current) setSlots(r);
  }, [canQuery, dateStr, procId, pgc]);
  useEffect(() => {
    refreshSlots();
    if (!canQuery) return;
    const unsub = SigningShiftConfigService.subscribeAppointments(refreshSlots);
    return () => unsub();
  }, [refreshSlots, canQuery]);
  const shiftOptions = useMemo(() => {
    const options = slots
      .filter((s) => s.remaining > 0 || value?.MaCa === s.id)
      .map((s) => ({ value: s.id, label: `${s.name} (${s.from}-${s.to}) — còn ${s.remaining}/${s.capacity}`, raw: s as ShiftSlot | undefined }));
    if (value?.MaCa && !options.some((o) => o.value === value.MaCa)) {
      options.unshift({ value: value.MaCa, label: value?.TenCa || "Ca đã chọn", raw: undefined });
    }
    return options;
  }, [slots, value?.MaCa, value?.TenCa]);
  const RANGE_DAYS = 14;
  const [dayAvail, setDayAvail] = useState<Record<string, number>>({});
  const quickDays = useMemo(() => Array.from({ length: RANGE_DAYS }, (_, i) => dayjs().startOf("day").add(i, "day")), []);
  const availArgs = pgc && code ? { pgcId: pgc, quyId: quy, thuTuc: code, configId: cfgId } : null;
  const availKey = availArgs ? JSON.stringify(availArgs) : "";
  const refreshDayAvail = useCallback(async () => {
    if (!availArgs) return setDayAvail({});
    const r = await SigningBookingService.availability({ ...availArgs, from: dayjs().format("YYYY-MM-DD"), days: RANGE_DAYS }).catch(() => ({}));
    if (aliveRef.current) setDayAvail(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availKey]);
  useEffect(() => {
    refreshDayAvail();
    const unsub = SigningShiftConfigService.subscribeAppointments(refreshDayAvail);
    return () => unsub();
  }, [refreshDayAvail]);
  const firstFreeDay = useMemo(() => quickDays.find((d) => (dayAvail[d.format("YYYY-MM-DD")] ?? 0) > 0), [quickDays, dayAvail]);
  const pickDate = useCallback(
    (d: dayjs.Dayjs) => {
      const base = value?.NgayBookKy ? dayjs(value.NgayBookKy) : dayjs();
      const next = d.hour(base.hour()).minute(base.minute()).second(0);
      onChange({ ...value, NgayBookKy: next, MaCa: null, TenCa: null });
    },
    [value, onChange]
  );
  const [showCalendar, setShowCalendar] = useState(false);
  const [monthAnchor, setMonthAnchor] = useState(() => dayjs().startOf("month"));
  const [monthAvail, setMonthAvail] = useState<Record<string, number>>({});
  useEffect(() => {
    if (dateStr) setMonthAnchor(dayjs(dateStr).startOf("month"));
  }, [dateStr]);
  useEffect(() => {
    if (!showCalendar || !availArgs) return;
    let alive = true;
    SigningBookingService.availability({ ...availArgs, from: monthAnchor.format("YYYY-MM-DD"), days: monthAnchor.daysInMonth() })
      .then((r) => alive && setMonthAvail(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCalendar, monthAnchor, availKey]);
  const monthGrid = useMemo(() => {
    const start = monthAnchor.startOf("month");
    const first = start.subtract((start.day() + 6) % 7, "day");
    return Array.from({ length: 42 }, (_, i) => first.add(i, "day"));
  }, [monthAnchor]);
  const pickShift = (id: any) => {
    const s = slots.find((x) => x.id === id);
    const next: any = { ...value, MaCa: id ?? null, TenCa: s ? `${s.name} (${s.from}-${s.to})` : null };
    if (s && value?.NgayBookKy) {
      const [h, m] = String(s.from || "").split(":");
      if (h !== undefined && m !== undefined) next.NgayBookKy = dayjs(value.NgayBookKy).hour(Number(h)).minute(Number(m)).second(0);
    }
    onChange(next);
  };
  const hoSo = useMemo(() => hoSoForPhanLoai(chosen?.hoSo ?? [], value?.MaPhanLoaiKH), [chosen, value?.MaPhanLoaiKH]);
  const hoSoKey = hoSo.map((h) => `${h.id}|${h.ghiChu ?? ""}`).join(",");
  useEffect(() => {
    if (!opt) return;
    const cur: { id: string; ghiChu?: string | null }[] | undefined = valueRef.current?.HoSoCanChuanBi;
    if (cur && cur.map((h) => `${h.id}|${h.ghiChu ?? ""}`).join(",") === hoSoKey) return;
    patch({ HoSoCanChuanBi: hoSo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoSoKey, opt]);
  const daTai = useMemo(() => {
    const ids = new Set<string>();
    (Array.isArray(value?.TaiLieu) ? value.TaiLieu : []).forEach((f: { hoSoId?: string }) => f?.hoSoId && ids.add(f.hoSoId));
    return ids;
  }, [value?.TaiLieu]);
  const tenThuTuc = opt?.thuTuc.find((t) => t.code === code)?.name ?? value?.TenLoaiThuTuc ?? null;
  const copyInfo = async () => {
    const text = buildAppointmentText({
      thuTuc: tenThuTuc,
      tenKH: value?.TenKH,
      maCan: value?.MaCan,
      ngay: dateStr ? dayjs(dateStr).format("DD/MM/YYYY") : null,
      ca: value?.TenCa,
      diem: chosen,
      hoSo,
    });
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Đã sao chép thông tin hẹn — dán gửi khách qua Zalo / SMS");
    } catch {
      toast.error("Trình duyệt chặn sao chép");
    }
  };
  const quyLech =
    opt?.quySuyId && quy && opt.quySuyId !== quy && opt.quyNguon && opt.quyNguon !== "MAC_DINH"
      ? { id: opt.quySuyId, ten: funds.find((f) => f.value === opt.quySuyId)?.label ?? "quỹ khác", nguon: NGUON_QUY[opt.quyNguon] ?? "" }
      : null;
  const thu = (d: dayjs.Dayjs) => (d.day() === 0 ? "CN" : `T${d.day() + 1}`);
  const todayKey = dayjs().format("YYYY-MM-DD");
  const hoSoDone = hoSo.filter((h) => daTai.has(h.id)).length;
  const ngayLabel = dateStr ? `${thu(dayjs(dateStr))}, ${dayjs(dateStr).format("DD/MM/YYYY")}` : null;
  return { fc, funds, setFunds, opt, setOpt, optErr, setOptErr, loading, setLoading, slots, setSlots, pgc, dateStr, code, quy, cfgId, aliveRef, valueRef, patch, diemDs, chosenDs, chosen, procId, place, pickDiem, canQuery, refreshSlots, shiftOptions, RANGE_DAYS, dayAvail, setDayAvail, quickDays, availArgs, availKey, refreshDayAvail, firstFreeDay, pickDate, showCalendar, setShowCalendar, monthAnchor, setMonthAnchor, monthAvail, setMonthAvail, monthGrid, pickShift, hoSo, hoSoKey, daTai, tenThuTuc, copyInfo, quyLech, thu, todayKey, hoSoDone, ngayLabel };
}
