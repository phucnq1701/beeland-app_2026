// ⚠️ TỰ SINH — thân component BookingFormDialog của web src/components/Products/BookingFormDialog.tsx chép NGUYÊN VĂN thành hook (scripts/sync-web-pricing.cjs).
// Bỏ câu return JSX + 1 câu giao diện: 1339. KHÔNG SỬA TAY.
// @ts-nocheck
/* eslint-disable */
import { useExceptionAllowIds } from "../Sales/salesConfig/useExceptionAllowIds";
import { firstUuid } from "../Sales/salesConfig/unitFundPriceList";
import { useState, useEffect, useRef } from "react";
import useAgencySan from "../../hooks/useAgencySan";
import { useSalesCompanyControl, useAutoSalesCompany } from "../shared/salesCompanyControl";
import { filterAgenciesBySalesCompany, agencyToClear } from "../shared/agencyBySalesCompany";
import { toast } from "../../_shims/sonner";
import { shouldClearAgency, bookingScheduleFields, editScheduleFields, canSubmitBooking } from "./bookingFormRules";
import { type SalesConfigKind } from "../../_stubs/components/Sales/salesConfig/SalesConfigPreviewModal";
import { isLowRiseProduct } from "../../utils/productType";
import { useSalesConfigOptions } from "../Sales/salesConfig/useSalesConfigOptions";
import { pickPriceListForPolicy } from "../Sales/salesConfig/policyScope";
import { useUnitFundPriceList } from "../Sales/salesConfig/useUnitFundPriceList";
import { sessionCompanyId } from "../../_shims/lib/session";
import { supabase } from "../../_shims/integrations/supabase/client";
import { type CustomerFormModalHandle } from "../../_stubs/pages/customers/quan-ly/khach-hang/types";
import { ProductService } from "../../_shims/services/Product";
import { normalizeSanGiaoDichList } from "../../services/SanGiaoDichCloudService";
import { generateCodePreview } from "../../utils/codePattern";
import { AgencyService } from "../../_stubs/services/Agency";
import { CustomerService } from "../../_shims/services/Customer";
import { stampOwner } from "../../services/DataScopeService";
import { tenant } from "../../services/CloudMirror";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const mapPriceListItem = (row: any) => {
  if (!row) return null;
  const num = (v: any) => (v == null || v === "" ? 0 : Number(v));
  const area = num(row.area);
  const unitPrice = num(row.unit_price);
  const vatRate = num(row.vat_rate);
  const pbtRate = num(row.maintenance_rate);
  const beforeVat = row.total_before_vat != null ? num(row.total_before_vat) : area * unitPrice;
  const vatAmount = row.vat_amount != null ? num(row.vat_amount) : (beforeVat * vatRate) / 100;
  const afterVat =
    row.total_after_vat != null ? num(row.total_after_vat) : beforeVat + vatAmount;
  const pbt =
    row.maintenance_amount != null ? num(row.maintenance_amount) : (afterVat * pbtRate) / 100;
  const totalPayment =
    row.total_payment != null ? num(row.total_payment) : afterVat + pbt;
  const landTotal =
    row.land_total != null ? num(row.land_total) : area * num(row.land_unit_price);
  const constructionAmount =
    row.construction_amount != null
      ? num(row.construction_amount)
      : num(row.area_xd) * num(row.construction_unit_price);

  return {
    raw: row,
    DTThongThuy: area,
    DonGiaVAT: unitPrice ? unitPrice * (1 + vatRate / 100) : 0,
    TongGiaChuaVAT: beforeVat,
    vatchtien: vatAmount,
    TongGiaGomVAT: afterVat,
    PhiBaoTri: pbt,
    TongGiaGomPBT: totalPayment,
    DienTichDat: area,
    DonGiaDat: num(row.land_unit_price),
    TongGiaDat: landTotal,
    DienTichXD: num(row.area_xd),
    DonGiaXD: num(row.construction_unit_price),
    ThanhTienXD: constructionAmount,
    GiaTriHD: row.contract_total_value != null ? num(row.contract_total_value) : totalPayment,
    GiaNaked: row.naked_price == null || row.naked_price === "" ? null : Number(row.naked_price),
  };
};

interface CustomerOpt {
  value: number | string;
  label: string;
  tenKH?: string;
  soCMND?: string;
  diDong?: string;
  email?: string;
  diaChi?: string;
  maKH?: number | string;
  maCT?: number | string;
  /** Mã khách hàng dạng ngắn (MaSoKH) để hiển thị thay uuid */
  maSoKH?: string;
}

export function useWebBookingForm({
  open,
  onOpenChange,
  product,
  onSuccess,
  embedded = false,
  editMaPGC = null,
  unitFundPreset,
}: any = {}) {
  const isEditMode = !!editMaPGC;
  const exceptionIds = useExceptionAllowIds(firstUuid(editMaPGC));
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<any>({});
  const [bookingCode, setBookingCode] = useState<string>("");
  const [listSan, setListSan] = useState<any[]>([]);
  const [maSan, setMaSan] = useState<string>("");
  const { agencySan } = useAgencySan();
  useEffect(() => {
    if (agencySan) setMaSan(String(agencySan.id));
  }, [agencySan]);
  const [isPriority, setIsPriority] = useState<boolean>(false);
  const [congTyBanHangId, setCongTyBanHangId] = useState<string | null>(null);
  const [congTyBanHangTen, setCongTyBanHangTen] = useState<string | null>(null);
  const {
    options: salesCompanyOptions,
    nameOf: nameOfCongTyBanHang,
    disabled: salesCompanyLocked,
    required: salesCompanyRequired,
    autoId: salesCompanyAutoId,
    agenciesOf,
  } = useSalesCompanyControl(congTyBanHangId, congTyBanHangTen);
  useAutoSalesCompany(salesCompanyAutoId, congTyBanHangId, setCongTyBanHangId, !!open);
  const agencyLocked = embedded || !!agencySan;
  const agencyOptions = agencyLocked ? listSan : filterAgenciesBySalesCompany(listSan, agenciesOf, congTyBanHangId);
  const handleChangeCongTyBanHang = (next: string | null) => {
    if (!agencyLocked && agencyToClear(maSan, next, agenciesOf)) {
      const ten = listSan.find((s) => String(s.ID).toLowerCase() === maSan.toLowerCase())?.TenCT ?? maSan;
      setMaSan("");
      toast.info(`Đã bỏ đại lý "${ten}" vì không thuộc công ty bán hàng đã chọn`);
    }
    setCongTyBanHangId(next);
  };
  const savedEditRef = useRef<{ ctbhId: string | null; policyId: string | null }>({ ctbhId: null, policyId: null });
  useEffect(() => {
    if (!open || agencyLocked) return;
    if (!shouldClearAgency({ isEditMode, savedCtbhId: savedEditRef.current.ctbhId, ctbhId: congTyBanHangId, maSan, agenciesOf })) return;
    if (isEditMode) {
      const ten = listSan.find((s) => String(s.ID).toLowerCase() === maSan.toLowerCase())?.TenCT ?? maSan;
      toast.info(`Đã bỏ đại lý "${ten}" vì không thuộc công ty bán hàng của phiếu`);
    }
    setMaSan("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEditMode, agencyLocked, maSan, congTyBanHangId, agenciesOf]);
  const [priceListId, setPriceListId] = useState<string | undefined>();
  const [pricingConfigId, setPricingConfigId] = useState<string | undefined>();
  const [policyId, setPolicyId] = useState<string | undefined>();
  const [promotionIds, setPromotionIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<{
    kind: SalesConfigKind;
    id?: any;
    ids?: any[];
    subTitle?: string;
  } | null>(null);
  const isLowRise = isLowRiseProduct({ product: data, maSP: data?.KyHieu });
  const productUuid = firstUuid(data?.id, data?.Id, data?.ID, data?.SanPhamId, data?.MaSP);
  const salesConfig = useSalesConfigOptions({ open, maDA: data?.MaDA, isLow: isLowRise, savedPolicyId: policyId, productId: productUuid });
  useEffect(() => {
    if (!open) {
      setPriceListId(undefined);
      setPricingConfigId(undefined);
      setPolicyId(undefined);
      setPromotionIds([]);
      setCongTyBanHangId(null);
      setCongTyBanHangTen(null);
      savedEditRef.current = { ctbhId: null, policyId: null };
      setPreview(null);
      setEditTienGiuCho(null);
    }
  }, [open]);
  const handleSelectPolicy = (v?: string) => {
    setPolicyId(v);
    if (!v) return;
    const raw = salesConfig.policies.find((o) => o.value === v)?.raw as any;
    // Bảng giá chọn sau chính sách (manual 121): bảng giá đang chọn không thuộc danh sách của chính sách ⇒ chuyển sang bảng giá đầu tiên có căn
    const nextPriceList = pickPriceListForPolicy(unitFundRows(), quyCanRef.current, raw, priceListId);
    if (nextPriceList !== undefined) setPriceListId(nextPriceList ?? undefined);
    const cauHinh =
      raw?.MaCauHinhTinhGia ?? raw?.CauHinhId ?? raw?.pricing_config_id ?? null;
    // Tiến độ thanh toán không còn trên form Booking (spec booking-ctbh-dai-ly D6): phiếu Cọc tự lấy theo chính sách
    if (cauHinh) setPricingConfigId(String(cauHinh));
  };
  const policyTienBooking = (() => {
    const raw = salesConfig.policies.find((o) => o.value === policyId)
      ?.raw as any;
    const v = Number(raw?.TienBooking ?? raw?.tien_booking ?? 0);
    return v > 0 ? v : null;
  })();
  const [priceInfo, setPriceInfo] = useState<any>(null);
  const [loadingPriceInfo, setLoadingPriceInfo] = useState(false);
  const quyCanRef = useRef<string | null>(null);
  const changePriceList = (id?: string) => setPriceListId(id);
  const unitFundRows = () =>
    salesConfig.priceLists.map((o) => ({ id: o.value, label: o.label, ma_quy_can: o.raw?.ma_quy_can, has_product: o.raw?.has_product }));
  const unitFund = useUnitFundPriceList({
    open,
    isNewDoc: !isEditMode,
    priceLists: salesConfig.loading ? null : unitFundRows(),
    selectedPriceListId: priceListId,
    onPick: (id) => changePriceList(id ?? undefined),
    // Booking: khóa theo quỹ căn của lưới (mặc định Quỹ CĐT), không cho sửa
    locked: true,
    preset: unitFundPreset,
  });
  quyCanRef.current = unitFund.quyCanId;
  useEffect(() => {
    if (!open || !priceListId) {
      setPriceInfo(null);
      return;
    }
    let alive = true;
    (async () => {
      setLoadingPriceInfo(true);
      try {
        const productId = String(data?.id ?? data?.Id ?? "");
        const tenantUid = sessionCompanyId() || "";
        if (UUID_RE.test(productId) && tenantUid) {
          const { data: rows, error } = await (supabase as any).rpc(
            "fn_get_price_list_item_by_product",
            {
              p_price_list_id: priceListId,
              p_product_id: productId,
              p_ma_ctdk_uid: tenantUid,
            }
          );
          if (error) throw error;
          if (alive) setPriceInfo(mapPriceListItem(rows?.[0] ?? null));
          return;
        }
        // Giá lấy qua hàm fn_get_price_list_item_by_product — không gọi trực
        // tiếp bảng price_list_items nữa; sản phẩm chưa chuẩn uuid thì bỏ qua.
        if (alive) setPriceInfo(null);
      } catch (e) {
        console.error("Load giá theo bảng giá failed", e);
        if (alive) setPriceInfo(null);
      } finally {
        if (alive) setLoadingPriceInfo(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, priceListId, data?.MaSP, data?.id]);
  const priceInfoItems = (() => {
    const numFmt = (v: any) =>
      v == null || v === "" || Number.isNaN(Number(v))
        ? "—"
        : Number(v).toLocaleString("vi-VN");
    const bg = priceInfo || {};
    // Khi hàm fn_get_price_list_item_by_product không có dữ liệu (hoặc lỗi),
    // thông tin bảng giá rơi về thông tin gốc của sản phẩm.
    const pickFirst = (...vals: any[]) =>
      vals.find((v) => v != null && v !== "" && !Number.isNaN(Number(v)));
    if (isLowRise) {
      return [
        { label: "Diện tích đất", value: numFmt(pickFirst(bg.DienTichDat, data?.DienTichDat)) },
        { label: "Đơn giá đất", value: numFmt(pickFirst(bg.DonGiaDat, data?.DonGiaDat, data?.DGDatPB)) },
        { label: "Tổng giá đất", value: numFmt(pickFirst(bg.TongGiaDat, data?.TongGiaDat, data?.TienDat)) },
        { label: "Diện tích XD", value: numFmt(pickFirst(bg.DienTichXD, data?.DienTichXD)) },
        { label: "Đơn giá XD", value: numFmt(pickFirst(bg.DonGiaXD, data?.DonGiaXayDung, data?.DonGiaXD)) },
        {
          label: "Tổng giá gồm VAT",
          value: numFmt(pickFirst(bg.TongGiaGomVAT, data?.TongGiaGomVAT)),
        },
      ];
    }
    return [
      {
        label: "Diện tích thông thủy",
        value: numFmt(pickFirst(bg.DTThongThuy, data?.DienTichThongThuy, data?.DTThongThuy, data?.DTTimTuong)),
      },
      {
        label: "Đơn giá gồm VAT",
        value: numFmt(pickFirst(bg.DonGiaVAT, data?.DGGomVAT, data?.DonGiaThongThuy, data?.DonGiaDaVAT)),
      },
      {
        label: "Tổng giá chưa VAT",
        value: numFmt(pickFirst(bg.TongGiaChuaVAT, data?.TongGiaChuaVAT)),
      },
      { label: "Giá Naked", value: numFmt(isEditMode ? data?.GiaNaked : pickFirst(bg.GiaNaked, data?.GiaNaked)) },
      { label: "Tiền VAT", value: numFmt(pickFirst(bg.vatchtien, data?.TienVAT, data?.vatchtien)) },
      {
        label: "Phí bảo trì",
        value: numFmt(pickFirst(bg.PhiBaoTri, data?.TienPhiBaoTri, data?.TienPBT, data?.PhiBaoTri)),
      },
      {
        label: "Tổng giá gồm PBT",
        value: numFmt(pickFirst(bg.TongGiaGomPBT, data?.TongGiaGomPBT, data?.TongGiaTriHDMB, data?.TongThanhToan)),
      },
    ];
  })();
  const salesConfigPayload = () => {
    // Booking không lưu Tiến độ thanh toán (D6)
    const tdtt = bookingScheduleFields();
    const khuyenMai = promotionIds
      .map((id) => salesConfig.promotions.find((o) => o.value === id)?.raw)
      .filter(Boolean)
      .map((km: any) => ({
        ID: km.ID,
        MaKM: km.ID,
        TenKhuyenMai: km.TenKhuyenMai ?? "",
        TenQuaTang: km.TenQuaTang ?? "",
        SoLuong: Number(km.SoLuong ?? 0),
        GiaTri: Number(km.GiaTri ?? 0),
      }));
    const lichThanhToan = tdtt.LichThanhToan;

    return {
      MaDotGia: priceListId ?? null,
      MaCS: policyId ?? null,
      MaCSTong: pricingConfigId ?? null,
      MaTDTT: tdtt.MaTDTT,
      Payload: {
        TTHopDong: {
          MaDA: data?.MaDA,
          MaSP: data?.MaSP,
          MaCan: data?.KyHieu,
          MaDotGia: priceListId ?? null,
          MaQuyCan: unitFund.quyCanId,
          MaCS: policyId ?? null,
          MaCSTong: pricingConfigId ?? null,
          MaTDTT: tdtt.MaTDTT,
          CongTyBanHangId: congTyBanHangId || null,
          TenCongTyBanHang: congTyBanHangId ? nameOfCongTyBanHang(congTyBanHangId) : null,
          TenLichThanhToan: tdtt.TenLichThanhToan,
        },
        LichThanhToan: lichThanhToan,
        KhuyenMai: khuyenMai,
      },
      LichThanhToan: lichThanhToan,
      KhuyenMai: khuyenMai,
    };
  };
  const emptyForm = {
    MaKH: 0 as number | string,
    TenKH: "",
    SoCMND: "",
    NgaySinh: null as Date | null,
    NgayCap: null as Date | null,
    NoiCap: "",
    DiDong: "",
    DiDong2: "",
    Email: "",
    Email2: "",
    DiaChi: "",
    ThuongTru: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<CustomerOpt[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOpt | null>(
    null
  );
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customerFormRef = useRef<CustomerFormModalHandle>(null);
  const [projectHoldMinutes, setProjectHoldMinutes] = useState<number | null>(
    null
  );
  const [projectBookingAmount, setProjectBookingAmount] = useState<
    number | null
  >(null);
  const [editTienGiuCho, setEditTienGiuCho] = useState<number | null>(null);
  console.log(product, "product");
  useEffect(() => {
    if (!open) return;
    if (!product && !editMaPGC) return;
    const MaSP = product?.MaSP ?? product?.id;
    if (!editMaPGC && !MaSP) return;

    (async () => {
      setLoading(true);
      try {
        // Chế độ sửa: nạp booking + phiếu giữ chỗ + sản phẩm từ Cloud theo mã phiếu
        let editDetail: any = null;
        if (isEditMode && editMaPGC) {
          const { getBookingEditDetail } = await import("../../services/BookingDocsCloudService");
          editDetail = await getBookingEditDetail(String(editMaPGC));
          if (!editDetail) {
            toast.error("Không tải được dữ liệu booking");
            setLoading(false);
            return;
          }
        }
        // Dùng trực tiếp dữ liệu sản phẩm từ lưới (đã đủ mã dự án và thông tin liên quan)
        const merged = isEditMode
          ? { ...(editDetail?.product ?? {}) }
          : { ...product };
        setData(merged);

        // Cấu hình bán hàng hiệu lực (theo dự án + khoảng ngày) quyết định
        // booking ưu tiên và thời gian giữ chỗ.
        try {
          const { resolveProductUid, resolveProjectUidByProduct } = await import("../../services/salesDocsCloud");
          // Dự án lấy theo đúng UUID sản phẩm (bds_products.ma_da); chỉ khi thiếu
          // UUID mới dò theo mã/ký hiệu (ký hiệu có thể trùng giữa các dự án).
          const directId = [merged?.id, merged?.Id, merged?.ID, merged?.SanPhamId, merged?.MaSP]
            .map((x) => (x == null ? "" : String(x)))
            .find((x) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(x));
          const spUid =
            directId ??
            (await resolveProductUid({
              maSP: merged?.MaSP ?? merged?.id,
              kyHieu: merged?.KyHieu,
            }));
          const maDA =
            (await resolveProjectUidByProduct(spUid)) ??
            merged?.MaDA ??
            merged?.maDA ??
            product?.MaDA;
          if (maDA) {
            setData((d: any) => ({ ...(d || {}), MaDA: maDA }));
            merged.MaDA = maDA;
          }
          const { SalesSettingsService } = await import("../../services/SalesSettingsService");
          const setting = await SalesSettingsService.resolve(maDA, new Date());
          const tg = setting?.thoi_gian_booking;
          setProjectHoldMinutes(
            tg !== undefined && tg !== null && Number(tg) > 0 ? Number(tg) : null
          );
          const tien =
            Number(setting?.tien_booking) || Number(setting?.tien_dat_coc) || 0;
          setProjectBookingAmount(tien > 0 ? tien : null);
        } catch (e) {
          console.error("Load cài đặt bán hàng cho booking failed", e);
        }

        // Danh sách sàn: API cũ trước, nếu trống thì đọc trên Cloud
        let sanList: any[] = [];
        try {
          const resSan = await ProductService.getSanGiaoDichAPI();
          sanList = normalizeSanGiaoDichList(resSan);
        } catch (e) {
          console.error("Load sàn (API) failed", e);
        }
        if (!sanList.length) {
          try {
            const { listCompaniesFromCloud } = await import("../../services/CompanyAuthCloudService");
            const cloudCompanies = await listCompaniesFromCloud();
            sanList = normalizeSanGiaoDichList(cloudCompanies);
          } catch (e) {
            console.error("Load sàn (Cloud) failed", e);
          }
        }
        setListSan(sanList);

        if (!isEditMode) {
          const authUser = JSON.parse(localStorage.getItem("authUser") || "{}");
          const sanGiaoDich = authUser?.data?.maSan;
          if (
            sanGiaoDich != null &&
            sanList.some(
              (item: any) => String(item?.ID) === String(sanGiaoDich)
            )
          ) {
            setMaSan(String(sanGiaoDich));
          }
        }

        if (isEditMode) {
          // Đổ dữ liệu đã lưu: khách hàng, sàn, cấu hình bán hàng, ưu tiên
          setBookingCode(String(editDetail?.soPhieu ?? editMaPGC ?? ""));
          if (editDetail?.maSan) setMaSan(String(editDetail.maSan));
          setIsPriority(!!editDetail?.uuTien);
          setCongTyBanHangId(editDetail?.congTyBanHangId ?? null);
          savedEditRef.current = { ctbhId: editDetail?.congTyBanHangId ?? null, policyId: editDetail?.policyId ? String(editDetail.policyId) : null };
          setCongTyBanHangTen(editDetail?.congTyBanHangTen ?? null);
          if (editDetail?.priceListId) setPriceListId(String(editDetail.priceListId));
          unitFund.restore(editDetail?.quyCanId ?? null, editDetail?.priceListId ?? null);
          if (editDetail?.pricingConfigId)
            setPricingConfigId(String(editDetail.pricingConfigId));
          if (editDetail?.policyId) setPolicyId(String(editDetail.policyId));
          // Tiến độ thanh toán đã lưu không nạp lên form (không còn ô); lưu sửa phiếu không gửi khóa ⇒ giữ nguyên
          if (Array.isArray(editDetail?.promotionIds))
            setPromotionIds(editDetail.promotionIds.map(String));
          setEditTienGiuCho(editDetail?.tienGiuCho ?? null);
          const c = editDetail?.customer ?? {};
          if (c.TenKH || c.MaKH) {
            setForm({
              ...emptyForm,
              MaKH: c.MaKH ?? 0,
              TenKH: c.TenKH ?? "",
              SoCMND: c.SoCMND ?? "",
              DiDong: c.DiDong ?? "",
              Email: c.Email ?? "",
              DiaChi: c.DiaChi ?? "",
            });
            setSelectedCustomer({
              value: c.MaKH ?? c.TenKH ?? "current",
              maKH: c.MaKH ?? undefined,
              label: `${c.TenKH ?? ""} - ${c.DiDong ?? ""} - ${c.Email ?? ""
                }`,
              tenKH: c.TenKH ?? "",
              soCMND: c.SoCMND ?? "",
              diDong: c.DiDong ?? "",
              email: c.Email ?? "",
              diaChi: c.DiaChi ?? "",
            });
          }
        } else {
          try {
            const maSpVar = merged?.KyHieu ?? merged?.MaSP ?? "";
            const { generateFormCode, projectTenDA } = await import("../../_shims/services/CodeGenService");
            // {TenDA} = tên viết tắt dự án; tên đầy đủ chỉ là dự phòng
            const tenDaVar = await projectTenDA(
              merged?.MaDA ?? merged?.maDA ?? product?.MaDA,
              merged?.tenDA ?? merged?.TenDA ?? ""
            );
            // Số thứ tự phải lấy trên máy chủ, nếu tính ở máy người dùng thì
            // luôn ra 0001 ⇒ trùng số phiếu khi lưu.
            let code = "";
            try {
              const { slug } = await import("../../utils/codePattern");
              code =
                (await generateFormCode("BOOKING", {
                  MaSP: slug(String(maSpVar)),
                  TenDA: slug(String(tenDaVar)),
                })) || "";
              if (/chưa cấu hình/i.test(code)) code = "";
            } catch (err) {
              console.warn("Sinh mã booking trên máy chủ lỗi", err);
            }
            if (!code) {
              code = await generateCodePreview("BOOKING", {
                MaSP: maSpVar,
                TenDA: tenDaVar,
              });
            }
            setBookingCode(code);
          } catch (e) {
            console.error("Load booking code failed", e);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product, editMaPGC]);
  const fetchCustomerOpts = async (query: string): Promise<CustomerOpt[]> => {
    const kw = (query || "").trim();
    let opts: CustomerOpt[] = [];

    // 1) Ưu tiên đọc khách hàng trên Cloud (theo tenant)
    try {
      const { listCustomersFromCloud } = await import("../../services/CustomerCloudService");
      const cloud = await listCustomersFromCloud({
        keyword: kw,
        pageIndex: 1,
        pageSize: 50,
      });
      opts = (cloud?.rows ?? []).map((it: any) => ({
        value: it.MaKH,
        maKH: it.MaKH,
        label: `${it.TenKH || it.HoTen || ""} - ${it.DiDong || it.DienThoai || ""
          } - ${it.Email || ""}`,
        tenKH: it.TenKH || it.HoTen,
        soCMND: it.SoCMND || it.CCCD,
        diDong: it.DiDong || it.DienThoai,
        email: it.Email,
        diaChi: it.DiaChi || it.ThuongTru,
        maCT: it.MaCT ?? it.MaSan,
        maSoKH: it.MaSoKH,
      }));
    } catch (e) {
      console.error("Cloud customer search failed", e);
    }

    // 2) Bổ sung từ API cũ (không trùng mã KH)
    if (opts.length < 10) {
      try {
        let legacy: CustomerOpt[] = [];
        if (embedded) {
          // Đại lý: chỉ lấy khách hàng của sàn đó
          const res = await AgencyService.KhachHang.getListPQ({
            InputSearch: kw,
            PageIndex: 1,
            PageSize: 50,
          });
          legacy = (res?.data ?? []).map((it: any) => ({
            value: it.MaKH,
            maKH: it.MaKH,
            label: `${it.TenKH || ""} - ${it.DiDong || ""} - ${it.Email || ""}`,
            tenKH: it.TenKH ?? it.TenCongTy ?? it.HoTen,
            soCMND: it.SoCMND ?? it.CCCD,
            diDong: it.DiDong ?? it.DienThoai,
            email: it.Email,
            diaChi: it.DiaChi,
            maCT: it.MaCT,
            maSoKH: it.MaSoKH ?? it.maSoKH,
          }));
        } else {
          const res = await CustomerService.filter({
            Limit: 10,
            Offset: 1,
            MaNKH: 0,
            MaNVCS: 0,
            MaTT: 0,
            inputSearch: kw,
          });
          // CustomerService.filter hiện trả dữ liệu Cloud dạng PascalCase
          // (TenKH/DiDong/...) — đọc cả 2 dạng để tương thích ngược
          legacy = (res?.data ?? []).map((it: any) => {
            const tenKH =
              it.tenKH ?? it.TenKH ?? it.HoTen ?? it.TenCongTy ?? "";
            const diDong = it.diDong ?? it.DiDong ?? it.DienThoai ?? "";
            const email = it.email ?? it.Email ?? "";
            return {
              value: it.maKH ?? it.MaKH ?? it.Id,
              maKH: it.maKH ?? it.MaKH ?? it.Id,
              label: `${tenKH} - ${diDong} - ${email}`,
              tenKH,
              soCMND: it.soCMND ?? it.SoCMND ?? it.CCCD,
              diDong,
              email,
              diaChi: it.diaChi ?? it.DiaChi ?? it.ThuongTru,
              maSoKH: it.maSoKH ?? it.MaSoKH,
            };
          });
        }
        const seen = new Set(
          opts.map((o) => String(o.maKH ?? "").toLowerCase())
        );
        opts = [
          ...opts,
          ...legacy.filter(
            (o) => !seen.has(String(o.maKH ?? "").toLowerCase())
          ),
        ];
      } catch (e) {
        console.error("Legacy customer search failed", e);
      }
    }
    return opts;
  };
  useEffect(() => {
    if (!open) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = searchQuery.trim();
    searchTimer.current = setTimeout(
      async () => {
        setSearching(true);
        try {
          const opts = await fetchCustomerOpts(q);
          setResults(opts);
        } catch (e) {
          console.error(e);
          setResults([]);
        } finally {
          setSearching(false);
        }
      },
      q ? 400 : 0
    );
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery, open, embedded]);
  const handleSelectCustomer = (c: CustomerOpt) => {
    setSelectedCustomer(c);
    setForm({
      ...emptyForm,
      MaKH: c.maKH ?? 0,
      TenKH: c.tenKH || "",
      SoCMND: c.soCMND || "",
      DiDong: c.diDong || "",
      Email: c.email || "",
      DiaChi: c.diaChi || "",
    });
    // Đại lý: mã sàn lấy theo MaCT của khách hàng và không cho đổi
    if (embedded && c.maCT != null) {
      setMaSan(String(c.maCT));
    }
    setSearchQuery("");
  };
  const handleCustomerSaved = (c: any) => {
    if (!c?.MaKH) return;
    const opt: CustomerOpt = {
      value: c.MaKH,
      maKH: c.MaKH,
      maSoKH: c.MaSoKH,
      tenKH: c.TenKH || c.TenCongTy || "",
      soCMND: c.SoCMND || c.CCCD || "",
      diDong: c.DiDong || c.DienThoai || "",
      email: c.Email || "",
      diaChi: c.DiaChi || "",
      maCT: c.MaCT,
      label: "",
    };
    setResults((prev) =>
      prev.some((o) => String(o.value) === String(opt.value))
        ? prev.map((o) => (String(o.value) === String(opt.value) ? opt : o))
        : [opt, ...prev]
    );
    handleSelectCustomer(opt);
  };
  const handleEditCustomer = async () => {
    if (!form.MaKH) return;
    try {
      const res: any = await CustomerService.getByMaKH(form.MaKH as any);
      const c: any = Array.isArray(res?.data) ? res.data[0] : res?.data;
      if (!c) {
        toast.error("Không tải được khách hàng");
        return;
      }
      customerFormRef.current?.openEditWithCallback(
        c,
        c.IsPersonal === false ? "business" : "individual",
        handleCustomerSaved
      );
    } catch (e: any) {
      toast.error(e?.message || "Lỗi tải khách hàng");
    }
  };
  const clearCustomer = () => {
    setSelectedCustomer(null);
    setForm({ ...emptyForm });
    setSearchQuery("");
    setResults([]);
  };
  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setData({});
      setBookingCode("");
      setMaSan("");
      setIsPriority(false);
      clearCustomer();
    }, 200);
  };
  const handleSubmit = async () => {
    // Chỉ bắt buộc khách hàng; Đại lý phân phối không bắt buộc (spec booking-ctbh-dai-ly D4).
    if (!selectedCustomer && !form.MaKH) {
      toast.error("Vui lòng chọn khách hàng");
      return;
    }
    if (unitFund.missing) {
      toast.error("Vui lòng chọn quỹ căn");
      return;
    }

    setSubmitting(true);
    try {
      const addKH = {
        TenKH: form.TenKH.trim(),
        DiDong: form.DiDong.trim(),
        DiDong2: form.DiDong2 || "",
        DiaChi: form.DiaChi || "",
        ThuongTru: form.ThuongTru || "",
        Email: form.Email || "",
        Email2: form.Email2 || "",
        SoCMND: form.SoCMND || "",
        NgaySinh: form.NgaySinh || null,
        NgayCap: form.NgayCap || null,
        NoiCap: form.NoiCap || "",
        // Không gửi MaTinh / MaXa / MaHuyen: từng gửi 0 ⇒ khách mang mã '0' ngoài danh mục địa giới (spec 2026-11-16-dm-dia-gioi)
      };
      // Đã chọn khách hàng có sẵn (hoặc vừa tạo từ modal) → dùng trực tiếp,
      // chỉ gọi tạo khách mới khi chưa có mã KH.
      let maKHFinal: any = form.MaKH || null;
      if (!maKHFinal) {
        const resKH = await ProductService.addKhachHangAPI(addKH);
        if (resKH?.status !== 2000) {
          toast.error(resKH?.message || "Lỗi tạo khách hàng");
          setSubmitting(false);
          return;
        }
        maKHFinal = resKH?.data;
      }

      // Cài đặt bán hàng hiệu lực tại thời điểm tạo (theo dự án + khoảng ngày)
      // quyết định số tiền booking và thời gian giữ chỗ. Ghi cứng vào phiếu để
      // sau này đổi cài đặt thì booking cũ vẫn giữ nguyên.
      const nowIso = new Date().toISOString();
      // Ưu tiên tiền booking khai báo trong chính sách bán hàng đã chọn
      let tienBooking: number | null = policyTienBooking ?? projectBookingAmount;
      let hetHanLuc: string | null = null;
      try {
        const { SalesSettingsService } = await import("../../services/SalesSettingsService");
        const setting = await SalesSettingsService.resolve(
          data?.MaDA,
          new Date()
        );
        if (!tienBooking)
          tienBooking =
            Number(setting?.tien_booking) ||
            Number(setting?.tien_dat_coc) ||
            null;
        if (!tienBooking) {
          const { getProjectDepositAmount } = await import("../../services/ProjectDaCloudService");
          tienBooking = (await getProjectDepositAmount(data?.MaDA)) || null;
        }
        const minutes = Number(setting?.thoi_gian_booking) || 0;
        if (minutes > 0) {
          hetHanLuc = new Date(Date.now() + minutes * 60 * 1000).toISOString();
        }
      } catch (e) {
        console.error("resolve cài đặt bán hàng cho booking failed", e);
      }

      // Giá lấy từ bảng giá đang chọn (fn_get_price_list_item_by_product);
      // nếu chưa có thì rơi về giá gốc của sản phẩm.
      const pi: any = priceInfo || {};
      const pick = (a: any, b: any) =>
        a == null || a === "" || Number(a) === 0 ? b : a;

      const payload = {
        ...salesConfigPayload(),
        MaKH: maKHFinal,
        SoPhieu: bookingCode || null,


        MaSP: data?.MaSP,
        SanPhamId: data?.id ?? data?.Id ?? data?.ID ?? null,
        KyHieu: data?.KyHieu,
        MaSanPham: data?.KyHieu || data?.TenSP,
        MaSan: maSan || null,
        MaDA: data?.MaDA,
        TenDA: data?.TenDA,
        MaKhu: data?.MaKhu,
        LockId: data?.LockId ?? null,
        TongGiaGomPBT: pick(pi.TongGiaGomPBT, data?.TongGiaTriHDMB),
        GiaNaked: isLowRise ? null : (pi.GiaNaked ?? data?.GiaNaked ?? null),
        DTThongThuy: pick(pi.DTThongThuy, data?.DTTimTuong ?? data?.DTThongThuy),
        DonGiaTT: pick(pi.DonGiaVAT, data?.DonGiaThongThuy),
        DonGiaChuaVAT: pick(pi.raw?.unit_price, data?.DonGiaChuaVAT),
        TongGiaChuaVAT: pick(pi.TongGiaChuaVAT, data?.TongGiaChuaVAT),
        TienVAT: pick(pi.vatchtien, data?.TienVAT ?? data?.vatchtien),
        TongGiaGomVAT: pick(pi.TongGiaGomVAT, data?.TongGiaGomVAT),
        PhiBaoTri: pick(pi.PhiBaoTri, data?.PhiBaoTri),
        DienTichDat: pick(pi.DienTichDat, data?.DienTichDat),
        DonGiaDat: pick(pi.DonGiaDat, data?.DonGiaDat),
        TongGiaDat: pick(pi.TongGiaDat, data?.TongGiaDat),
        DienTichXD: pick(pi.DienTichXD, data?.DienTichXD),
        DonGiaXD: pick(pi.DonGiaXD, data?.DonGiaXD),
        ThanhTienXD: pick(pi.ThanhTienXD, data?.ThanhTienXD),
        TienGiuCho: tienBooking,
        HetHanLuc: hetHanLuc,
        NgayGiuCho: nowIso,
        NgayNhap: nowIso,
        TenKH: form.TenKH.trim(),
        DiDong: form.DiDong.trim(),
        Email: form.Email || "",
        SoCMND: (form as any)?.SoCMND || null,
        UuTien: isPriority ? 1 : 0,
      };

      // Chế độ sửa: cập nhật phiếu giữ chỗ + booking rồi dừng (không tạo mới,
      // không gia hạn lock, không chạy lại quy trình bán hàng)
      if (isEditMode && editMaPGC) {
        const { updateBookingFull } = await import("../../services/BookingDocsCloudService");
        const resUpd = await updateBookingFull(String(editMaPGC), {
          MaKH: maKHFinal,
          TenKH: form.TenKH.trim(),
          DiDong: form.DiDong.trim(),
          Email: form.Email || "",
          SoCMND: (form as any)?.SoCMND || "",
          DiaChi: form.DiaChi || "",
          MaSan: maSan,
          TienGiuCho: policyTienBooking,
          UuTien: isPriority ? 1 : 0,
          MaDotGia: priceListId ?? null,
          MaQuyCan: unitFund.quyCanId,
          CongTyBanHangId: congTyBanHangId || null,
          TenCongTyBanHang: congTyBanHangId ? nameOfCongTyBanHang(congTyBanHangId) : null,
          MaCS: policyId ?? null,
          MaCSTong: pricingConfigId ?? null,
          // Form không còn ô TĐTT: không đổi chính sách ⇒ không gửi khóa (giữ TĐTT đã lưu); đổi chính sách ⇒ xóa để Cọc tự chọn theo chính sách mới
          ...editScheduleFields(savedEditRef.current.policyId, policyId),
          KhuyenMai: payload.KhuyenMai,
        });
        if (resUpd?.status === 2000) {
          toast.success("Đã cập nhật booking");
          handleClose();
          onSuccess?.();
        } else {
          toast.error(resUpd?.message || "Không cập nhật được booking");
        }
        return;
      }

      const resBK = await ProductService.addBookingAPI(payload);
      if (resBK?.status === 2000) {
        // Mã phiếu giữ chỗ dùng chung cho cả vòng đời (giữ chỗ → cọc → HĐ)
        const maPGC =
          resBK?.data?.MaPGC ??
          resBK?.data?.Id ??
          (typeof resBK?.data === "number" || typeof resBK?.data === "string"
            ? resBK.data
            : null) ??
          `PGC-${Date.now()}`;
        const soPhieuGC = resBK?.data?.SoPhieu ?? String(maPGC);


        if (isPriority) {
          try {
            const { supabase } = await import("../../_shims/integrations/supabase/client");
            const { secureRpc } = await import("../../lib/secureRpc");
            const { data: slot } = await secureRpc<number>(
              "next_priority_slot",
              {
                p_product_code: String(data?.MaSP ?? ""),
              }
            );
            const priorityNum = (slot as number) ?? null;
            if (!priorityNum) {
              toast.warning(
                "Sản phẩm đã đủ 3 ưu tiên, booking thường vẫn được tạo"
              );
            } else {
              await supabase.from("priority_bookings").insert(
                stampOwner(
                  {
                    ma_ctdk: tenant() || null,
                    ma_ctdk_uid: sessionCompanyId() || null,
                    booking_code: soPhieuGC,
                    product_code: String(data?.MaSP ?? ""),
                    product_name: data?.TenSP || data?.MaSP || null,
                    project_id: data?.MaDA ?? null,
                    project_name: data?.TenDA || null,
                    customer_name: form.TenKH.trim(),
                    phone: form.DiDong.trim(),
                    email: form.Email || null,
                    price: data?.TongGiaGomVAT ?? null,
                    booking_amount: data?.PhiBaoTri ?? null,
                    priority: priorityNum,
                    status: "pending",
                    expires_at:
                      priorityNum === 1
                        ? new Date(Date.now() + 30 * 60 * 1000).toISOString()
                        : null,
                    external_booking_id: String(maPGC),
                  },
                  "priority_bookings"
                ) as any
              );
              toast.success(`Đã tạo booking ưu tiên ${priorityNum}`);
            }
          } catch (err: any) {
            console.error("priority booking insert error", err);
            toast.error("Lỗi lưu booking ưu tiên: " + (err?.message || ""));
          }
        }
        // Kích hoạt quy trình bán hàng (Booking / Booking ưu tiên)
        try {
          const { triggerSalesProcess } = await import("../../services/SalesProcessService");
          const ctx = {
            ma_da: data?.MaDA,
            ma_sp: data?.MaSP,
            ky_hieu: data?.KyHieu,
            ma_kh: payload.MaKH,
            ten_kh: form.TenKH.trim(),
            di_dong: form.DiDong.trim(),
            ma_san: payload.MaSan,
            uu_tien: isPriority ? 1 : 0,
            entity_id: String(maPGC),
            ma_pgc: String(maPGC),
          };
          await triggerSalesProcess("booking", ctx);
          if (isPriority) await triggerSalesProcess("booking_priority", ctx);
        } catch (e) {
          console.error("triggerSalesProcess booking failed", e);
        }
        toast.success(resBK?.message || "Tạo giữ chỗ thành công");

        handleClose();
        onSuccess?.();
      } else {
        toast.error(resBK?.message || "Lỗi tạo giữ chỗ");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Lỗi tạo giữ chỗ");
    } finally {
      setSubmitting(false);
    }
  };
  if (!product && !isEditMode) return null;
  const code = data?.KyHieu ?? product?.KyHieu ?? product?.code ?? "";
  const projectName =
    data?.tenDA ?? data?.TenDA ?? product?.TenDA ?? product?.project_name ?? "";
  const area =
    data?.DTTimTuong ?? data?.DTThongThuy ?? data?.DienTichDat ?? product?.area;
  const price = data?.TongGiaTriHDMB ?? data?.TongGiaGomVAT ?? product?.price;
  const floor = data?.Tang ?? product?.floor;
  const zone = data?.Khu ?? product?.zone;
  const isValid = canSubmitBooking({ hasCustomer: !!(selectedCustomer || form.MaKH) });
  const tgBooking =
    data?.ThoiGianBooking ??
    product?.ThoiGianBooking ??
    projectHoldMinutes ??
    "";
  const tienGiuChoHienThi =
    policyTienBooking ?? editTienGiuCho ?? projectBookingAmount ?? null;
  return { isEditMode, exceptionIds, loading, setLoading, submitting, setSubmitting, data, setData, bookingCode, setBookingCode, listSan, setListSan, maSan, setMaSan, agencySan, isPriority, setIsPriority, congTyBanHangId, setCongTyBanHangId, congTyBanHangTen, setCongTyBanHangTen, salesCompanyOptions, nameOfCongTyBanHang, salesCompanyLocked, salesCompanyRequired, salesCompanyAutoId, agenciesOf, agencyLocked, agencyOptions, handleChangeCongTyBanHang, savedEditRef, priceListId, setPriceListId, pricingConfigId, setPricingConfigId, policyId, setPolicyId, promotionIds, setPromotionIds, preview, setPreview, isLowRise, productUuid, salesConfig, handleSelectPolicy, policyTienBooking, priceInfo, setPriceInfo, loadingPriceInfo, setLoadingPriceInfo, quyCanRef, changePriceList, unitFundRows, unitFund, priceInfoItems, salesConfigPayload, emptyForm, form, setForm, searchQuery, setSearchQuery, searching, setSearching, results, setResults, selectedCustomer, setSelectedCustomer, searchTimer, customerFormRef, projectHoldMinutes, setProjectHoldMinutes, projectBookingAmount, setProjectBookingAmount, editTienGiuCho, setEditTienGiuCho, fetchCustomerOpts, handleSelectCustomer, handleCustomerSaved, handleEditCustomer, clearCustomer, handleClose, handleSubmit, code, projectName, area, price, floor, zone, isValid, tgBooking, tienGiuChoHienThi };
}
