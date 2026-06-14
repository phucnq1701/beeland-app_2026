import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Colors from "@/constants/colors";
import { AuthService } from "@/sevices/AuthService";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [companyCode, setCompanyCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);


  const handleLogin = async () => {
    
    if (!companyCode || !username || !password) {
      Alert.alert("Thông báo", "Vui lòng nhập đầy đủ thông tin");
      return;
    }

  
    try {
      setLoading(true);
  
      const res = await AuthService.login({
        TenCTDKVT: companyCode.trim(),
        Email: username.trim(),
        Password: password,
      });
  
      if (res?.status === 200) {
        const token = res?.acessToken;
        
        if (token) {
          await AsyncStorage.setItem("@token", token);
        }
  
        router.replace("/(tabs)/home");
      } else {
        Alert.alert("Thông báo", res?.message || "Đăng nhập thất bại");
      }
  
    } catch (error) {
      console.log("Login error:", error);
      Alert.alert("Lỗi", "Không kết nối được server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image
            source={require('@/assets/images/beeland-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.welcomeText}>Đăng nhập</Text>
          <Text style={styles.subText}>
            Vui lòng nhập thông tin để tiếp tục
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Mã công ty</Text>

            <TextInput
              style={styles.input}
              placeholder="Nhập mã công ty"
              placeholderTextColor={Colors.textLight}
              value={companyCode}
              onChangeText={setCompanyCode}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Tài khoản</Text>

            <TextInput
              style={styles.input}
              placeholder="Nhập tài khoản"
              placeholderTextColor={Colors.textLight}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Mật khẩu</Text>

            <TextInput
              style={styles.input}
              placeholder="Nhập mật khẩu"
              placeholderTextColor={Colors.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={styles.forgotPassword}
            onPress={() => router.push("/forgot-password")}
          >
            <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Đăng nhập</Text>
            )}
          </TouchableOpacity>

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>Chưa có tài khoản? </Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={styles.registerLink}>Đăng ký</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    paddingHorizontal: 24,
    justifyContent: "center",
  },

  logoContainer: {
    alignItems: "center",
    marginBottom: 48,
  },

  logo: {
    width: 120,
    height: 120,
    borderRadius: 24,
    marginBottom: 24,
  },

  welcomeText: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 8,
  },

  subText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },

  formContainer: {
    width: "100%",
  },

  inputContainer: {
    marginBottom: 20,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 8,
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

  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 24,
  },

  forgotPasswordText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: "500",
  },

  loginButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  loginButtonDisabled: {
    opacity: 0.7,
  },

  loginButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.white,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  registerText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
});


