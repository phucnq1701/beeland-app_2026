import { useFocusEffect, useRouter } from "expo-router";
import { MessageCircle, X } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, AppState, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { bannerFromEvent, bannerFromPush, chatTarget, createSeen, type ChatBanner } from "@/lib/chatNotify";
import { useReducedMotion } from "@/lib/useReducedMotion";
import type { ChatEvent } from "@/sevicesSupabase/ChatService";
import { getValidSupabaseJwt } from "@/sevicesSupabase/cloudTenant";
import { colors, elevation, motion, radius, space } from "@/theme";

import {
  getActiveChat, isChatLoggedOut, notifications, onChatAuthChanged, registerChatPush, setActiveChat,
} from "./chatPush";
import { useChatSession } from "./useChat";

/** Banner hiện trong 4,5 s rồi tự ẩn. */
const SHOW_MS = 4500;

const seen = createSeen();

/**
 * Thông báo tin nhắn toàn app (gắn ở app/_layout.tsx):
 * - đang mở app: banner trên cùng từ realtime `chat:u` (`message_new`) và từ push nhận lúc đang mở (ẩn banner hệ thống,
 *   khử trùng theo id tin); không hiện cho hội thoại đang mở;
 * - bấm banner / bấm push (kể cả mở app từ push) → mở đúng hội thoại;
 * - mở app / đăng nhập lại → đăng ký push cho NV hiện tại (`registerChatPush`).
 */
export function ChatNotifier() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [banner, setBanner] = useState<ChatBanner | null>(null);
  const [epoch, setEpoch] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (reduceMotion) {
      anim.setValue(0);
      setBanner(null);
      return;
    }
    Animated.timing(anim, { toValue: 0, duration: motion.exit, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setBanner(null);
    });
  }, [anim, reduceMotion]);

  const show = useCallback(
    (b: ChatBanner | null) => {
      if (!b || isChatLoggedOut() || !seen.add(b.key) || b.conversationId === getActiveChat()) return;
      if (AppState.currentState !== "active") return;
      if (timer.current) clearTimeout(timer.current);
      setBanner(b);
      AccessibilityInfo.announceForAccessibility(`${b.title}: ${b.body}`);
      if (reduceMotion) anim.setValue(1);
      else {
        anim.setValue(0);
        Animated.timing(anim, { toValue: 1, duration: motion.enter, useNativeDriver: true }).start();
      }
      timer.current = setTimeout(hide, SHOW_MS);
    },
    [anim, hide, reduceMotion],
  );

  const open = useCallback(
    async (conversationId: string | null) => {
      if (!conversationId || isChatLoggedOut() || !(await getValidSupabaseJwt())) return;
      if (conversationId === getActiveChat()) return;
      router.push(`/chat/${conversationId}` as never);
    },
    [router],
  );

  // Đăng nhập / đăng xuất → dựng lại kênh realtime (epoch) + đăng ký push cho NV mới.
  useEffect(() => {
    void registerChatPush();
    return onChatAuthChanged(() => {
      setBanner(null);
      setEpoch((e) => e + 1);
      void registerChatPush();
    });
  }, []);

  // Quay lại app → đăng ký lại (làm mới quyền BeeChat chụp ở máy chủ, token có thể đổi).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void registerChatPush(false);
    });
    return () => sub.remove();
  }, []);

  // Push: lúc đang mở → banner của app (không hiện banner hệ thống); bấm push → mở hội thoại.
  useEffect(() => {
    const n = notifications();
    if (!n) return;
    try {
      n.setNotificationHandler({
        handleNotification: async (notif) => {
          const b = bannerFromPush(notif.request.content);
          if (b) {
            show(b);
            return { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
          }
          return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
        },
      });
      const sub = n.addNotificationResponseReceivedListener((r) => {
        void open(chatTarget(r.notification.request.content.data));
      });
      // Mở app từ push khi app đã tắt hẳn
      const last = n.getLastNotificationResponse();
      if (last) {
        n.clearLastNotificationResponse();
        setTimeout(() => void open(chatTarget(last.notification.request.content.data)), 300);
      }
      return () => sub.remove();
    } catch (e) {
      console.log("[ChatNotifier] push không dùng được:", e instanceof Error ? e.message : String(e));
    }
  }, [open, show]);

  return (
    <>
      {isChatLoggedOut() ? null : <LiveEvents key={epoch} onBanner={show} />}
      {banner ? (
        <View pointerEvents="box-none" style={[styles.host, { top: insets.top + space.sm }]}>
          <Animated.View
            accessibilityLiveRegion="polite"
            style={{
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Tin nhắn mới từ ${banner.title}. Mở cuộc trò chuyện`}
              onPress={() => {
                const id = banner.conversationId;
                hide();
                void open(id);
              }}
              style={[styles.card, elevation.overlay]}
            >
              <View style={styles.icon}>
                <MessageCircle size={20} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text variant="subhead" numberOfLines={1}>{banner.title}</Text>
                <Text variant="caption" color="textSecondary" numberOfLines={2}>{banner.body}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Đóng thông báo" hitSlop={12} onPress={hide}>
                <X size={18} color={colors.textTertiary} />
              </Pressable>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </>
  );
}

/** Kênh realtime `chat:u` dùng chung (đếm tham chiếu) – sống suốt phiên; remount khi đổi tài khoản. */
function LiveEvents({ onBanner }: { onBanner: (b: ChatBanner | null) => void }) {
  const meRef = useRef<string | null>(null);
  const { me } = useChatSession((e: ChatEvent) => {
    if (e.event === "message_new") onBanner(bannerFromEvent(e.payload, meRef.current));
  });
  meRef.current = me?.employee_id ?? null;
  return null;
}

/** Màn hội thoại: đang mở `id` → không hiện banner / không mở lại chính nó khi bấm push. */
export function useActiveChat(id: string | null | undefined) {
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      setActiveChat(id);
      return () => {
        if (getActiveChat() === id) setActiveChat(null);
      };
    }, [id]),
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: space.md, right: space.md, zIndex: 1000 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primarySubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1, gap: 2 },
});
