import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { CreditCard, ChevronRight, Check } from "lucide-react-native";
import Colors from "@/constants/colors";
import { customers } from "@/mocks/customers";

type PaymentMethod = "bank_transfer";

interface PaymentOption {
  id: PaymentMethod;
  icon: any;
  title: string;
  subtitle: string;
  color: string;
  bgColor: string;
}

const paymentOptions: PaymentOption[] = [
  {
    id: "bank_transfer",
    icon: CreditCard,
    title: "Chuyển khoản ngân hàng",
    subtitle: "Thanh toán qua QR Code hoặc số tài khoản",
    color: "#3B82F6",
    bgColor: "#EFF6FF",
  },
];

export default function PaymentMethodScreen() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams();
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(
    null
  );

  const customer = customers.find((c) => c.id === customerId);

  const handleContinue = () => {
    if (!selectedMethod) {
      Alert.alert("Thông báo", "Vui lòng chọn phương thức thanh toán");
      return;
    }

    router.push({
      pathname: "/booking/qr-payment",
      params: {
        customerId: customerId || "",
        paymentMethod: selectedMethod,
        bookingId: bookingId,
      },
    });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Phương thức thanh toán",
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
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Chọn phương thức thanh toán</Text>
          <Text style={styles.headerSubtitle}>
            Chọn cách thức thanh toán phù hợp với bạn
          </Text>
        </View>

        {customer && (
          <View style={styles.customerInfoCard}>
            <View style={styles.customerInfoHeader}>
              <Text style={styles.customerInfoLabel}>Khách hàng:</Text>
              <Text style={styles.customerInfoValue}>{customer.name}</Text>
            </View>
            <View style={styles.customerInfoRow}>
              <Text style={styles.customerInfoDetail}>📞 {customer.phone}</Text>
            </View>
          </View>
        )}

        <View style={styles.optionsContainer}>
          {paymentOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedMethod === option.id;

            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                ]}
                activeOpacity={0.7}
                onPress={() => setSelectedMethod(option.id)}
              >
                <View style={styles.optionContent}>
                  <View
                    style={[
                      styles.optionIconContainer,
                      { backgroundColor: option.bgColor },
                    ]}
                  >
                    <Icon color={option.color} size={28} />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>{option.title}</Text>
                    <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                  </View>
                </View>
                <View style={styles.optionRight}>
                  {isSelected ? (
                    <View style={styles.checkContainer}>
                      <Check color={Colors.white} size={20} />
                    </View>
                  ) : (
                    <ChevronRight color={Colors.textSecondary} size={24} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Lưu ý:</Text>
          <Text style={styles.noteText}>
            • Thanh toán ngay qua QR code hoặc số tài khoản ngân hàng
          </Text>
          <Text style={styles.noteText}>
            • Vui lòng kiểm tra thông tin chuyển khoản trước khi xác nhận
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            !selectedMethod && styles.continueButtonDisabled,
          ]}
          activeOpacity={0.8}
          onPress={handleContinue}
          disabled={!selectedMethod}
        >
          <Text
            style={[
              styles.continueButtonText,
              !selectedMethod && styles.continueButtonTextDisabled,
            ]}
          >
            Tiếp tục
          </Text>
        </TouchableOpacity>
      </View>
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
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  customerInfoCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  customerInfoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  customerInfoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: "500" as const,
  },
  customerInfoValue: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: "700" as const,
  },
  customerInfoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  customerInfoDetail: {
    fontSize: 14,
    color: Colors.text,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  optionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 2,
    borderColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
      },
    }),
  },
  optionCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: "#F0F9FF",
  },
  optionContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  optionIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  optionTextContainer: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  optionSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  optionRight: {
    marginLeft: 12,
  },
  checkContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  noteCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  noteTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: "#92400E",
    marginBottom: 4,
  },
  noteText: {
    fontSize: 13,
    color: "#92400E",
    lineHeight: 20,
  },
  bottomContainer: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0 -2px 8px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  continueButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  continueButtonDisabled: {
    backgroundColor: Colors.border,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  continueButtonTextDisabled: {
    color: Colors.textSecondary,
  },
});
