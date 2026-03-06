import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, Dimensions, Share } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { featuredProperties, Property, products } from '@/mocks/properties';
import { overviewBlocks } from '@/mocks/overviewUnits';
import { MapPin, DollarSign, Share2, Heart, Lock, Calendar, Calculator } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProductDetailScreen() {
  const { id, lockMinutes } = useLocalSearchParams<{ id?: string; lockMinutes?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  useEffect(() => {
    if (lockMinutes) {
      const minutes = parseInt(lockMinutes, 10);
      if (!isNaN(minutes) && minutes > 0) {
        setIsLocked(true);
        setRemainingSeconds(minutes * 60);
      }
    }
  }, [lockMinutes]);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flatListRef = useRef<FlatList<string>>(null);
  const screenWidth = Dimensions.get('window').width;

  const property: Property | undefined = useMemo(() => {
    const pid = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined;
    if (!pid) return undefined;

    const found = featuredProperties.find(p => p.id === pid);
    if (found) return found;

    const productMatch = products.find(p => p.id === pid);
    if (productMatch) {
      const fp = featuredProperties.find(f => f.id === productMatch.id);
      if (fp) return fp;
    }

    for (const block of overviewBlocks) {
      for (const floor of block.floors) {
        const unit = floor.units.find(u => u.id === pid);
        if (unit) {
          const priceNum = parseFloat(unit.price.replace(',', '.')) * 1000000000;
          return {
            id: unit.id,
            title: `${block.name} - ${unit.code}`,
            location: `${floor.name}, ${block.name}`,
            price: `${unit.price} tỷ`,
            image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop',
            images: [
              'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop',
              'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
              'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop',
            ],
            area: 72,
            clearArea: 65.8,
            priceValue: priceNum,
            code: unit.code,
          };
        }
      }
    }

    return undefined;
  }, [id]);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(value);
  };

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (isLocked && remainingSeconds > 0) {
      timerRef.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            setIsLocked(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isLocked, remainingSeconds]);

  if (!property) {
    return (
      <View style={styles.missingContainer} testID="product-not-found">
        <Text style={styles.missingTitle}>Không tìm thấy sản phẩm</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} testID="go-back">
          <Text style={styles.backBtnText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleLock = () => {
    if (!isLocked && property) {
      console.log('[Product] Lock pressed', { id: property.id });
      setIsLocked(true);
      setRemainingSeconds(15 * 60);
    }
  };

  const displayImages = property.images && property.images.length > 0 ? property.images : [property.image];

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / screenWidth);
    setCurrentImageIndex(index);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: property.title }} />

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard} testID="product-hero">
          <FlatList
            ref={flatListRef}
            data={displayImages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            keyExtractor={(item, index) => `image-${index}`}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={[styles.heroImage, { width: screenWidth }]} contentFit="cover" />
            )}
          />
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={styles.heroOverlay} pointerEvents="none" />
          
          <View style={[styles.heroActions, { top: insets.top + 12 }]}>
            <TouchableOpacity
              testID="action-favorite"
              style={[styles.heroIconBtn]}
              onPress={() => {
                setIsFavorite(!isFavorite);
                console.log('[Product] Favorite toggled', { id: property.id, isFavorite: !isFavorite });
              }}
            >
              <Heart 
                color={isFavorite ? '#8B5CF6' : Colors.white} 
                size={22} 
                fill={isFavorite ? '#8B5CF6' : 'transparent'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              testID="action-share"
              style={[styles.heroIconBtn]}
              onPress={async () => {
                console.log('[Product] Share pressed', { id: property.id });
                try {
                  const shareUrl = `https://app.com/product/${property.id}`;
                  const shareMessage = `${property.title} - ${property.price}\n${property.location}\n${shareUrl}`;
                  
                  await Share.share({
                    message: shareMessage,
                    url: shareUrl,
                    title: property.title,
                  });
                } catch (error) {
                  console.error('[Product] Share error:', error);
                }
              }}
            >
              <Share2 color={Colors.white} size={20} />
            </TouchableOpacity>
          </View>

          {displayImages.length > 1 && (
            <View style={styles.paginationDots}>
              {displayImages.map((_, index) => (
                <View
                  key={`dot-${index}`}
                  style={[
                    styles.dot,
                    index === currentImageIndex && styles.activeDot,
                  ]}
                />
              ))}
            </View>
          )}

          <View style={styles.heroInfo}>
            <Text style={styles.heroTitle}>{property.title}</Text>
            <View style={styles.rowCenter}>
              <MapPin color={Colors.white} size={16} />
              <Text style={styles.heroSubtitle}>{property.location}</Text>
            </View>
            <View style={styles.pricePill}>
              <DollarSign color={Colors.white} size={16} />
              <Text style={styles.priceText}>{property.price}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin căn hộ</Text>
          <Text style={styles.sectionText}>
            Căn hộ tiêu chuẩn hiện đại, tiện ích nội khu đầy đủ, vị trí kết nối thuận tiện.
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Chi tiết giá</Text>
            <TouchableOpacity
              testID="action-calculator"
              style={styles.calculatorBtn}
              onPress={() => {
                console.log('[Product] Calculator pressed', { id: property.id });
                router.push(`/price-calculator/${property.id}`);
              }}
            >
              <Calculator color={Colors.primary} size={20} />
              <Text style={styles.calculatorBtnText}>Tính giá</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.priceDetails}>
            {property.clearArea && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Diện tích thông thủy:</Text>
                <Text style={styles.detailValue}>{property.clearArea} m²</Text>
              </View>
            )}
            {property.priceValue && (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tổng giá gồm VAT:</Text>
                  <Text style={styles.detailValue}>{formatCurrency(property.priceValue)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tiền VAT (10%):</Text>
                  <Text style={styles.detailValue}>{formatCurrency(property.priceValue * 0.1)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Phí bảo trì (2%):</Text>
                  <Text style={styles.detailValue}>{formatCurrency(property.priceValue * 0.02)}</Text>
                </View>
                <View style={[styles.detailRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Tổng giá trị hợp đồng:</Text>
                  <Text style={styles.totalValue}>{formatCurrency(property.priceValue * 1.12)}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        <View style={styles.bottomActions}>
          <TouchableOpacity
            testID="action-lock"
            style={[styles.actionButton, styles.lockButton, isLocked && styles.lockedButton]}
            activeOpacity={isLocked ? 1 : 0.85}
            onPress={handleLock}
            disabled={isLocked}
          >
            {!isLocked ? (
              <>
                <Lock color={Colors.white} size={20} />
                <Text style={styles.actionButtonText}>Lock</Text>
              </>
            ) : (
              <>
                <Lock color={Colors.white} size={20} />
                <Text style={styles.actionButtonText}>{Math.ceil(remainingSeconds / 60)} phút</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            testID="action-book"
            style={[styles.actionButton, styles.bookButton]}
            activeOpacity={0.85}
            onPress={() => {
              console.log('[Product] Book pressed', { id: property.id });
              router.push('/booking/create');
            }}
          >
            <Calendar color={Colors.white} size={20} />
            <Text style={styles.actionButtonText}>Book ngay</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 24 },
  heroCard: {
    height: 320,
    backgroundColor: Colors.white,
  },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  heroInfo: {
    position: 'absolute' as const,
    left: 20,
    right: 20,
    bottom: 20,
  },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  heroTitle: { fontSize: 26, fontWeight: '800' as const, color: Colors.white },
  heroSubtitle: { color: Colors.white, opacity: 0.95 },
  pricePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  priceText: { color: Colors.white, fontWeight: '700' as const },
  section: { paddingHorizontal: 20, paddingTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  calculatorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  calculatorBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  sectionText: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22 },
  heroActions: {
    position: 'absolute' as const,
    right: 16,
    flexDirection: 'row',
    gap: 10,
    zIndex: 10,
  },
  heroIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  ctaBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ctaPrimary: { backgroundColor: Colors.primary },
  ctaPrimaryText: { color: Colors.white, fontWeight: '700' as const, fontSize: 16 },
  iconBtn: { width: 56, height: 56, borderRadius: 14, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  missingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  missingTitle: { fontSize: 18, color: Colors.text, marginBottom: 12, fontWeight: '600' as const },
  backBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  backBtnText: { color: Colors.white, fontWeight: '700' as const },
  priceDetails: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
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
  totalRow: {
    borderBottomWidth: 0,
    paddingTop: 12,
    marginTop: 4,
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
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  lockButton: {
    backgroundColor: '#6B7280',
  },
  bookButton: {
    backgroundColor: Colors.primary,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  lockedButton: {
    backgroundColor: '#8B5CF6',
  },
  countdownText: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  paginationDots: {
    position: 'absolute' as const,
    bottom: 90,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  activeDot: {
    backgroundColor: Colors.white,
    width: 24,
  },
});
