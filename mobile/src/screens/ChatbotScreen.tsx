import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable
} from 'react-native';
import { useTranslation } from 'react-i18next';

// Optional imports - these may not be installed
// @ts-ignore - Icon may not be installed
let Icon: any = null;
try {
  // @ts-ignore
  Icon = require('react-native-vector-icons/MaterialIcons').default;
} catch { /* not installed */ }

// @ts-ignore - Voice may not be installed
let Voice: any = null;
try {
  // @ts-ignore
  Voice = require('@react-native-voice/voice').default;
} catch { /* not installed */ }

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  apiAction?: string;
  apiData?: any;
}

interface ChatbotScreenProps {
  navigation: any;
  userId?: string;
}

export default function ChatbotScreen({ navigation, userId }: ChatbotScreenProps) {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Initialize voice recognition if available
    if (Voice) {
      Voice.onSpeechStart = () => {
        if (isMountedRef.current) setIsRecording(true);
      };
      Voice.onSpeechEnd = () => {
        if (isMountedRef.current) setIsRecording(false);
      };
      Voice.onSpeechResults = (e: { value?: string[] }) => {
        if (isMountedRef.current && e.value && e.value[0]) {
          setInputText(e.value[0]);
        }
      };
      Voice.onSpeechError = (e: { error?: { message?: string } }) => {
        console.error('Voice error:', e);
        if (isMountedRef.current) setIsRecording(false);
      };
    }

    // Welcome message
    const welcomeMessage: Message = {
      id: '1',
      text: i18n.language === 'ig' 
        ? 'Nnọọ! M bụ TaxBridge AI enyịocha ụtụ isi. Otu m ga-enyere gị?' 
        : i18n.language === 'ha'
        ? 'Sannu! Ni TaxBridge AI mai tazarar haraji. Yaya zan iya taimaka ka?'
        : 'Hello! I am TaxBridge AI tax assistant. How can I help you today?',
      isUser: false,
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);

    return () => {
      isMountedRef.current = false;
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date()
    };

    if (isMountedRef.current) {
      setMessages(prev => [...prev, userMessage]);
      setInputText('');
      setIsLoading(true);
    }

    try {
      const response = await fetch('http://localhost:3000/api/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: inputText.trim(),
          language: i18n.language.startsWith('en') ? 'en' : 'pidgin',
          userId
        })
      });

      if (!isMountedRef.current) return;

      const data = await response.json();

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.answer,
        isUser: false,
        timestamp: new Date(),
        apiAction: data.apiAction,
        apiData: data.apiData
      };

      if (isMountedRef.current) {
        setMessages(prev => [...prev, botMessage]);
      }

      // Show API action buttons if available
      if (data.apiAction && data.apiData && isMountedRef.current) {
        setTimeout(() => {
          if (isMountedRef.current) {
            showAPIActionDialog(data.apiAction, data.apiData);
          }
        }, 1000);
      }

    } catch (error) {
      console.error('Chatbot error:', error);
      if (!isMountedRef.current) return;
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I am having trouble connecting. Please try again.',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const startVoiceRecording = async () => {
    try {
      await Voice.start('en-US');
    } catch (error) {
      console.error('Voice start error:', error);
    }
  };

  const stopVoiceRecording = async () => {
    try {
      await Voice.stop();
    } catch (error) {
      console.error('Voice stop error:', error);
    }
  };

  const showAPIActionDialog = (action: string, data: any) => {
    if (action === 'einvoice_submit') {
      Alert.alert(
        'E-Invoice Submitted',
        `Your invoice has been submitted successfully!\n\nIRN: ${data.irn}\nNRS Reference: ${data.nrsReference}`,
        [
          { text: 'OK', style: 'default' },
          { 
            text: 'View Invoice', 
            onPress: () => navigation.navigate('Invoices'),
            style: 'default' 
          }
        ]
      );
    } else if (action === 'payment_generate') {
      Alert.alert(
        'Payment RRR Generated',
        `Your payment RRR has been generated!\n\nRRR: ${data.rrr}\nAmount: ₦${data.amount}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Pay Now', 
            onPress: () => {
              if (data.paymentUrl) {
                // In a real app, open the payment URL in a webview
                Alert.alert('Payment', 'Opening payment page...');
              }
            },
            style: 'default' 
          }
        ]
      );
    }
  };

  const renderMessage = (message: Message) => (
    <View
      key={message.id}
      style={[
        styles.messageContainer,
        message.isUser ? styles.userMessage : styles.botMessage
      ]}
    >
      <Text
        style={[
          styles.messageText,
          message.isUser ? styles.userText : styles.botText
        ]}
      >
        {message.text}
      </Text>
      <Text style={styles.timestamp}>
        {message.timestamp.toLocaleTimeString()}
      </Text>
    </View>
  );

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>TaxBridge Assistant</Text>
        <TouchableOpacity onPress={() => setShowLanguageModal(true)}>
          <Icon name="language" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map(renderMessage)}
        {isLoading && (
          <View style={[styles.messageContainer, styles.botMessage]}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.typingText}>Typing...</Text>
          </View>
        )}
      </ScrollView>

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask about taxes, e-invoicing, payments..."
          placeholderTextColor="#999"
          multiline
          maxLength={500}
        />
        
        <TouchableOpacity
          style={[styles.iconButton, isRecording && styles.recordingButton]}
          onPressIn={startVoiceRecording}
          onPressOut={stopVoiceRecording}
        >
          <Icon 
            name={isRecording ? "mic" : "mic-none"} 
            size={24} 
            color={isRecording ? "#FF3B30" : "#007AFF"} 
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.disabledButton]}
          onPress={sendMessage}
          disabled={!inputText.trim() || isLoading}
        >
          <Icon name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Language Modal */}
      <Modal
        visible={showLanguageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Language</Text>
            
            <TouchableOpacity
              style={styles.languageOption}
              onPress={() => {
                i18n.changeLanguage('en');
                setShowLanguageModal(false);
              }}
            >
              <Text style={styles.languageText}>English</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.languageOption}
              onPress={() => {
                i18n.changeLanguage('pidgin');
                setShowLanguageModal(false);
              }}
            >
              <Text style={styles.languageText}>Nigerian Pidgin</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowLanguageModal(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  messagesContent: {
    padding: 16,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  botMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageText: {
    padding: 12,
    fontSize: 16,
    lineHeight: 20,
  },
  userText: {
    color: '#fff',
  },
  botText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 11,
    color: '#666',
    marginHorizontal: 12,
    marginBottom: 4,
  },
  typingText: {
    marginLeft: 8,
    color: '#666',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 4,
  },
  recordingButton: {
    backgroundColor: '#ffebee',
  },
  sendButton: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    marginLeft: 4,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  languageOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  languageText: {
    fontSize: 16,
    color: '#333',
  },
  cancelButton: {
    padding: 16,
    marginTop: 8,
  },
  cancelText: {
    fontSize: 16,
    color: '#007AFF',
    textAlign: 'center',
  },
});
