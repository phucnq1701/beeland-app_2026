import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, EyeOff, ChevronLeft, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);

  const isFormValid =
    fullName.trim() !== '' &&
    phone.trim() !== '' &&
    email.trim() !== '' &&
    password.trim() !== '' &&
    confirmPassword.trim() !== '' &&
    agreeTerms &&
    agreePrivacy;

  const handleRegister = () => {
    if (!isFormValid) {
      Alert.alert('Thông báo', 'Vui lòng điền đầy đủ thông tin và đồng ý các điều khoản.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Thông báo', 'Mật khẩu xác nhận không khớp.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Thông báo', 'Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    console.log('[Register] Registering with:', { fullName, phone, email });
    Alert.alert('Thành công', 'Đăng ký tài khoản thành công!', [
      { text: 'Đăng nhập', onPress: () => router.back() },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            testID="register-back-button"
          >
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>

          <View style={styles.headerContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>BEELAND</Text>
            </View>
            <Text style={styles.titleText}>Đăng ký tài khoản</Text>
            <Text style={styles.subText}>Tạo tài khoản mới để bắt đầu sử dụng</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Họ và tên <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập họ và tên"
                placeholderTextColor={Colors.textLight}
                value={fullName}
                onChangeText={setFullName}
                testID="register-fullname-input"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Số điện thoại <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập số điện thoại"
                placeholderTextColor={Colors.textLight}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                testID="register-phone-input"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập email"
                placeholderTextColor={Colors.textLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                testID="register-email-input"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Mật khẩu <Text style={styles.required}>*</Text></Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
                  placeholderTextColor={Colors.textLight}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  testID="register-password-input"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={Colors.textSecondary} />
                  ) : (
                    <Eye size={20} color={Colors.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Xác nhận mật khẩu <Text style={styles.required}>*</Text></Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Nhập lại mật khẩu"
                  placeholderTextColor={Colors.textLight}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  testID="register-confirm-password-input"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} color={Colors.textSecondary} />
                  ) : (
                    <Eye size={20} color={Colors.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <Text style={styles.errorText}>Mật khẩu xác nhận không khớp</Text>
              )}
            </View>

            <View style={styles.termsContainer}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setAgreeTerms(!agreeTerms)}
                testID="register-terms-checkbox"
              >
                <View style={[styles.checkbox, agreeTerms && styles.checkboxChecked]}>
                  {agreeTerms && <Check size={14} color={Colors.white} />}
                </View>
                <Text style={styles.termsText}>
                  Tôi đồng ý với{' '}
                  <Text style={styles.termsLink}>Điều khoản sử dụng</Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setAgreePrivacy(!agreePrivacy)}
                testID="register-privacy-checkbox"
              >
                <View style={[styles.checkbox, agreePrivacy && styles.checkboxChecked]}>
                  {agreePrivacy && <Check size={14} color={Colors.white} />}
                </View>
                <Text style={styles.termsText}>
                  Tôi đồng ý với{' '}
                  <Text style={styles.termsLink}>Chính sách bảo mật</Text>
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.registerButton, !isFormValid && styles.registerButtonDisabled]}
              onPress={handleRegister}
              disabled={!isFormValid}
              testID="register-submit-button"
            >
              <Text style={styles.registerButtonText}>Đăng ký</Text>
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Đã có tài khoản? </Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.loginLink}>Đăng nhập</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: Colors.white,
    letterSpacing: 1,
  },
  titleText: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  subText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  formContainer: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  required: {
    color: Colors.error,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
  },
  passwordWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    marginTop: 6,
  },
  termsContainer: {
    marginTop: 4,
    marginBottom: 24,
    gap: 14,
  },
  checkboxRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  termsText: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  registerButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButtonDisabled: {
    opacity: 0.5,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  loginRow: {
    flexDirection: 'row' as const,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  loginText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
});
