import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Send,
  Paperclip,
  Image as ImageIcon,
  File,
  X,
  Smile,
  Users,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Colors from '@/constants/colors';
import {
  chatGroups,
  chatMessages,
  ChatMessage,
  currentUserId,
} from '@/mocks/chatGroups';

const MessageItem = React.memo(
  ({ item, isGroup }: { item: ChatMessage; isGroup: boolean }) => {
    const isMyMessage = item.senderId === currentUserId;

    const formatFileSize = (bytes?: number): string => {
      if (!bytes) return '';
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer,
        ]}
      >
        {!isMyMessage && isGroup && (
          <Text style={styles.senderNameLabel}>{item.senderName}</Text>
        )}

        <View
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
          ]}
        >
          {item.attachments && item.attachments.length > 0 && (
            <View style={styles.attachmentContainer}>
              {item.attachments.map((attachment) => {
                if (attachment.type.startsWith('image/')) {
                  return (
                    <Image
                      key={attachment.id}
                      source={{ uri: attachment.uri }}
                      style={styles.imageAttachment}
                      resizeMode="cover"
                    />
                  );
                } else {
                  return (
                    <View key={attachment.id} style={styles.documentAttachment}>
                      <File color={Colors.primary} size={24} />
                      <View style={styles.documentInfo}>
                        <Text style={styles.documentName} numberOfLines={1}>
                          {attachment.name}
                        </Text>
                        <Text style={styles.documentSize}>
                          {formatFileSize(attachment.size)}
                        </Text>
                      </View>
                    </View>
                  );
                }
              })}
            </View>
          )}

          {item.content ? (
            <Text
              style={[
                styles.messageText,
                isMyMessage ? styles.myMessageText : styles.otherMessageText,
              ]}
            >
              {item.content}
            </Text>
          ) : null}

          <Text
            style={[
              styles.messageTime,
              isMyMessage ? styles.myMessageTime : styles.otherMessageTime,
            ]}
          >
            {item.timestamp.toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.item.status === nextProps.item.status &&
      prevProps.isGroup === nextProps.isGroup
    );
  }
);

MessageItem.displayName = 'MessageItem';

export default function ChatConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const group = chatGroups.find((g) => g.id === id);
  const [messages, setMessages] = useState<ChatMessage[]>(
    chatMessages[id] || []
  );
  const [inputText, setInputText] = useState<string>('');
  const [attachments, setAttachments] = useState<{
    id: string;
    name: string;
    type: string;
    uri: string;
    size?: number;
  }[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);

  const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓'];
  
  const stickers = [
    { emoji: '❤️', name: 'love' },
    { emoji: '🔥', name: 'fire' },
    { emoji: '👍', name: 'thumbs up' },
    { emoji: '👏', name: 'clap' },
    { emoji: '🎉', name: 'party' },
    { emoji: '🎊', name: 'celebrate' },
    { emoji: '✨', name: 'sparkles' },
    { emoji: '⭐', name: 'star' },
    { emoji: '💯', name: '100' },
    { emoji: '💪', name: 'strong' },
    { emoji: '🙏', name: 'pray' },
    { emoji: '👌', name: 'ok' },
    { emoji: '✌️', name: 'peace' },
    { emoji: '🤝', name: 'handshake' },
    { emoji: '🎯', name: 'target' },
    { emoji: '🚀', name: 'rocket' },
    { emoji: '💎', name: 'gem' },
    { emoji: '🏆', name: 'trophy' },
    { emoji: '🎁', name: 'gift' },
    { emoji: '🌟', name: 'glowing star' },
    { emoji: '💫', name: 'dizzy' },
    { emoji: '🌈', name: 'rainbow' },
    { emoji: '☀️', name: 'sun' },
    { emoji: '🌙', name: 'moon' },
    { emoji: '⚡', name: 'lightning' },
    { emoji: '🌸', name: 'blossom' },
    { emoji: '🌺', name: 'flower' },
    { emoji: '🌹', name: 'rose' },
    { emoji: '🍀', name: 'clover' },
    { emoji: '🎈', name: 'balloon' },
    { emoji: '🎀', name: 'ribbon' },
    { emoji: '💝', name: 'gift heart' },
    { emoji: '💖', name: 'sparkling heart' },
    { emoji: '💗', name: 'growing heart' },
    { emoji: '💓', name: 'beating heart' },
    { emoji: '💞', name: 'revolving hearts' },
    { emoji: '💕', name: 'two hearts' },
    { emoji: '💌', name: 'love letter' },
    { emoji: '🎶', name: 'music' },
    { emoji: '🎵', name: 'note' },
  ];

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <MessageItem item={item} isGroup={group?.type === 'group'} />
    ),
    [group?.type]
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: 80,
      offset: 80 * index,
      index,
    }),
    []
  );

  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  if (!group) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text>Không tìm thấy cuộc trò chuyện</Text>
      </View>
    );
  }

  const handleSend = () => {
    if (!inputText.trim() && attachments.length === 0) return;

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: currentUserId,
      senderName: 'Nguyễn Văn A',
      content: inputText.trim(),
      timestamp: new Date(),
      type: attachments.length > 0
        ? attachments[0].type.startsWith('image/')
          ? 'image'
          : 'document'
        : 'text',
      attachments: attachments.length > 0 ? attachments : undefined,
      status: 'sent',
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText('');
    setAttachments([]);
    setShowEmojiPicker(false);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSelectEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Thông báo', 'Cần cấp quyền truy cập thư viện ảnh');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setAttachments([
        {
          id: `attach-${Date.now()}`,
          name: asset.fileName || `image-${Date.now()}.jpg`,
          type: 'image/jpeg',
          uri: asset.uri,
        },
      ]);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled === false && result.assets[0]) {
        const asset = result.assets[0];
        setAttachments([
          {
            id: `attach-${Date.now()}`,
            name: asset.name,
            type: asset.mimeType || 'application/octet-stream',
            uri: asset.uri,
            size: asset.size,
          },
        ]);
      }
    } catch (error) {
      console.error('Error picking document:', error);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerInfo}
          onPress={() => {
            if (group.type === 'group') {
              router.push(`/chat/manage-members/${group.id}`);
            }
          }}
          disabled={group.type !== 'group'}
        >
          <Text style={styles.headerTitle} numberOfLines={1}>
            {group.name}
          </Text>
          {group.type === 'group' && (
            <Text style={styles.headerSubtitle}>
              {group.members.length} thành viên
            </Text>
          )}
        </TouchableOpacity>
        {group.type === 'group' && (
          <TouchableOpacity
            style={styles.manageMembersButton}
            onPress={() => router.push(`/chat/manage-members/${group.id}`)}
          >
            <Users color={Colors.primary} size={22} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />

      {showEmojiPicker && (
        <View style={styles.emojiPickerContainer}>
          <View style={styles.emojiPickerHeader}>
            <Text style={styles.emojiPickerTitle}>Emoji & Stickers</Text>
            <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
              <X color={Colors.textSecondary} size={20} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.emojiSection}>
            <Text style={styles.emojiSectionTitle}>😊 Emoji</Text>
            <View style={styles.emojiGrid}>
              {emojis.map((emoji, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.emojiButton}
                  onPress={() => handleSelectEmoji(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.emojiSection}>
            <Text style={styles.emojiSectionTitle}>✨ Stickers</Text>
            <View style={styles.emojiGrid}>
              {stickers.map((sticker, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.stickerButton}
                  onPress={() => handleSelectEmoji(sticker.emoji)}
                >
                  <Text style={styles.stickerText}>{sticker.emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {attachments.length > 0 && (
        <View style={styles.attachmentPreview}>
          {attachments.map((attachment) => {
            if (attachment.type.startsWith('image/')) {
              return (
                <View key={attachment.id} style={styles.previewImageContainer}>
                  <Image
                    source={{ uri: attachment.uri }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.removeAttachmentButton}
                    onPress={() => handleRemoveAttachment(attachment.id)}
                  >
                    <X color={Colors.white} size={16} />
                  </TouchableOpacity>
                </View>
              );
            } else {
              return (
                <View key={attachment.id} style={styles.previewDocument}>
                  <File color={Colors.primary} size={20} />
                  <Text style={styles.previewDocumentName} numberOfLines={1}>
                    {attachment.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveAttachment(attachment.id)}
                  >
                    <X color={Colors.textLight} size={18} />
                  </TouchableOpacity>
                </View>
              );
            }
          })}
        </View>
      )}

      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.attachmentButtons}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={handlePickImage}
          >
            <ImageIcon color={Colors.primary} size={22} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={handlePickDocument}
          >
            <Paperclip color={Colors.primary} size={22} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.attachButton, showEmojiPicker && styles.attachButtonActive]}
            onPress={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <Smile color={showEmojiPicker ? Colors.white : Colors.primary} size={22} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor={Colors.textLight}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() && attachments.length === 0) &&
                styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() && attachments.length === 0}
          >
            <Send color={Colors.white} size={20} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    paddingVertical: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  manageMembersButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContent: {
    padding: 16,
    gap: 12,
  },
  messageContainer: {
    maxWidth: '80%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  senderNameLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubble: {
    borderRadius: 16,
    padding: 12,
  },
  myMessageBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  myMessageText: {
    color: Colors.white,
  },
  otherMessageText: {
    color: Colors.text,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: Colors.textLight,
  },
  attachmentContainer: {
    marginBottom: 8,
  },
  imageAttachment: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  documentAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  documentSize: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  attachmentPreview: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  previewImageContainer: {
    position: 'relative',
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeAttachmentButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewDocument: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    backgroundColor: Colors.background,
    borderRadius: 8,
    maxWidth: 200,
  },
  previewDocumentName: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
  },
  inputContainer: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  attachmentButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF4ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: Colors.background,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.textLight,
    opacity: 0.5,
  },
  attachButtonActive: {
    backgroundColor: Colors.primary,
  },
  emojiPickerContainer: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    maxHeight: 360,
  },
  emojiPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  emojiPickerTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  emojiSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emojiSectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  emojiText: {
    fontSize: 28,
  },
  stickerButton: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stickerText: {
    fontSize: 32,
  },
});
