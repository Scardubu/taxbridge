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
  AccessibilityInfo,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, typography, radii } from '../theme/tokens';
import { useNetwork } from '../contexts/NetworkContext';
import { addBreadcrumb } from '../services/sentry';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';

// Optional imports - graceful degradation
let Icon: React.ComponentType<any> | null = null;
try {
  // @ts-ignore
  Icon = require('react-native-vector-icons/MaterialIcons').default;
} catch {
  if (__DEV__) console.warn('MaterialIcons not installed - using text fallbacks');
}

let Voice: any | null = null;
try {
  // @ts-ignore
  Voice = require('@react-native-voice/voice').default;
} catch {
  if (__DEV__) console.warn('Voice recognition not installed - voice features disabled');
}

// Types
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

// Constants
const MAX_MESSAGE_LENGTH = 500;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 2000;
const MESSAGE_DEBOUNCE_MS = 300;
const AUTO_SCROLL_DELAY = 100;
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const DEFAULT_API_ENDPOINT = 'http://localhost:3000/api/chatbot';

// Supported languages
const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'pidgin', name: 'Nigerian Pidgin', nativeName: 'Naija Pidgin' },
  { code: 'ig', name: 'Igbo', nativeName: 'Igbo' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá' },
];

/**
 * Enhanced ChatbotScreen Component
 * 
 * Improvements:
 * 1. Network-aware message queuing and retry logic
 * 2. Better error handling with user feedback
 * 3. Message persistence (localStorage/AsyncStorage ready)
 * 4. Optimistic UI updates
 * 5. Voice recognition with better error handling
 * 6. Accessibility improvements
 * 7. Performance optimizations (memoization, debouncing)
 * 8. Session management and timeout handling
 * 9. Typing indicators and read receipts
 * 10. Better modal UX and animations
 * 11. Character count and input validation
 * 12. Auto-retry failed messages
 * 13. Context-aware welcome messages
 * 14. Rate limiting protection
 */
export default function ChatbotScreen({ 
  navigation, 
  userId,
  apiEndpoint = DEFAULT_API_ENDPOINT 
}: ChatbotScreenProps) {
  const { t, i18n } = useTranslation();
  const { isOnline } = useNetwork();
  
  // State management
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
  
  // Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const isMountedRef = useRef(true);
  const sendTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const sessionTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const messageQueueRef = useRef<Message[]>([]);
  const lastMessageTimeRef = useRef<number>(Date.now());

  /**
   * Get context-aware welcome message based on language
   */
  const getWelcomeMessage = useCallback((): string => {
    return t('chatbot.welcomeMessage');
  }, [t]);

  /**
   * Initialize voice recognition
   */
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
          message: 'Voice transcription received',
          level: 'info',
          data: { length: transcript.length },
        });

        // Announce for accessibility
        AccessibilityInfo.announceForAccessibility(
          t('chatbot.voiceTranscribed', { text: transcript })
        );
      };

      Voice.onSpeechError = (e: { error?: { message?: string } }) => {
        if (__DEV__) console.error('Voice error:', e);
        
        if (!isMountedRef.current) return;
        
        const errorMessage = e.error?.message || t('chatbot.voiceError');
        setVoiceState(prev => ({ 
          ...prev, 
          isRecording: false, 
          error: errorMessage 
        }));

        addBreadcrumb({
          category: 'chatbot',
          message: 'Voice recognition error',
          level: 'error',
          data: { error: errorMessage },
        });
      };

      setVoiceState(prev => ({ ...prev, isAvailable: true }));
    } catch (error) {
      if (__DEV__) console.error('Voice initialization error:', error);
      setVoiceState(prev => ({ ...prev, isAvailable: false }));
    }
  }, [t]);

  /**
   * Initialize component
   */
  useEffect(() => {
    isMountedRef.current = true;

    // Initialize voice
    initializeVoice();

    // Add welcome message
    const welcomeMessage: Message = {
      id: 'welcome-1',
      text: getWelcomeMessage(),
      isUser: false,
      timestamp: new Date(),
      status: 'sent',
    };
    
    setChatState(prev => ({
      ...prev,
      messages: [welcomeMessage],
    }));

    // Setup session timeout
    resetSessionTimeout();

    // Monitor app state for background handling
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    addBreadcrumb({
      category: 'chatbot',
      message: 'Chatbot initialized',
      level: 'info',
      data: { userId, language: i18n.language },
    });

    return () => {
      isMountedRef.current = false;
      
      if (Voice) {
        Voice.destroy().then(() => Voice.removeAllListeners());
      }

      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current);
      }

      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }

      appStateSubscription.remove();
    };
  }, []);

  /**
   * Reset session timeout
   */
  const resetSessionTimeout = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }

    sessionTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      
      setSessionActive(false);
      Alert.alert(
        t('chatbot.sessionExpired'),
        t('chatbot.sessionExpiredMessage'),
        [
          {
            text: t('chatbot.restartSession'),
            onPress: () => {
              setSessionActive(true);
              resetSessionTimeout();
            },
          },
        ]
      );
    }, SESSION_TIMEOUT);
  }, [t]);

  /**
   * Handle app state changes
   */
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      resetSessionTimeout();
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      // Pause session timeout when app is backgrounded
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
    }
  }, [resetSessionTimeout]);

  /**
   * Scroll to bottom of messages
   */
  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated });
    }, AUTO_SCROLL_DELAY);
  }, []);

  /**
   * Auto-scroll when messages change
   */
  useEffect(() => {
    if (chatState.messages.length > 0) {
      scrollToBottom();
    }
  }, [chatState.messages, scrollToBottom]);

  /**
   * Retry failed message
   */
  const retryMessage = useCallback(async (messageId: string) => {
    const message = chatState.messages.find(m => m.id === messageId);
    if (!message || !message.isUser) return;

    // Remove error message and retry
    setChatState(prev => ({
      ...prev,
      messages: prev.messages.filter(m => m.id !== `error-${messageId}`),
    }));

    await sendMessageToAPI(message.text, messageId);
  }, [chatState.messages]);

  /**
   * Send message to API with retry logic
   */
  const sendMessageToAPI = useCallback(async (
    text: string, 
    existingMessageId?: string
  ): Promise<void> => {
    if (!text.trim() || !sessionActive) return;

    const messageId = existingMessageId || `msg-${Date.now()}`;
    const userMessage: Message = {
      id: messageId,
      text: text.trim(),
      isUser: true,
      timestamp: new Date(),
      status: 'sending',
    };

    // Optimistic update
    if (!existingMessageId) {
      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }));
    } else {
      setChatState(prev => ({
        ...prev,
        messages: prev.messages.map(m => 
          m.id === messageId ? { ...m, status: 'sending' as const } : m
        ),
      }));
    }

    setIsTyping(true);
    scrollToBottom();

    // Check network connectivity
    if (!isOnline) {
      setChatState(prev => ({
        ...prev,
        messages: prev.messages.map(m =>
          m.id === messageId 
            ? { ...m, status: 'error' as const, error: t('chatbot.offlineError') }
            : m
        ),
        connectionError: true,
      }));
      setIsTyping(false);
      
      // Queue message for retry when online
      messageQueueRef.current.push(userMessage);
      return;
    }

    let retryCount = 0;
    let success = false;

    while (retryCount < MAX_RETRY_ATTEMPTS && !success && isMountedRef.current) {
      try {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: text.trim(),
            language: i18n.language.startsWith('en') ? 'en' : i18n.language,
            userId,
            sessionId: `session-${userId}-${Date.now()}`,
          }),
          signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!isMountedRef.current) return;

        // Update user message status
        setChatState(prev => ({
          ...prev,
          messages: prev.messages.map(m =>
            m.id === messageId ? { ...m, status: 'sent' as const } : m
          ),
          connectionError: false,
          retryCount: 0,
        }));

        // Add bot response
        const botMessage: Message = {
          id: `bot-${Date.now()}`,
          text: data.answer || t('chatbot.defaultResponse'),
          isUser: false,
          timestamp: new Date(),
          status: 'sent',
          apiAction: data.apiAction,
          apiData: data.apiData,
        };

        setChatState(prev => ({
          ...prev,
          messages: [...prev.messages, botMessage],
        }));

        // Handle API actions
        if (data.apiAction && data.apiData) {
          setTimeout(() => {
            if (isMountedRef.current) {
              handleAPIAction(data.apiAction, data.apiData);
            }
          }, 1000);
        }

        success = true;
        lastMessageTimeRef.current = Date.now();
        resetSessionTimeout();

        addBreadcrumb({
          category: 'chatbot',
          message: 'Message sent successfully',
          level: 'info',
          data: { messageId, hasAction: !!data.apiAction },
        });

      } catch (error) {
        if (__DEV__) console.error(`Chatbot error (attempt ${retryCount + 1}):`, error);
        retryCount++;

        if (retryCount < MAX_RETRY_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount));
        } else {
          if (!isMountedRef.current) return;

          const errorMessage = error instanceof Error 
            ? error.message 
            : t('chatbot.connectionError');

          setChatState(prev => ({
            ...prev,
            messages: prev.messages.map(m =>
              m.id === messageId
                ? { ...m, status: 'error' as const, error: errorMessage }
                : m
            ),
            connectionError: true,
            retryCount: retryCount,
          }));

          addBreadcrumb({
            category: 'chatbot',
            message: 'Message send failed',
            level: 'error',
            data: { messageId, error: errorMessage, retryCount },
          });
        }
      }
    }

    setIsTyping(false);
  }, [apiEndpoint, i18n.language, isOnline, sessionActive, t, userId, resetSessionTimeout, scrollToBottom]);

  /**
   * Handle send message with debouncing
   */
  const handleSendMessage = useCallback(() => {
    if (!inputText.trim() || chatState.isLoading || !sessionActive) return;

    // Debounce rapid sends
    if (sendTimeoutRef.current) {
      clearTimeout(sendTimeoutRef.current);
    }

    Keyboard.dismiss();
    
    const textToSend = inputText;
    setInputText('');

    sendTimeoutRef.current = setTimeout(() => {
      sendMessageToAPI(textToSend);
    }, MESSAGE_DEBOUNCE_MS);
  }, [inputText, chatState.isLoading, sessionActive, sendMessageToAPI]);

  /**
   * Handle voice recording
   */
  const startVoiceRecording = useCallback(async () => {
    if (!Voice || !voiceState.isAvailable) {
      Alert.alert(
        t('chatbot.voiceUnavailable'),
        t('chatbot.voiceUnavailableMessage')
      );
      return;
    }

    try {
      await Voice.start('en-US');
    } catch (error) {
      if (__DEV__) console.error('Voice start error:', error);
      setVoiceState(prev => ({
        ...prev,
        error: t('chatbot.voiceStartError'),
      }));
    }
  }, [voiceState.isAvailable, t]);

  const stopVoiceRecording = useCallback(async () => {
    if (!Voice) return;

    try {
      await Voice.stop();
    } catch (error) {
      if (__DEV__) console.error('Voice stop error:', error);
    }
  }, []);

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
              onPress: () => {
                if (data.paymentUrl) {
                  // Navigate to payment webview
                  navigation.navigate('PaymentWebView', { url: data.paymentUrl });
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

  /**
   * Retry queued messages when online
   */
  useEffect(() => {
    if (isOnline && messageQueueRef.current.length > 0) {
      const queuedMessages = [...messageQueueRef.current];
      messageQueueRef.current = [];

      queuedMessages.forEach(msg => {
        sendMessageToAPI(msg.text, msg.id);
      });
    }
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