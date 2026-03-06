import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Search, User, Building2, ChevronRight, Plus, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { customers, Customer } from '@/mocks/customers';

export default function CreateBookingScreen() {
  const router = useRouter();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredCustomers = customers.filter((customer) => {
    if (!searchQuery) return true;
    return (
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone.includes(searchQuery) ||
      customer.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
  };

  const handleContinue = () => {
    if (selectedCustomer) {
      router.push({
        pathname: '/booking/payment-method',
        params: { customerId: selectedCustomer.id },
      });
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Đang giao dịch';
      case 'potential':
        return 'Tiềm năng';
      case 'inactive':
        return 'Không hoạt động';
      default:
        return '';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10B981';
      case 'potential':
        return '#F59E0B';
      case 'inactive':
        return '#9CA3AF';
      default:
        return '#9CA3AF';
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Tạo Booking',
          headerStyle: {
            backgroundColor: Colors.white,
          },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!selectedCustomer ? (
          <>
            <View style={styles.headerSection}>
              <Text style={styles.headerTitle}>Chọn khách hàng</Text>
              <Text style={styles.headerSubtitle}>
                Tìm kiếm và chọn khách hàng hoặc tạo mới
              </Text>
            </View>

            <View style={styles.searchContainer}>
              <Search color={Colors.textSecondary} size={20} />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm kiếm theo tên, số điện thoại, email..."
                placeholderTextColor={Colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <TouchableOpacity
              style={styles.createNewButton}
              activeOpacity={0.7}
              onPress={() => router.push('/customer/new')}
            >
              <View style={styles.createNewIcon}>
                <Plus color={Colors.white} size={24} />
              </View>
              <View style={styles.createNewTextContainer}>
                <Text style={styles.createNewTitle}>Tạo khách hàng mới</Text>
                <Text style={styles.createNewSubtitle}>
                  Thêm thông tin khách hàng mới
                </Text>
              </View>
              <ChevronRight color={Colors.textSecondary} size={20} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Danh sách khách hàng</Text>

            <View style={styles.customerList}>
              {filteredCustomers.map((customer) => (
                <TouchableOpacity
                  key={customer.id}
                  style={styles.customerCard}
                  activeOpacity={0.7}
                  onPress={() => handleSelectCustomer(customer)}
                >
                  <View style={styles.customerHeader}>
                    <View style={styles.customerNameRow}>
                      <View
                        style={[
                          styles.customerAvatar,
                          {
                            backgroundColor:
                              customer.type === 'personal' ? '#EFF6FF' : '#FDF2F8',
                          },
                        ]}
                      >
                        {customer.type === 'personal' ? (
                          <User color={Colors.primary} size={20} />
                        ) : (
                          <Building2 color="#EC4899" size={20} />
                        )}
                      </View>
                      <View style={styles.customerNameContainer}>
                        <Text style={styles.customerName}>{customer.name}</Text>
                        {customer.company && (
                          <Text style={styles.customerCompany}>{customer.company}</Text>
                        )}
                      </View>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(customer.status) },
                      ]}
                    >
                      <Text style={styles.statusBadgeText}>
                        {getStatusLabel(customer.status)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.customerInfo}>
                    <Text style={styles.customerInfoText}>📞 {customer.phone}</Text>
                    <Text style={styles.customerInfoText}>✉️ {customer.email}</Text>
                  </View>

                  <View style={styles.customerFooter}>
                    <ChevronRight color={Colors.primary} size={20} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={styles.headerSection}>
              <Text style={styles.headerTitle}>Xác nhận thông tin</Text>
              <Text style={styles.headerSubtitle}>Kiểm tra lại thông tin khách hàng</Text>
            </View>

            <View style={styles.selectedCustomerCard}>
              <View style={styles.selectedHeader}>
                <View style={styles.checkIconContainer}>
                  <Check color={Colors.white} size={24} />
                </View>
                <Text style={styles.selectedTitle}>Khách hàng đã chọn</Text>
              </View>

              <View style={styles.selectedContent}>
                <View style={styles.selectedRow}>
                  <View
                    style={[
                      styles.selectedAvatar,
                      {
                        backgroundColor:
                          selectedCustomer.type === 'personal' ? '#EFF6FF' : '#FDF2F8',
                      },
                    ]}
                  >
                    {selectedCustomer.type === 'personal' ? (
                      <User color={Colors.primary} size={28} />
                    ) : (
                      <Building2 color="#EC4899" size={28} />
                    )}
                  </View>
                  <View style={styles.selectedInfo}>
                    <Text style={styles.selectedName}>{selectedCustomer.name}</Text>
                    {selectedCustomer.company && (
                      <Text style={styles.selectedCompany}>
                        {selectedCustomer.company}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.selectedDivider} />

                <View style={styles.infoSection}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Số điện thoại:</Text>
                    <Text style={styles.infoValue}>{selectedCustomer.phone}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Email:</Text>
                    <Text style={styles.infoValue}>{selectedCustomer.email}</Text>
                  </View>
                  {selectedCustomer.taxCode && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Mã số thuế:</Text>
                      <Text style={styles.infoValue}>{selectedCustomer.taxCode}</Text>
                    </View>
                  )}
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Trạng thái:</Text>
                    <View
                      style={[
                        styles.inlineStatusBadge,
                        { backgroundColor: getStatusColor(selectedCustomer.status) },
                      ]}
                    >
                      <Text style={styles.inlineStatusText}>
                        {getStatusLabel(selectedCustomer.status)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.changeButton}
                activeOpacity={0.7}
                onPress={() => setSelectedCustomer(null)}
              >
                <Text style={styles.changeButtonText}>Chọn khách hàng khác</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {selectedCustomer && (
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={styles.continueButton}
            activeOpacity={0.8}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>Tiếp tục</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  headerSection: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  createNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
    marginBottom: 24,
  },
  createNewIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createNewTextContainer: {
    flex: 1,
    gap: 4,
  },
  createNewTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  createNewSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  customerList: {
    gap: 12,
  },
  customerCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
      },
    }),
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  customerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  customerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerNameContainer: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  customerCompany: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  customerInfo: {
    gap: 6,
    marginBottom: 8,
  },
  customerInfoText: {
    fontSize: 14,
    color: Colors.text,
  },
  customerFooter: {
    alignItems: 'flex-end',
    paddingTop: 8,
  },
  selectedCustomerCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: Colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  checkIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  selectedContent: {
    gap: 16,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  selectedAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  selectedCompany: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  selectedDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  infoSection: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  infoValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  inlineStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inlineStatusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  changeButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  changeButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  bottomContainer: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  continueButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});
