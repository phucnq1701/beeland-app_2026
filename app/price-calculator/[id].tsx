import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { featuredProperties, Property } from '@/mocks/properties';
import { paymentPolicies, PaymentPolicy } from '@/mocks/paymentPolicies';
import Colors from '@/constants/colors';
import { ChevronDown, CheckCircle2, Printer } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function PriceCalculatorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  const property: Property | undefined = useMemo(() => {
    const pid = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined;
    return featuredProperties.find(p => p.id === pid);
  }, [id]);

  const selectedPolicy: PaymentPolicy | undefined = useMemo(() => {
    return paymentPolicies.find(p => p.id === selectedPolicyId);
  }, [selectedPolicyId]);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(value);
  };

  if (!property || !property.priceValue) {
    return (
      <View style={styles.missingContainer}>
        <Text style={styles.missingTitle}>Không tìm thấy thông tin sản phẩm</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const basePrice = property.priceValue;
  const vat = basePrice * 0.1;
  const maintenanceFee = basePrice * 0.02;
  const totalBeforeDiscount = basePrice + vat + maintenanceFee;

  const calculateTotalDiscount = () => {
    if (!selectedPolicy) return { percentageTotal: 0, amountTotal: 0, total: 0 };
    
    let percentageTotal = 0;
    let amountTotal = 0;
    
    selectedPolicy.discounts.forEach(discount => {
      if (discount.type === 'percentage') {
        percentageTotal += discount.value;
      } else {
        amountTotal += discount.value;
      }
    });
    
    const percentageDiscount = totalBeforeDiscount * (percentageTotal / 100);
    const total = percentageDiscount + amountTotal;
    
    return { percentageTotal, amountTotal, total };
  };

  const discountCalculation = calculateTotalDiscount();
  const finalTotal = totalBeforeDiscount - discountCalculation.total;

  const generatePDF = async () => {
    if (!selectedPolicy) {
      Alert.alert('Thông báo', 'Vui lòng chọn gói chính sách trước khi in');
      return;
    }

    try {
      const currentDate = new Date().toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            @page {
              margin: 20mm;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
              font-size: 12pt;
              line-height: 1.6;
              color: #1f2937;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 3px solid #2563eb;
            }
            .header h1 {
              font-size: 24pt;
              color: #2563eb;
              margin-bottom: 8px;
              font-weight: 700;
            }
            .header .date {
              color: #6b7280;
              font-size: 11pt;
            }
            .property-info {
              background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
              padding: 20px;
              border-radius: 10px;
              margin-bottom: 25px;
              border-left: 4px solid #2563eb;
            }
            .property-info h2 {
              font-size: 18pt;
              color: #1e40af;
              margin-bottom: 6px;
            }
            .property-info p {
              color: #4b5563;
              font-size: 11pt;
            }
            .section {
              margin-bottom: 25px;
            }
            .section-title {
              font-size: 16pt;
              font-weight: 700;
              color: #1f2937;
              margin-bottom: 12px;
              padding-bottom: 6px;
              border-bottom: 2px solid #e5e7eb;
            }
            .policy-card {
              background: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 18px;
              margin-bottom: 20px;
            }
            .policy-name {
              font-size: 14pt;
              font-weight: 700;
              color: #1f2937;
              margin-bottom: 4px;
            }
            .policy-desc {
              color: #6b7280;
              font-size: 11pt;
              margin-bottom: 14px;
            }
            .subsection {
              margin-top: 16px;
              padding-top: 16px;
              border-top: 1px solid #e5e7eb;
            }
            .subsection-title {
              font-size: 12pt;
              font-weight: 600;
              color: #374151;
              margin-bottom: 10px;
            }
            .list-item {
              display: flex;
              align-items: flex-start;
              margin-bottom: 10px;
              padding-left: 8px;
            }
            .list-item::before {
              content: '•';
              color: #2563eb;
              font-weight: bold;
              font-size: 14pt;
              margin-right: 10px;
              line-height: 1.6;
            }
            .list-item-text {
              flex: 1;
            }
            .list-item-label {
              font-weight: 600;
              color: #1f2937;
            }
            .list-item-desc {
              color: #6b7280;
              font-size: 10pt;
              margin-top: 2px;
            }
            .benefit-item {
              display: flex;
              align-items: center;
              margin-bottom: 8px;
            }
            .benefit-item::before {
              content: '✓';
              color: #10b981;
              font-weight: bold;
              font-size: 13pt;
              margin-right: 8px;
            }
            .price-table {
              width: 100%;
              border-collapse: collapse;
              background: #ffffff;
              border-radius: 8px;
              overflow: hidden;
              border: 1px solid #e5e7eb;
            }
            .price-table tr {
              border-bottom: 1px solid #f3f4f6;
            }
            .price-table tr:last-child {
              border-bottom: none;
            }
            .price-table td {
              padding: 12px 14px;
            }
            .price-table td:first-child {
              color: #6b7280;
              font-size: 11pt;
            }
            .price-table td:last-child {
              text-align: right;
              font-weight: 600;
              color: #1f2937;
            }
            .discount-row {
              background: #fef3c7 !important;
            }
            .discount-row td:first-child {
              color: #92400e;
              font-weight: 600;
            }
            .discount-row td:last-child {
              color: #92400e;
              font-weight: 700;
            }
            .total-discount-row {
              background: #fde68a !important;
            }
            .total-row {
              background: #eff6ff !important;
              border-top: 2px solid #2563eb !important;
            }
            .total-row td:first-child {
              font-size: 12pt;
              font-weight: 700;
              color: #1e40af;
            }
            .total-row td:last-child {
              font-size: 14pt;
              font-weight: 800;
              color: #2563eb;
            }
            .schedule-table {
              width: 100%;
              border-collapse: collapse;
              background: #ffffff;
              border-radius: 8px;
              overflow: hidden;
              border: 1px solid #e5e7eb;
            }
            .schedule-table thead {
              background: #f9fafb;
            }
            .schedule-table th {
              padding: 12px 14px;
              text-align: left;
              font-weight: 600;
              color: #374151;
              font-size: 11pt;
              border-bottom: 2px solid #e5e7eb;
            }
            .schedule-table td {
              padding: 12px 14px;
              border-bottom: 1px solid #f3f4f6;
            }
            .schedule-table tr:last-child td {
              border-bottom: none;
            }
            .schedule-name {
              font-weight: 600;
              color: #1f2937;
            }
            .schedule-desc {
              color: #6b7280;
              font-size: 10pt;
              margin-top: 2px;
            }
            .schedule-percentage {
              display: inline-block;
              background: #dbeafe;
              color: #1e40af;
              padding: 4px 10px;
              border-radius: 6px;
              font-weight: 600;
              font-size: 10pt;
            }
            .schedule-time {
              display: inline-block;
              background: #f3f4f6;
              color: #4b5563;
              padding: 4px 10px;
              border-radius: 6px;
              font-weight: 600;
              font-size: 10pt;
            }
            .schedule-amount {
              font-weight: 700;
              color: #2563eb;
              font-size: 12pt;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #e5e7eb;
              text-align: center;
              color: #9ca3af;
              font-size: 10pt;
            }
            .note {
              background: #fef9c3;
              border-left: 4px solid #eab308;
              padding: 14px;
              border-radius: 6px;
              margin-top: 20px;
            }
            .note p {
              color: #713f12;
              font-size: 10pt;
              line-height: 1.5;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>PHIẾU TÍNH GIÁ SẢN PHẨM</h1>
              <p class="date">Ngày lập: ${currentDate}</p>
            </div>

            <div class="property-info">
              <h2>${property.title}</h2>
              <p>${property.location}</p>
            </div>

            <div class="section">
              <h3 class="section-title">Gói chính sách thanh toán</h3>
              <div class="policy-card">
                <div class="policy-name">${selectedPolicy.name}</div>
                <p class="policy-desc">${selectedPolicy.description}</p>

                <div class="subsection">
                  <div class="subsection-title">Các chiết khấu áp dụng:</div>
                  ${selectedPolicy.discounts.map(discount => `
                    <div class="list-item">
                      <div class="list-item-text">
                        <span class="list-item-label">${discount.description}</span>
                        <div class="list-item-desc">
                          ${discount.type === 'percentage' 
                            ? `${discount.value}% giá trị hợp đồng` 
                            : formatCurrency(discount.value)}
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>

                <div class="subsection">
                  <div class="subsection-title">Ưu đãi đi kèm:</div>
                  ${selectedPolicy.benefits.map(benefit => `
                    <div class="benefit-item">${benefit}</div>
                  `).join('')}
                </div>
              </div>
            </div>

            <div class="section">
              <h3 class="section-title">Chi tiết giá sau chiết khấu</h3>
              <table class="price-table">
                <tr>
                  <td>Giá bán cơ bản:</td>
                  <td>${formatCurrency(basePrice)}</td>
                </tr>
                <tr>
                  <td>Tiền VAT (10%):</td>
                  <td>${formatCurrency(vat)}</td>
                </tr>
                <tr>
                  <td>Phí bảo trì (2%):</td>
                  <td>${formatCurrency(maintenanceFee)}</td>
                </tr>
                <tr style="font-weight: 600;">
                  <td>Tổng trước chiết khấu:</td>
                  <td>${formatCurrency(totalBeforeDiscount)}</td>
                </tr>
                ${selectedPolicy.discounts.map(discount => {
                  const discountValue = discount.type === 'percentage' 
                    ? totalBeforeDiscount * (discount.value / 100)
                    : discount.value;
                  return `
                    <tr class="discount-row">
                      <td>${discount.description} (${discount.type === 'percentage' ? `${discount.value}%` : formatCurrency(discount.value)}):</td>
                      <td>-${formatCurrency(discountValue)}</td>
                    </tr>
                  `;
                }).join('')}
                <tr class="total-discount-row">
                  <td>Tổng chiết khấu:</td>
                  <td>-${formatCurrency(discountCalculation.total)}</td>
                </tr>
                <tr class="total-row">
                  <td>Tổng giá trị thanh toán:</td>
                  <td>${formatCurrency(finalTotal)}</td>
                </tr>
              </table>
            </div>

            <div class="section">
              <h3 class="section-title">Lịch thanh toán chi tiết</h3>
              <table class="schedule-table">
                <thead>
                  <tr>
                    <th>Đợt thanh toán</th>
                    <th>Thời gian</th>
                    <th style="text-align: right;">Số tiền</th>
                  </tr>
                </thead>
                <tbody>
                  ${selectedPolicy.milestones.map(milestone => {
                    const amount = finalTotal * (milestone.percentage / 100);
                    return `
                      <tr>
                        <td>
                          <div class="schedule-name">${milestone.name}</div>
                          <div class="schedule-desc">${milestone.description}</div>
                          <div style="margin-top: 6px;">
                            <span class="schedule-percentage">${milestone.percentage}%</span>
                          </div>
                        </td>
                        <td>
                          <span class="schedule-time">${milestone.paymentTimeDays} ngày</span>
                        </td>
                        <td style="text-align: right;">
                          <div class="schedule-amount">${formatCurrency(amount)}</div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <div class="note">
              <p><strong>Lưu ý:</strong> Phiếu tính giá này chỉ có giá trị tham khảo. Giá trị cuối cùng sẽ được xác nhận trong Hợp đồng mua bán. Các chính sách ưu đãi có thể thay đổi theo từng thời kỳ.</p>
            </div>

            <div class="footer">
              <p>Phiếu tính giá được tạo tự động từ hệ thống • ${currentDate}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const productCode = property.code || property.id;
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
          const link = document.createElement('a');
          link.href = uri;
          link.download = `Phieu-tinh-gia-${productCode}.pdf`;
          link.click();
        }
      } else {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            UTI: '.pdf',
            mimeType: 'application/pdf',
          });
        } else {
          Alert.alert('Thành công', 'File PDF đã được tạo tại: ' + uri);
        }
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Lỗi', 'Không thể tạo file PDF. Vui lòng thử lại.');
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Tính giá sản phẩm',
          headerRight: selectedPolicy ? () => (
            <TouchableOpacity 
              onPress={generatePDF}
              style={styles.printButton}
              activeOpacity={0.7}
            >
              <Printer color={Colors.primary} size={24} />
            </TouchableOpacity>
          ) : undefined,
        }} 
      />

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.propertyName}>{property.title}</Text>
          <Text style={styles.propertyLocation}>{property.location}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chọn gói chính sách thanh toán</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowDropdown(!showDropdown)}
            activeOpacity={0.7}
          >
            <Text style={styles.dropdownText}>
              {selectedPolicy ? selectedPolicy.name : 'Chọn gói chính sách'}
            </Text>
            <ChevronDown color={Colors.textSecondary} size={20} />
          </TouchableOpacity>

          {showDropdown && (
            <View style={styles.dropdownMenu}>
              {paymentPolicies.map((policy) => (
                <TouchableOpacity
                  key={policy.id}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedPolicyId(policy.id);
                    setShowDropdown(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.dropdownItemContent}>
                    <Text style={styles.dropdownItemTitle}>{policy.name}</Text>
                    <Text style={styles.dropdownItemDesc}>{policy.description}</Text>
                    <View style={styles.discountsList}>
                      {policy.discounts.map((discount, idx) => (
                        <Text key={idx} style={styles.dropdownItemDiscount}>
                          {discount.type === 'percentage' 
                            ? `CK ${discount.value}%` 
                            : `CK ${formatCurrency(discount.value)}`}
                        </Text>
                      ))}
                    </View>
                  </View>
                  {selectedPolicyId === policy.id && (
                    <CheckCircle2 color={Colors.primary} size={24} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {selectedPolicy && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Chi tiết chính sách</Text>
              <View style={styles.policyCard}>
                <Text style={styles.policyName}>{selectedPolicy.name}</Text>
                <Text style={styles.policyDesc}>{selectedPolicy.description}</Text>

                <View style={styles.discountsContainer}>
                  <Text style={styles.milestoneTitle}>Các chiết khấu:</Text>
                  {selectedPolicy.discounts.map((discount, index) => (
                    <View key={index} style={styles.discountItemRow}>
                      <View style={styles.milestoneDot} />
                      <View style={styles.milestoneContent}>
                        <Text style={styles.milestoneName}>
                          {discount.description}
                        </Text>
                        <Text style={styles.milestoneDesc}>
                          {discount.type === 'percentage' 
                            ? `${discount.value}% giá trị hợp đồng` 
                            : formatCurrency(discount.value)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.milestoneContainer}>
                  <Text style={styles.milestoneTitle}>Lịch thanh toán:</Text>
                  {selectedPolicy.milestones.map((milestone, index) => (
                    <View key={index} style={styles.milestoneItem}>
                      <View style={styles.milestoneDot} />
                      <View style={styles.milestoneContent}>
                        <Text style={styles.milestoneName}>
                          {milestone.name} - {milestone.percentage}%
                        </Text>
                        <Text style={styles.milestoneDesc}>
                          {milestone.description} • {milestone.paymentTimeDays} ngày
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.benefitsContainer}>
                  <Text style={styles.benefitsTitle}>Ưu đãi:</Text>
                  {selectedPolicy.benefits.map((benefit, index) => (
                    <View key={index} style={styles.benefitItem}>
                      <CheckCircle2 color={Colors.primary} size={18} />
                      <Text style={styles.benefitText}>{benefit}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Chi tiết giá sau chiết khấu</Text>
              <View style={styles.priceDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Giá bán cơ bản:</Text>
                  <Text style={styles.detailValue}>{formatCurrency(basePrice)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tiền VAT (10%):</Text>
                  <Text style={styles.detailValue}>{formatCurrency(vat)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Phí bảo trì (2%):</Text>
                  <Text style={styles.detailValue}>{formatCurrency(maintenanceFee)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tổng trước chiết khấu:</Text>
                  <Text style={styles.detailValue}>{formatCurrency(totalBeforeDiscount)}</Text>
                </View>
                {selectedPolicy.discounts.map((discount, index) => {
                  const discountValue = discount.type === 'percentage' 
                    ? totalBeforeDiscount * (discount.value / 100)
                    : discount.value;
                  return (
                    <View key={index} style={[styles.detailRow, styles.discountRow]}>
                      <Text style={styles.discountLabel}>
                        {discount.description} ({discount.type === 'percentage' ? `${discount.value}%` : formatCurrency(discount.value)}):
                      </Text>
                      <Text style={styles.discountValue}>-{formatCurrency(discountValue)}</Text>
                    </View>
                  );
                })}
                <View style={[styles.detailRow, styles.totalDiscountRow]}>
                  <Text style={styles.discountLabel}>
                    Tổng chiết khấu:
                  </Text>
                  <Text style={styles.discountValue}>-{formatCurrency(discountCalculation.total)}</Text>
                </View>
                <View style={[styles.detailRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Tổng giá trị thanh toán:</Text>
                  <Text style={styles.totalValue}>{formatCurrency(finalTotal)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Chi tiết thanh toán theo đợt</Text>
              <View style={styles.paymentSchedule}>
                {selectedPolicy.milestones.map((milestone, index) => {
                  const amount = finalTotal * (milestone.percentage / 100);
                  return (
                    <View key={index} style={styles.scheduleItem}>
                      <View style={styles.scheduleHeader}>
                        <View style={styles.scheduleLeft}>
                          <Text style={styles.scheduleName}>{milestone.name}</Text>
                          <Text style={styles.schedulePercentage}>{milestone.percentage}%</Text>
                        </View>
                        <View style={styles.scheduleRight}>
                          <Text style={styles.scheduleTime}>{milestone.paymentTimeDays} ngày</Text>
                        </View>
                      </View>
                      <Text style={styles.scheduleDesc}>{milestone.description}</Text>
                      <Text style={styles.scheduleAmount}>{formatCurrency(amount)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}

        {!selectedPolicy && (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>
              Vui lòng chọn gói chính sách thanh toán để xem chi tiết giá
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingTop: 16,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  propertyName: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  propertyLocation: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dropdownText: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  dropdownMenu: {
    marginTop: 8,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownItemContent: {
    flex: 1,
    marginRight: 12,
  },
  dropdownItemTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  dropdownItemDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  dropdownItemDiscount: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  policyCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
  },
  policyName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  policyDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  milestoneContainer: {
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  milestoneItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  milestoneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 6,
    marginRight: 12,
  },
  milestoneContent: {
    flex: 1,
  },
  milestoneName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  milestoneDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  benefitsContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 14,
    color: Colors.text,
    marginLeft: 8,
    flex: 1,
  },
  priceDetails: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  discountRow: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    marginHorizontal: -16,
    paddingLeft: 16,
    paddingRight: 16,
  },
  totalDiscountRow: {
    backgroundColor: '#FDE68A',
  },
  discountsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  discountsContainer: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  discountItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  discountLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#92400E',
  },
  discountValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#92400E',
  },
  totalRow: {
    borderBottomWidth: 0,
    paddingTop: 12,
    marginTop: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 12,
    marginHorizontal: -16,
    paddingLeft: 16,
    paddingRight: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  paymentSchedule: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    overflow: 'hidden',
  },
  scheduleItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  scheduleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  scheduleRight: {
    alignItems: 'flex-end',
  },
  scheduleName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  schedulePercentage: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  scheduleTime: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  scheduleDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  scheduleAmount: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  placeholderContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  missingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  missingTitle: {
    fontSize: 18,
    color: Colors.text,
    marginBottom: 12,
    fontWeight: '600' as const,
  },
  backBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backBtnText: {
    color: Colors.white,
    fontWeight: '700' as const,
  },
  printButton: {
    padding: 8,
    marginRight: 4,
  },
});
