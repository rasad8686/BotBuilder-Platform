/**
 * Chat Screen
 * Real-time chat with a bot
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBots } from '../../contexts/BotContext';
import { ChatBubble, EmptyMessages } from '../../components/main';

const ChatScreen = ({ navigation, route }) => {
  const { bot: routeBot } = route.params || {};
  const {
    selectedBot,
    messages,
    chatLoading,
    startChatSession,
    sendMessage,
    clearChat,
  } = useBots();

  const [inputText, setInputText] = useState('');
  const flatListRef = useRef(null);
  const inputRef = useRef(null);

  const bot = routeBot || selectedBot;

  useEffect(() => {
    if (bot) {
      startChatSession(bot);
    }
  }, [bot?.id]);

  // Scroll to bottom when new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!inputText.trim() || chatLoading) return;

    const text = inputText.trim();
    setInputText('');
    await sendMessage(text);
  };

  const handleClearChat = () => {
    Alert.alert(
      'Clear Chat',
      'Are you sure you want to clear all messages?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: clearChat,
        },
      ]
    );
  };

  const renderMessage = ({ item, index }) => (
    <ChatBubble
      message={item}
      isUser={item.role === 'user'}
      showAvatar={true}
      showTimestamp={true}
    />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Text style={styles.emptyEmoji}>💬</Text>
      </View>
      <Text style={styles.emptyTitle}>Start a conversation</Text>
      <Text style={styles.emptyText}>
        Send a message to chat with {bot?.name || 'the bot'}
      </Text>
    </View>
  );

  if (!bot) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noBotContainer}>
          <Text style={styles.noBotIcon}>🤖</Text>
          <Text style={styles.noBotTitle}>No Bot Selected</Text>
          <Text style={styles.noBotText}>
            Select a bot from the Bots tab to start chatting
          </Text>
          <TouchableOpacity
            style={styles.selectBotButton}
            onPress={() => navigation.navigate('Bots')}
          >
            <Text style={styles.selectBotText}>Select Bot</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerEmoji}>🤖</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>{bot.name}</Text>
            <View style={styles.headerStatus}>
              <View style={styles.onlineDot} />
              <Text style={styles.headerSubtitle}>Online</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          onPress={handleClearChat}
          style={styles.clearButton}
        >
          <Text style={styles.clearIcon}>🗑️</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
          onContentSizeChange={() =>
            messages.length > 0 && flatListRef.current?.scrollToEnd({ animated: false })
          }
        />

        {/* Typing Indicator */}
        {chatLoading && (
          <View style={styles.typingContainer}>
            <ChatBubble isTyping />
          </View>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              placeholderTextColor="#94a3b8"
              multiline
              maxLength={1000}
              editable={!chatLoading}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || chatLoading) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || chatLoading}
          >
            {chatLoading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.sendIcon}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  backIcon: {
    fontSize: 28,
    color: '#1e293b',
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerEmoji: {
    fontSize: 22,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1e293b',
  },
  headerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    marginRight: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#22c55e',
  },
  clearButton: {
    padding: 8,
  },
  clearIcon: {
    fontSize: 20,
  },
  keyboardView: {
    flex: 1,
  },
  messagesList: {
    paddingVertical: 16,
    flexGrow: 1,
  },
  typingContainer: {
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 10,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
    maxHeight: 120,
  },
  input: {
    fontSize: 16,
    color: '#1e293b',
    maxHeight: 100,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendIcon: {
    fontSize: 22,
    color: '#ffffff',
    fontWeight: '700',
  },
  // Empty & No Bot states
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  noBotContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  noBotIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  noBotTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  noBotText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  selectBotButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  selectBotText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default ChatScreen;
