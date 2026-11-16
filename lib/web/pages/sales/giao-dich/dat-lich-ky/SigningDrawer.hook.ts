// ⚠️ TỰ SINH — thân component SigningDrawer của web src/pages/sales/giao-dich/dat-lich-ky/SigningDrawer.tsx chép NGUYÊN VĂN thành hook (scripts/sync-web-pricing.cjs).
// Bỏ câu return JSX + 1 câu giao diện: 477. KHÔNG SỬA TAY.
// @ts-nocheck
/* eslint-disable */
import { useState, useEffect, useRef, useImperativeHandle } from "react";
import { type CustomerKind, type SelectOption, HINH_THUC_TT_FALLBACK, type SigningSource } from "./types";
import { useFieldConfig } from "../../../../hooks/useFieldConfig";
import useAgencySan from "../../../../hooks/useAgencySan";
import { SigningAppointmentCloudService } from "../../../../services/SigningAppointmentCloudService";
import { AgencyService } from "../../../../_shims/services/Agency";
import { SalesCatalogCloud } from "../../../../services/SalesCatalogCloud";
import { CatalogSettingsService } from "../../../../services/CatalogSettingsService";
import dayjs from "dayjs";
import { sourcePatch, sourceError } from "./signingSource";
import { mergeKhoHoSo, stripKhoFlag } from "./khoHoSo";
import { signingValues } from "./signingFieldValues";
import { DateHelper } from "../../../../utils/DateHelper";
import { SigningShiftConfigService } from "../../../../services/SigningShiftConfigService";
import { message } from "../../../../_shims/antdMessage";

export function useWebSigningForm({ onSaved, maDA }: any = {}, ref: any = null) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CustomerKind>("individual");
  const fieldCfg = useFieldConfig("signing");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<any>({});
  const [lockDeposit, setLockDeposit] = useState(false);
  const [sourceLocked, setSourceLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deposits, setDeposits] = useState<SelectOption[]>([]);
  const [agencies, setAgencies] = useState<SelectOption[]>([]);
  const { agencySan } = useAgencySan();
  useEffect(() => {
    if (!agencySan) return;
    setForm((prev: any) =>
      String(prev?.MaSan ?? "") === String(agencySan.id)
        ? prev
        : { ...prev, MaSan: agencySan.id }
    );
  }, [agencySan]);
  const [plans, setPlans] = useState<SelectOption[]>([]);
  const [phanLoaiKH, setPhanLoaiKH] = useState<SelectOption[]>([]);
  const [httt, setHttt] = useState<SelectOption[]>(HINH_THUC_TT_FALLBACK);
  const [loadingOpts, setLoadingOpts] = useState(false);
  const loadedRef = useRef(false);
  const [searchingDeposit, setSearchingDeposit] = useState(false);
  const depositSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapDeposit = (it: any): SelectOption => ({
    value: it.MaPGC,
    label: `${it.SoPhieu || "—"} | ${it.KhachHang || ""}${it.MaSanPham ? ` | ${it.MaSanPham}` : ""
      }`,
    raw: it,
  });
  const searchDeposits = (kw: string) => {
    if (depositSearchTimer.current) clearTimeout(depositSearchTimer.current);
    depositSearchTimer.current = setTimeout(async () => {
      setSearchingDeposit(true);
      try {
        const list = await SigningAppointmentCloudService.searchDeposits(
          kw,
          maDA ? String(maDA) : null
        );
        setDeposits(list.map(mapDeposit));
      } catch {
        // giữ danh sách cũ
      } finally {
        setSearchingDeposit(false);
      }
    }, 400);
  };
  const loadOptions = async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setLoadingOpts(true);
    try {
      const settled = await Promise.allSettled([
        SigningAppointmentCloudService.searchDeposits(
          "",
          maDA ? String(maDA) : null
        ),
        AgencyService.DaiLy.getList({
          InputSearch: "",
          State: null,
          PageIndex: 1,
          PageSize: 500,
        }),
        SalesCatalogCloud.getPhuongAnTT(),
        SalesCatalogCloud.getHTTT(),
        SalesCatalogCloud.getPhanLoaiKH(),
      ]);
      const pick = (i: number): any[] => {
        const r: any = settled[i];
        if (r?.status !== "fulfilled") return [];
        return Array.isArray(r.value) ? r.value : r.value?.data ?? [];
      };

      setDeposits(pick(0).map(mapDeposit));
      setAgencies(
        pick(1).map((it) => ({
          value: it.ID ?? it.MaCTVT,
          label: it.TenCTVT || it.TenCT || `#${it.MaCT}`,
          raw: it,
        }))
      );

      // Ưu tiên danh mục tự cấu hình trong Cài đặt danh mục
      const custom = await CatalogSettingsService.listActive(
        "phuong_an_tt_ky"
      ).catch(() => []);
      if (custom.length) {
        setPlans(
          custom.map((it) => ({
            value: it.code,
            label: it.name,
            raw: it,
          }))
        );
      } else {
        const list2 = pick(2);
        if (list2.length) {
          setPlans(
            list2.map((it: any) => ({
              // Mã lưu dạng chữ (cột ma_phuong_an_tt) ⇒ so khớp theo chuỗi
              value: String(it.MaPATT ?? it.ID ?? it.Ma),
              label: it.TenPATT ?? it.Ten ?? it.TenPhuongAn ?? `#${it.ID ?? ""}`,
              raw: it,
            }))
          );
        }
      }

      const list3 = pick(3);
      if (list3.length) {
        setHttt(
          list3.map((it: any) => ({
            value: it.ID ?? it.Ma,
            label: it.TenHinhThuc ?? it.Ten ?? it.Name,
            raw: it,
          }))
        );
      }

      const list4 = pick(4);
      if (list4.length) {
        setPhanLoaiKH(
          list4.map((it: any) => ({
            value: it.ID ?? it.MaPhanLoaiKH ?? it.Ma,
            label: it.Name ?? it.Ten ?? it.Name ?? `#${it.ID ?? ""}`,
            raw: it,
          }))
        );
      }
    } finally {
      setLoadingOpts(false);
    }
  };
  const loadDetail = async (id: number | string, fallback: Record<string, any>) => {
    try {
      const res: any = await SigningAppointmentCloudService.getById(id);
      const d = res?.data ?? res;
      if (d && typeof d === "object") return d;
    } catch (e) { }
    return fallback;
  };
  const mapDetailToForm = (d: any, k: CustomerKind) => {
    
    const base: any = {
      ...d,
      ID: d?.ID ?? null,
      MaPGC: d?.MaPGC ?? undefined,
      MaKH: d?.MaKH ?? undefined,
      MaSan: d?.MaSan ?? undefined,
      MaDA: d?.MaDA ?? maDA ?? undefined,
      MaCan: d?.MaCan ?? d?.KyHieu,
      MaSP: d?.MaSP ?? d?.MaSanPham ?? undefined,
      MaPhanLoaiKH: d?.MaPhanLoaiKH ?? (k === "enterprise" ? 3 : 1),
      MaPhuongAnTT: d?.MaPhuongAnTT ?? undefined,
      MaLichTT: d?.MaLichTT ?? null,
      TenLichTT: d?.TenLichTT ?? null,
      LaChuyenKhoan: d?.LaChuyenKhoan ?? undefined,
      CoBaoLanh: d?.CoBaoLanh ?? undefined,
      MaCa: d?.MaCa ?? undefined,
      TenCa: d?.TenCa ?? undefined,
      LoaiThuTuc: d?.LoaiThuTuc ?? undefined,
      TenLoaiThuTuc: d?.TenLoaiThuTuc ?? undefined,
      GhiChu: d?.GhiChu ?? "",
      NgayBookKy: d?.NgayBookKy ? dayjs(d.NgayBookKy) : undefined,
      DongSoHuu: Array.isArray(d?.DongSoHuu) ? d.DongSoHuu : [],
    };

    if (k === "enterprise") {
      Object.assign(base, {
        TenKH: d?.TenCongTy ?? d?.TenKH,
        SoDKKD: d?.SoDKKD,
        DkkdNgayCap: d?.NgayCapDKKD ? dayjs(d.NgayCapDKKD) : undefined,
        DkkdNoiCap: d?.NoiCapDKKD,
        TruSo: d?.TruSo,
        MST: d?.MaSoThue ?? d?.MaSoThueCT,
        DienThoai: d?.DienThoaiCongTy ?? d?.DienThoaiCT ?? d?.DienThoai,
        Email: d?.EmailCongTy ?? d?.EmailCT ?? d?.Email,
        NguoiDaiDien: d?.NguoiDaiDien,
        ChucVu: d?.ChucVu,
        NgaySinh: d?.NgaySinhNguoiDaiDien
          ? dayjs(d.NgaySinhNguoiDaiDien)
          : undefined,
        SoCMND: d?.CCCDNguoiDaiDien ?? d?.SoCCCD ?? d?.SoCMND,
        NgayCap: d?.NgayCapCCCDNguoiDaiDien
          ? dayjs(d.NgayCapCCCDNguoiDaiDien)
          : undefined,
        NoiCap: d?.NoiCapCCCDNguoiDaiDien,
        DiaChiTT: d?.ThuongTruNguoiDaiDien,
        DiaChiLH: d?.DiaChiLienHeNguoiDaiDien,
      });
    } else {
      Object.assign(base, {
        TenKH: d?.TenKH ?? d?.KhachHang,
        NgaySinh: d?.NgaySinh ? dayjs(d.NgaySinh) : undefined,
        DiaChiTT: d?.ThuongTru ?? d?.DiaChiTT,
        DiaChiLH: d?.DiaChiLienHe ?? d?.DiaChiLH,
        Email: d?.Email,
        DienThoai: d?.DienThoai ?? d?.DiDong,
        SoCMND: d?.SoCCCD ?? d?.SoCMND ?? d?.CCCD,
        NgayCap: d?.NgayCapCCCD ? dayjs(d.NgayCapCCCD) : undefined,
        NoiCap: d?.NoiCapCCCD ?? d?.NoiCap,
        MST: d?.MaSoThue,
      });
    }

    // Chuẩn hóa danh sách đồng sở hữu cũ -> danh sách chọn từ danh mục khách hàng
    base.CoOwners = (Array.isArray(d?.DongSoHuu) ? d.DongSoHuu : []).map(
      (x: any, i: number) => ({
        id: String(x?.ID ?? x?.MaKH ?? `dsh-${i}`),
        SourceID: x?.ID ?? null,
        IsPersonal: true,
        MaKH: x?.MaKH ?? null,
        TenKH: x?.TenKH || "",
        NgaySinh: x?.NgaySinh || null,
        ThuongTru: x?.ThuongTru || "",
        DiaChi: x?.DiaChiLienHe || "",
        Email: x?.Email || "",
        DiDong: x?.DienThoai || "",
        SoCMND: x?.SoCCCD || "",
        NgayCap: x?.NgayCapCCCD || null,
        NoiCap: x?.NoiCapCCCD || "",
        MaSoThueCT: x?.MaSoThue || "",
      })
    );
    return base;
  };
  useImperativeHandle(ref, () => ({
    open: async (k, row, prefill, source) => {
      setKind(k);
      setEditingId(row?.ID ?? null);
      // Mở từ phiếu đặt cọc cũ (chỉ truyền MaPGC) ⇒ coi như nguồn Đặt cọc
      const src: SigningSource | undefined =
        source ?? ((prefill as any)?.MaPGC && !row?.ID ? { kind: "DAT_COC", pgcId: String((prefill as any).MaPGC) } : undefined);
      setLockDeposit(!!row?.ID || !!src);
      setOpen(true);
      loadOptions();

      if (row?.ID) {
        const raw: any = row.raw || {};
        const keep = { Nguon: raw.Nguon ?? row.Nguon ?? null, HopDongId: raw.HopDongId ?? row.HopDongId ?? null, SoHopDong: raw.SoHopDong ?? row.SoHopDong ?? null };
        setSourceLocked(!!keep.Nguon);
        setForm({ ...mapDetailToForm(row.raw, k), ...keep });
        const d = await loadDetail(row.raw?.UID ?? row.ID, row.raw);
        setForm({ ...mapDetailToForm(d, k), ...keep, ...(prefill || {}) });
      } else {
        setSourceLocked(!!src);
        setForm({
          MaPhanLoaiKH: k === "enterprise" ? 3 : 1,
          MaDA: maDA ?? undefined,
          ...(prefill || {}),
          ...(src ? sourcePatch(src) : { Nguon: null, HopDongId: null }),
        });
        // Dùng thẳng dữ liệu từ lưới, không gọi thêm dịch vụ
        const p: any = prefill || {};
        if (p.MaPGC) {
          const opt = mapDeposit({
            MaPGC: p.MaPGC,
            SoPhieu: p.SoPhieu || p.MaPGC,
            KhachHang: p.TenKH,
            MaSanPham: p.MaCan,
            MaSP: p.MaSP,
            MaKH: p.MaKH,
            MaDA: p.MaDA,
            MaSan: p.MaSan,
          });
          setDeposits((prev) =>
            prev.some((d) => d.value === p.MaPGC) ? prev : [opt, ...prev]
          );
        }
      }
    },
  }));
  const toCoOwnerList = (raw: any) =>
    (Array.isArray(raw?.CoOwners) ? raw.CoOwners : []).map(
      (x: any, i: number) => ({
        id: String(x?.MaKH ?? `dsh-${i}`),
        IsPersonal: x?.IsPersonal !== false,
        MaKH: x?.MaKH ?? null,
        TenKH: x?.TenKH || "",
        SoCMND: x?.SoCMND || "",
        NgayCap: x?.NgayCap || null,
        NoiCap: x?.NoiCap || "",
        NgaySinh: x?.NgaySinh || null,
        DiDong: x?.DiDong || "",
        Email: x?.Email || "",
        ThuongTru: x?.ThuongTru || "",
        DiaChi: x?.DiaChi || "",
        TenCongTy: x?.TenCongTy || "",
        MaSoThueCT: x?.MaSoThueCT || "",
        DienThoaiCT: x?.DienThoaiCT || "",
        EmailCT: x?.EmailCT || "",
      })
    );
  const phanLoaiFromDeposit = (raw: any, coOwnersLen: number) =>
    coOwnersLen > 0 ? 2 : raw?.IsPersonal === false ? 3 : 1;
  const ensureAgencyOption = (raw: any) => {
    if (!raw?.MaSan) return;
    setAgencies((prev) =>
      prev.some((a) => String(a.value) === String(raw.MaSan))
        ? prev
        : [{ value: raw.MaSan, label: raw.TenSan || "Đại lý" }, ...prev]
    );
  };
  const applyDepositRaw = (val: any, raw: any) => {
    ensureAgencyOption(raw);
    const coOwners = toCoOwnerList(raw);
    setForm((prev: any) => ({
      ...prev,
      MaPGC: val,
      MaKH: raw.MaKH ?? prev.MaKH,
      SoPhieu: raw.SoPhieu,
      MaDA: raw.MaDA ?? prev.MaDA,
      MaSP: raw.MaSP ?? prev.MaSP,
      MaCan: raw.MaSanPham || prev.MaCan,
      TenKH: raw.KhachHang || prev.TenKH,
      // Đại lý phụ trách luôn lấy theo phiếu đặt cọc (trừ tài khoản đại lý)
      MaSan: agencySan?.id ?? raw.MaSan ?? prev.MaSan,
      CoOwners: coOwners,
      MaPhanLoaiKH: phanLoaiFromDeposit(raw, coOwners.length),
      // Lịch thanh toán của giao dịch (DK28–DK29): có ⇒ ô Phương án thanh toán khoá
      MaLichTT: raw.MaLichTT ?? null,
      TenLichTT: raw.TenLichTT ?? null,
      // Đổi sang giao dịch khác ⇒ bỏ hồ sơ thừa hưởng của giao dịch cũ (kho giao dịch mới nạp ở effect bên dưới)
      TaiLieu: String(prev?.MaPGC ?? "") === String(val ?? "") ? prev?.TaiLieu : mergeKhoHoSo(prev?.TaiLieu, []),
    }));
  };
  const handlePickDeposit = async (val: any) => {
    const opt = deposits.find((d) => d.value === val);
    const raw = opt?.raw;
    if (!raw) {
      setForm((prev: any) => ({
        ...prev,
        MaPGC: val ?? undefined,
        MaKH: undefined,
        CoOwners: [],
        MaLichTT: null,
        TenLichTT: null,
        // Bỏ chọn giao dịch ⇒ bỏ hồ sơ thừa hưởng từ giao dịch cũ
        TaiLieu: mergeKhoHoSo(prev?.TaiLieu, []),
      }));
      return;
    }
    // Dòng rút gọn sẽ được effect bên dưới lấy lại đầy đủ từ máy chủ.
    applyDepositRaw(val, raw);
  };
  const patchForm = (patch: Record<string, any>) =>
    setForm((prev: any) => ({ ...prev, ...patch }));
  useEffect(() => {
    const cur = form?.MaPGC;
    if (!open || !cur) return;
    let alive = true;
    (async () => {
      const raw = await SigningAppointmentCloudService.getDepositById(
        String(cur)
      ).catch(() => null);
      if (!alive || !raw) return;
      setDeposits((prev) =>
        prev.some((d) => d.value === raw.MaPGC)
          ? prev.map((d) => (d.value === raw.MaPGC ? mapDeposit(raw) : d))
          : [mapDeposit(raw), ...prev]
      );
      // Thêm mới từ phiếu đặt cọc: lấy đúng dữ liệu máy chủ (loại KH, đại lý) + thừa hưởng hồ sơ đã nộp của giao dịch (DK31–DK35)
      if (!editingId) {
        applyDepositRaw(cur, raw);
        setForm((prev) =>
          String(prev?.MaPGC ?? "") === String(cur)
            ? { ...prev, TaiLieu: mergeKhoHoSo(prev?.TaiLieu, raw.HoSoGiaoDich) }
            : prev
        );
        return;
      }
      ensureAgencyOption(raw);
      const coOwners = toCoOwnerList(raw);
      setForm((prev: any) => ({
        ...prev,
        SoPhieu: prev?.SoPhieu ?? raw.SoPhieu,
        MaCan: prev?.MaCan ?? raw.MaSanPham ?? undefined,
        MaSP: prev?.MaSP ?? raw.MaSP ?? undefined,
        MaKH: prev?.MaKH ?? raw.MaKH ?? undefined,
        MaDA: prev?.MaDA ?? raw.MaDA ?? undefined,
        MaSan: agencySan?.id ?? prev?.MaSan ?? raw.MaSan ?? undefined,
        CoOwners:
          Array.isArray(prev?.CoOwners) && prev.CoOwners.length
            ? prev.CoOwners
            : coOwners,
        MaPhanLoaiKH: coOwners.length
          ? 2
          : prev?.MaPhanLoaiKH ?? phanLoaiFromDeposit(raw, 0),
        // Sửa lịch: lịch thanh toán luôn theo giao dịch hiện tại
        MaLichTT: raw.MaLichTT ?? null,
        TenLichTT: raw.TenLichTT ?? null,
      }));
    })();
    return () => {
      alive = false;
    };
  }, [open, form?.MaPGC, editingId]);
  const submit = async () => {
    // Bắt buộc nhập theo cấu hình "Bắt buộc nhập / ẩn hiện trường" (MaCa, LoaiThuTuc luôn bắt buộc)
    // Đã chọn loại thủ tục thì phải chọn điểm ký (thủ tục lưu là thủ tục của điểm) — lịch cũ giữ nguyên ca thì bỏ qua
    if (form.MaLoaiThuTuc && !form.MaCauHinh && !(editingId && form.MaCa))
      return message.warning("Chọn điểm ký cho lịch hẹn");
    const srcErr = sourceError(form);
    if (srcErr) return message.warning(srcErr);
    const req = await fieldCfg.validate(signingValues(form, kind));
    if (!req.ok) return message.warning(req.message);

    const isPersonal = kind === "individual";
    const dt = (v: any) => (v ? DateHelper.ToApiDateTime(v) : null);

    // Kiểm tra lại chỗ trống của ca ngay trước khi lưu (tránh trùng chỗ)
    if (form.MaCa) {
      const remain = await SigningShiftConfigService.remainingForShift(
        dayjs(form.NgayBookKy).format("YYYY-MM-DD"),
        String(form.MaCa),
        form.MaPGC ?? null,
        form.LoaiThuTuc ?? null
      );
      if (remain !== null && remain <= 0) {
        message.error(
          `Ca "${form.TenCa || form.MaCa}" vừa hết chỗ. Vui lòng chọn ca khác.`
        );
        setForm((p: any) => ({ ...p, MaCa: null, TenCa: null }));
        return;
      }
    }

    // Khách hàng đồng đứng tên: chỉ lưu uuid khách hàng
    const coOwners: any[] = Array.isArray(form.CoOwners) ? form.CoOwners : [];
    const dongSoHuuIds =
      isPersonal && form.MaPhanLoaiKH === 2
        ? coOwners.map((c: any) => c?.MaKH).filter(Boolean)
        : [];

    const payload: any = {
      ID: editingId,
      MaDA: form.MaDA ?? maDA ?? null,
      MaPGC: form.MaPGC ?? null,
      MaSP: form.MaSP ?? null,
      MaKH: form.MaKH ?? null,
      NgayBookKy: DateHelper.ToApiDateTime(form.NgayBookKy),
      LoaiThuTuc: form.LoaiThuTuc ?? null,
      MaCa: form.MaCa ?? null,
      MaPhanLoaiKH: form.MaPhanLoaiKH ?? (isPersonal ? 1 : 3),
      MaPhuongAnTT: form.MaPhuongAnTT ?? null,
      MaLichTT: form.MaLichTT ?? null,
      LaChuyenKhoan:
        form.LaChuyenKhoan === true || form.LaChuyenKhoan === false
          ? form.LaChuyenKhoan
          : null,
      CoBaoLanh:
        form.CoBaoLanh === true || form.CoBaoLanh === false
          ? form.CoBaoLanh
          : null,
      MaSan: agencySan?.id ?? form.MaSan ?? null,
      GhiChu: form.GhiChu ?? "",
      IsPersonal: isPersonal,
      DongSoHuuIds: dongSoHuuIds,
      TaiLieu: stripKhoFlag(form.TaiLieu),
      Nguon: form.Nguon ?? null,
      HopDongId: form.Nguon === "HOP_DONG" ? form.HopDongId ?? null : null,
    };

    setSaving(true);
    try {
      const res: any = await SigningAppointmentCloudService.upcert(payload);
      if (res?.status === 2000) {
        message.success(editingId ? "Đã cập nhật lịch ký" : "Đã thêm lịch ký");
        setOpen(false);
        onSaved?.(res?.data?.row ?? null, !!editingId);
      } else {
        message.error(res?.message || "Không lưu được lịch ký");
      }
    } finally {
      setSaving(false);
    }
  };
  return { open, setOpen, kind, setKind, fieldCfg, editingId, setEditingId, form, setForm, lockDeposit, setLockDeposit, sourceLocked, setSourceLocked, saving, setSaving, deposits, setDeposits, agencies, setAgencies, agencySan, plans, setPlans, phanLoaiKH, setPhanLoaiKH, httt, setHttt, loadingOpts, setLoadingOpts, loadedRef, searchingDeposit, setSearchingDeposit, depositSearchTimer, mapDeposit, searchDeposits, loadOptions, loadDetail, mapDetailToForm, toCoOwnerList, phanLoaiFromDeposit, ensureAgencyOption, applyDepositRaw, handlePickDeposit, patchForm, submit };
}
