import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Linking,
  AccessibilityInfo,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, typography, radii } from '../theme/tokens';
import { useNetwork } from '../contexts/NetworkContext';
import { addBreadcrumb } from '../services/sentry';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';

import { MaterialIcons } from '@expo/vector-icons';
const Icon: React.ComponentType<any> = MaterialIcons;

let Voice: any | null = null;
try {
  // @ts-ignore
  Voice = require('@react-native-voice/voice').default;
} catch {
  if (__DEV__) console.warn('Voice recognition not installed - voice features disabled');
}

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  apiAction?: string;
  apiData?: Record<string, any>;
  status?: 'sending' | 'sent' | 'error';
  error?: string;
}

interface ChatbotScreenProps {
  navigation: any;
  userId?: string;
  apiEndpoint?: string;
}

interface VoiceState {
  isRecording: boolean;
  isAvailable: boolean;
  error: string | null;
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  connectionError: boolean;
  retryCount: number;
}

const MAX_MESSAGE_LENGTH = 500;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 2000;
const MESSAGE_DEBOUNCE_MS = 300;
const AUTO_SCROLL_DELAY = 100;
const SESSION_TIMEOUT = 30 * 60 * 1000;
const DEFAULT_API_ENDPOINT = 'http://localhost:3000/api/chatbot';

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'pidgin', name: 'Nigerian Pidgin', nativeName: 'Naija Pidgin' },
  { code: 'ig', name: 'Igbo', nativeName: 'Igbo' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorọbá' },
];

export default function ChatbotScreen({
  navigation,
  userId,
  apiEndpoint = DEFAULT_API_ENDPOINT
}: ChatbotScreenProps) {
  const { t, i18n } = useTranslation();
  const { isOnline } = useNetwork();

  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    connectionError: false,
    retryCount: 0,
  });

  const [inputText, setInputText] = useState('');
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isRecording: false,
    isAvailable: Voice !== null,
    error: null,
  });

  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionActive, setSessionActive] = useState(true);

  const scrollViewRef = useRef<ScrollView>(null);
  const isMountedRef = useRef(true);
  const sendTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const messageQueueRef = useRef<Message[]>([]);
  const lastMessageTimeRef = useRef<number>(Date.now());

  const getWelcomeMessage = useCallback((): string => {
    return t('chatbot.welcomeMessage');
  }, [t]);

  const initializeVoice = useCallback(() => {
    if (!Voice) return;

    try {
      Voice.onSpeechStart = () => {
        if (!isMountedRef.current) return;
        setVoiceState(prev => ({ ...prev, isRecording: true, error: null }));
        addBreadcrumb({
          category: 'chatbot',
          message: 'Voice recording started',
          level: 'info',
        });
      };

      Voice.onSpeechEnd = () => {
        if (!isMountedRef.current) return;
        setVoiceState(prev => ({ ...prev, isRecording: false }));
        addBreadcrumb({
          category: 'chatbot',
          message: 'Voice recording ended',
          level: 'info',
        });
      };

      Voice.onSpeechResults = (e: { value?: string[] }) => {
        if (!isMountedRef.current || !e.value || !e.value[0]) return;

        const transcript = e.value[0];
        setInputText(transcript);

        addBreadcrumb({
          category: 'chatbot',
          message: 'Voice transcript received',
          level: 'info',
          data: { transcriptLength: transcript.length },
        });
      };

      Voice.onSpeechError = (e: { error?: { message?: string } }) => {
        if (!isMountedRef.current) return;

        const errorMessage = e.error?.message || t('chatbot.voiceError');
        setVoiceState(prev => ({
          ...prev,
          isRecording: false,
          error: errorMessage,
        }));

        addBreadcrumb({
          category: 'chatbot',
          message: 'Voice recognition error',
          level: 'error',
          data: { error: errorMessage },
        });
      };
    } catch (error) {
      if (__DEV__) console.error('Voice initialization error:', error);
    }
  }, [t]);

  /**
   * Handle API action dialogs
   */
  const handleAPIAction = useCallback((action: string, data: Record<string, any>) => {
    switch (action) {
      case 'einvoice_submit':
        Alert.alert(
          t('chatbot.actions.einvoice.title'),
          t('chatbot.actions.einvoice.message', {
            irn: data.irn,
            reference: data.nrsReference,
          }),
          [
            { text: t('common.ok'), style: 'default' },
            {
              text: t('chatbot.actions.einvoice.view'),
              onPress: () => navigation.navigate('Invoices'),
              style: 'default',
            },
          ]
        );
        break;

      case 'payment_generate':
        Alert.alert(
          t('chatbot.actions.payment.title'),
          t('chatbot.actions.payment.message', {
            rrr: data.rrr,
            amount: data.amount,
          }),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('chatbot.actions.payment.pay'),
              onPress: async () => {
                if (data.paymentUrl) {
                  try {
                    await Linking.openURL(data.paymentUrl);
                  } catch {
                    Alert.alert(
                      t('chatbot.actions.payment.title'),
                      t('common.somethingWentWrong')
                    );
                  }
                }
              },
              style: 'default',
            },
          ]
        );
        break;

      default:
        if (__DEV__) console.warn('Unknown API action:', action);
    }
  }, [navigation, t]);

  const sendMessageToAPI = useCallback(async (text: string, messageId?: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (!isOnline) {
      setChatState(prev => ({
        ...prev,
        isLoading: false,
        connectionError: true,
        messages: messageId
          ? prev.messages.map((message): Message =>
              message.id === messageId
                ? { ...message, status: 'error', error: t('chatbot.connectionIssue') }
                : message
            )
          : prev.messages,
      }));
      return;
    }

    setChatState(prev => ({
      ...prev,
      isLoading: true,
      connectionError: false,
      messages: messageId
        ? prev.messages.map((message): Message =>
            message.id === messageId
              ? { ...message, status: 'sending', error: undefined }
              : message
          )
        : prev.messages,
    }));
    setIsTyping(true);

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: trimmed,
          userId,
          language: i18n.language,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json().catch(() => ({}));
      const replyText = result.reply ?? result.message ?? t('chatbot.defaultResponse');
      const apiAction = result.apiAction ?? result.action;
      const apiData = result.apiData ?? result.data ?? {};

      setChatState(prev => ({
        ...prev,
        isLoading: false,
        connectionError: false,
        retryCount: 0,
        messages: [
          ...prev.messages.map((message): Message =>
            message.id === messageId
              ? { ...message, status: 'sent', error: undefined }
              : message
          ),
          {
            id: `bot-${Date.now()}`,
            text: replyText,
            isUser: false,
            timestamp: new Date(),
            status: 'sent',
            apiAction,
            apiData,
          },
        ],
      }));

      if (apiAction) {
        handleAPIAction(apiAction, apiData);
      }
    } catch (error) {
      setChatState(prev => ({
        ...prev,
        isLoading: false,
        connectionError: true,
        retryCount: prev.retryCount + 1,
        messages: prev.messages.map((message): Message =>
          message.id === messageId
            ? {
                ...message,
                status: 'error',
                error: error instanceof Error ? error.message : t('common.somethingWentWrong'),
              }
            : message
        ),
      }));
    } finally {
      setIsTyping(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, AUTO_SCROLL_DELAY);
    }
  }, [apiEndpoint, handleAPIAction, i18n.language, isOnline, t, userId]);

  const retryMessage = useCallback((messageId: string) => {
    const message = chatState.messages.find(item => item.id === messageId);
    if (!message) return;
    void sendMessageToAPI(message.text, messageId);
  }, [chatState.messages, sendMessageToAPI]);

  const startVoiceRecording = useCallback(async () => {
    if (!Voice || !sessionActive) return;
    try {
      await Voice.start('en-US');
    } catch (error) {
      setVoiceState(prev => ({
        ...prev,
        isRecording: false,
        error: error instanceof Error ? error.message : t('chatbot.voiceError'),
      }));
    }
  }, [sessionActive, t]);

  const stopVoiceRecording = useCallback(async () => {
    if (!Voice) return;
    try {
      await Voice.stop();
    } catch (error) {
      if (__DEV__) console.error('Voice stop error:', error);
    }
  }, []);

  const handleSendMessage = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed || chatState.isLoading || !sessionActive) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: trimmed,
      isUser: true,
      timestamp: new Date(),
      status: 'sending',
    };

    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
    }));
    setInputText('');
    Keyboard.dismiss();
    void sendMessageToAPI(trimmed, userMessage.id);
  }, [chatState.isLoading, inputText, sendMessageToAPI, sessionActive]);

  useEffect(() => {
    if (!Voice) return;
    initializeVoice();
  }, [initializeVoice]);

  /**
   * Retry queued messages when online
   */
  useEffect(() => {
    if (!isOnline || !messageQueueRef.current.length) return;

    const message = messageQueueRef.current.shift();
    if (!message) return;

    void sendMessageToAPI(message.text, message.id);
  }, [isOnline, sendMessageToAPI]);

  /**
   * Memoized message renderer
   */
  const renderMessage = useCallback((message: Message) => {
    const isError = message.status === 'error';
    const isSending = message.status === 'sending';

    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          message.isUser ? styles.userMessage : styles.botMessage,
        ]}
      >
        <View style={styles.messageContent}>
          <Text
            style={[
              styles.messageText,
              message.isUser ? styles.userText : styles.botText,
              isError && styles.errorText,
            ]}
            accessible={true}
            accessibilityLabel={`${message.isUser ? t('chatbot.you') : t('chatbot.assistant')}: ${message.text}`}
          >
            {message.text}
          </Text>
          
          <View style={styles.messageFooter}>
            <Text style={styles.timestamp}>
              {message.timestamp.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
            
            {isSending && (
              <View style={styles.sendingIndicator}>
                <SkeletonLoader type="inline" count={1} />
              </View>
            )}
            
            {isError && (
              <TouchableOpacity
                onPress={() => retryMessage(message.id)}
                style={styles.retryButton}
                accessibilityLabel={t('chatbot.retry')}
                accessibilityRole="button"
              >
                <Text style={styles.retryText}>{t('chatbot.retry')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }, [retryMessage, t]);

  /**
   * Memoized character counter
   */
  const characterCount = useMemo(() => {
    return inputText.length;
  }, [inputText.length]);

  const characterCountColor = useMemo(() => {
    if (characterCount > MAX_MESSAGE_LENGTH * 0.9) return colors.error;
    if (characterCount > MAX_MESSAGE_LENGTH * 0.7) return colors.warning;
    return colors.textMuted;
  }, [characterCount]);

  /**
   * Icon fallback component
   */
  const IconFallback = ({ name, size = 24, color = colors.textPrimary }: any) => {
    if (Icon) {
      return <Icon name={name} size={size} color={color} />;
    }
    
    const iconMap: Record<string, string> = {
      'arrow-back': '←',
      'language': '🌐',
      'mic': '🎤',
      'mic-none': '🎙️',
      'send': '→',
    };
    
    return ( 
      <Text style={[styles.iconFallback, { fontSize: size, color }]}>
        {iconMap[name] || '•'} 
      </Text> 
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          accessibilityLabel={t('common.back')}
          accessibilityRole="button"
        >
          <IconFallback name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('chatbot.title')}</Text>
          {!isOnline && (
            <Text style={styles.offlineIndicator}>{t('common.offline')}</Text>
          )}
        </View>
        
        <TouchableOpacity 
          onPress={() => setShowLanguageModal(true)}
          accessibilityLabel={t('chatbot.changeLanguage')}
          accessibilityRole="button"
        >
          <IconFallback name="language" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
      >
        {chatState.messages.map(renderMessage)}
        
        {isTyping && (
          <View style={[styles.messageContainer, styles.botMessage]}>
            <View style={styles.typingIndicator}>
              <SkeletonLoader type="inline" count={1} />
              <Text style={styles.typingText}>{t('chatbot.typing')}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Connection Error Banner */}
      {chatState.connectionError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>
            {t('chatbot.connectionIssue')}
          </Text>
        </View>
      )}

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={(text) => {
            if (text.length <= MAX_MESSAGE_LENGTH) {
              setInputText(text);
            }
          }}
          placeholder={t('chatbot.inputPlaceholder')}
          placeholderTextColor={colors.disabled}
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          editable={sessionActive && !chatState.isLoading}
          accessibilityLabel={t('chatbot.messageInput')}
          accessibilityHint={t('chatbot.messageInputHint')}
        />

        {/* Character Counter */}
        <Text style={[styles.characterCount, { color: characterCountColor }]}>
          {characterCount}/{MAX_MESSAGE_LENGTH}
        </Text>
        
        {/* Voice Button */}
        {voiceState.isAvailable && (
          <TouchableOpacity
            style={[
              styles.iconButton, 
              voiceState.isRecording && styles.recordingButton
            ]}
            onPressIn={startVoiceRecording}
            onPressOut={stopVoiceRecording}
            disabled={!sessionActive}
            accessibilityLabel={t('chatbot.voiceInput')}
            accessibilityRole="button"
            accessibilityState={{ disabled: !sessionActive }}
          >
            <IconFallback
              name={voiceState.isRecording ? 'mic' : 'mic-none'}
              size={24}
              color={voiceState.isRecording ? colors.error : colors.primary}
            />
          </TouchableOpacity>
        )}

        {/* Send Button */}
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!inputText.trim() || !sessionActive) && styles.disabledButton,
          ]}
          onPress={handleSendMessage}
          disabled={!inputText.trim() || chatState.isLoading || !sessionActive}
          accessibilityLabel={t('chatbot.send')}
          accessibilityRole="button"
          accessibilityState={{ 
            disabled: !inputText.trim() || !sessionActive 
          }}
        >
          <IconFallback name="send" size={20} color={colors.surface} />
        </TouchableOpacity>
      </View>

      {/* Language Modal */}
      <Modal
        visible={showLanguageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
        accessibilityViewIsModal
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowLanguageModal(false)}
        >
          <View 
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>{t('chatbot.selectLanguage')}</Text>

            {SUPPORTED_LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.languageOption,
                  i18n.language === lang.code && styles.languageOptionActive,
                ]}
                onPress={() => {
                  i18n.changeLanguage(lang.code);
                  setShowLanguageModal(false);
                  
                  // Update welcome message
                  setChatState(prev => ({
                    ...prev,
                    messages: [
                      {
                        id: 'welcome-1',
                        text: getWelcomeMessage(),
                        isUser: false,
                        timestamp: new Date(),
                        status: 'sent',
                      },
                      ...prev.messages.slice(1),
                    ],
                  }));

                  addBreadcrumb({
                    category: 'chatbot',
                    message: 'Language changed',
                    level: 'info',
                    data: { language: lang.code },
                  });
                }}
                accessibilityLabel={`${lang.name} (${lang.nativeName})`}
                accessibilityRole="button"
                accessibilityState={{ selected: i18n.language === lang.code }}
              >
                <Text style={styles.languageText}>{lang.name}</Text>
                <Text style={styles.languageNativeText}>{lang.nativeName}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowLanguageModal(false)}
              accessibilityLabel={t('common.cancel')}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  iconFallback: {
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: colors.textPrimary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  offlineIndicator: {
    fontSize: typography.size.xs,
    color: colors.warning,
    marginTop: 2,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  messagesContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  messageContainer: {
    marginVertical: spacing.xs,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  botMessage: {
    alignSelf: 'flex-start',
  },
  messageContent: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userMessageContent: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  botMessageContent: {
    backgroundColor: colors.surfaceMuted,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: typography.size.md,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  userText: {
    color: colors.surface,
  },
  botText: {
    color: colors.textSecondary,
  },
  errorText: {
    color: colors.error,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  timestamp: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  sendingIndicator: {
    marginLeft: spacing.xs,
  },
  retryButton: {
    marginLeft: 'auto',
  },
  retryText: {
    fontSize: typography.size.xs,
    color: colors.primary,
    fontWeight: typography.weight.semibold,
    textDecorationLine: 'underline',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  typingText: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  errorBanner: {
    backgroundColor: colors.errorBgSubtle,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.error,
  },
  errorBannerText: {
    fontSize: typography.size.sm,
    color: colors.error,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: colors.textPrimary,
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    fontSize: typography.size.md,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceMuted,
  },
  characterCount: {
    position: 'absolute',
    bottom: spacing.lg + 4,
    left: spacing.lg + spacing.md,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  iconButton: {
    padding: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingButton: {
    backgroundColor: colors.errorBgSubtle,
  },
  sendButton: {
    padding: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: colors.disabled,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlayMedium,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.lg,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  languageOption: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  languageOptionActive: {
    backgroundColor: colors.primaryBgSubtle,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  languageText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
  },
  languageNativeText: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  cancelButton: {
    padding: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSecondary,
  },
  cancelText: {
    fontSize: typography.size.md,
    color: colors.primary,
    textAlign: 'center',
    fontWeight: typography.weight.semibold,
  },
});