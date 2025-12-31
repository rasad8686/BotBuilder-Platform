import React, { useEffect, useRef, useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { format } from 'date-fns';

import { useConversationStore } from '../../store';
import { useTheme, useSocket } from '../../hooks';
import { Avatar, Badge } from '../../components/ui';
import type { RootStackParamList, Message } from '../../types';

type RouteProps = RouteProp<RootStackParamList, 'ConversationDetail'>;

export function ConversationDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { conversationId } = route.params;

  const {
    selectedConversation,
    messages,
    fetchConversation,
    fetchMessages,
    sendMessage,
    isLoadingMessages,
    isSending,
    hasMore,
    closeConversation,
    escalateConversation,
  } = useConversationStore();

  const { joinConversation, leaveConversation, sendTyping } = useSocket();
  const flatListRef = useRef<FlatList>(null);

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    fetchConversation(conversationId);
    fetchMessages(conversationId);
    joinConversation(conversationId);

    return () => {
      leaveConversation(conversationId);
    };
  }, [conversationId, fetchConversation, fetchMessages, joinConversation, leaveConversation]);

  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;

    const message = inputText.trim();
    setInputText('');
    await sendMessage(conversationId, message);

    flatListRef.current?.scrollToEnd({ animated: true });
  };

  const handleTyping = (text: string) => {
    setInputText(text);
    if (!isTyping && text.length > 0) {
      setIsTyping(true);
      sendTyping(conversationId, true);
    } else if (isTyping && text.length === 0) {
      setIsTyping(false);
      sendTyping(conversationId, false);
    }
  };

  const loadMoreMessages = useCallback(() => {
    if (hasMore && !isLoadingMessages) {
      // Load more messages
    }
  }, [hasMore, isLoadingMessages]);

  const handleClose = async () => {
    const success = await closeConversation(conversationId);
    if (success) {
      navigation.goBack();
    }
  };

  const handleEscalate = async () => {
    await escalateConversation(conversationId);
  };

  const getMessageAlignment = (sender: Message['sender']) => {
    switch (sender) {
      case 'user':
        return 'flex-start';
      case 'bot':
      case 'agent':
        return 'flex-end';
      default:
        return 'flex-start';
    }
  };

  const getMessageStyle = (sender: Message['sender']) => {
    switch (sender) {
      case 'user':
        return {
          backgroundColor: theme.background.secondary,
          borderTopLeftRadius: 4,
        };
      case 'bot':
        return {
          backgroundColor: theme.primary[500],
          borderTopRightRadius: 4,
        };
      case 'agent':
        return {
          backgroundColor: theme.secondary[500],
          borderTopRightRadius: 4,
        };
      default:
        return { backgroundColor: theme.neutral[300] };
    }
  };

  const getTextColor = (sender: Message['sender']) => {
    return sender === 'user' ? theme.text.primary : theme.white;
  };

  const renderMessage = ({ item: message, index }: { item: Message; index: number }) => {
    const showDate =
      index === 0 ||
      format(new Date(message.timestamp), 'yyyy-MM-dd') !==
        format(new Date(messages[index - 1].timestamp), 'yyyy-MM-dd');

    return (
      <>
        {showDate && (
          <View style={styles.dateContainer}>
            <Text style={[styles.dateText, { color: theme.text.tertiary }]}>
              {format(new Date(message.timestamp), 'MMMM d, yyyy')}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.messageContainer,
            { alignItems: getMessageAlignment(message.sender) },
          ]}
        >
          {message.sender === 'user' && (
            <Avatar
              source={selectedConversation?.userAvatar}
              name={selectedConversation?.userName}
              size="sm"
              style={styles.messageAvatar}
            />
          )}
          <View
            style={[
              styles.messageBubble,
              getMessageStyle(message.sender),
            ]}
          >
            <Text style={[styles.messageText, { color: getTextColor(message.sender) }]}>
              {message.content}
            </Text>
            <View style={styles.messageFooter}>
              <Text
                style={[
                  styles.messageTime,
                  { color: message.sender === 'user' ? theme.text.tertiary : 'rgba(255,255,255,0.7)' },
                ]}
              >
                {format(new Date(message.timestamp), 'HH:mm')}
              </Text>
              {message.sender !== 'user' && (
                <Ionicons
                  name={
                    message.status === 'read'
                      ? 'checkmark-done'
                      : message.status === 'delivered'
                      ? 'checkmark-done-outline'
                      : 'checkmark'
                  }
                  size={14}
                  color="rgba(255,255,255,0.7)"
                  style={styles.statusIcon}
                />
              )}
            </View>
          </View>
          {message.sender !== 'user' && (
            <View style={styles.senderBadge}>
              <Text style={[styles.senderText, { color: theme.text.tertiary }]}>
                {message.sender === 'bot' ? 'Bot' : 'Agent'}
              </Text>
            </View>
          )}
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border.light }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerInfo}>
          <Avatar
            source={selectedConversation?.userAvatar}
            name={selectedConversation?.userName}
            size="md"
          />
          <View style={styles.headerText}>
            <Text style={[styles.headerName, { color: theme.text.primary }]}>
              {selectedConversation?.userName}
            </Text>
            <Text style={[styles.headerBot, { color: theme.text.secondary }]}>
              via {selectedConversation?.botName}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: theme.warning.light }]}
            onPress={handleEscalate}
          >
            <Ionicons name="flag-outline" size={18} color={theme.warning.dark} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: theme.background.secondary }]}
            onPress={handleClose}
          >
            <Ionicons name="close-circle-outline" size={18} color={theme.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Conversation Status */}
      {selectedConversation?.status !== 'active' && (
        <View
          style={[
            styles.statusBanner,
            {
              backgroundColor:
                selectedConversation?.status === 'escalated'
                  ? theme.error.light
                  : selectedConversation?.status === 'closed'
                  ? theme.neutral[200]
                  : theme.warning.light,
            },
          ]}
        >
          <Text
            style={[
              styles.statusBannerText,
              {
                color:
                  selectedConversation?.status === 'escalated'
                    ? theme.error.dark
                    : selectedConversation?.status === 'closed'
                    ? theme.neutral[600]
                    : theme.warning.dark,
              },
            ]}
          >
            This conversation is {selectedConversation?.status}
          </Text>
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        inverted={false}
        onEndReached={loadMoreMessages}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          isLoadingMessages ? (
            <ActivityIndicator style={styles.loader} color={theme.primary[500]} />
          ) : null
        }
      />

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={[styles.inputContainer, { backgroundColor: theme.background.primary, borderTopColor: theme.border.light }]}>
          <TouchableOpacity style={styles.attachButton}>
            <Ionicons name="add-circle-outline" size={28} color={theme.text.tertiary} />
          </TouchableOpacity>

          <View style={[styles.inputWrapper, { backgroundColor: theme.input.background }]}>
            <TextInput
              style={[styles.input, { color: theme.text.primary }]}
              placeholder="Type a message..."
              placeholderTextColor={theme.input.placeholder}
              value={inputText}
              onChangeText={handleTyping}
              multiline
              maxLength={1000}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.sendButton,
              {
                backgroundColor: inputText.trim() ? theme.primary[500] : theme.neutral[300],
              },
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={theme.white} />
            ) : (
              <Ionicons name="send" size={20} color={theme.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  headerText: {
    marginLeft: 10,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerBot: {
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBanner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  statusBannerText: {
    fontSize: 12,
    fontWeight: '500',
  },
  messagesList: {
    padding: 16,
  },
  dateContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '500',
  },
  messageContainer: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  messageAvatar: {
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  statusIcon: {
    marginLeft: 4,
  },
  senderBadge: {
    marginLeft: 6,
    marginBottom: 2,
  },
  senderText: {
    fontSize: 10,
  },
  loader: {
    paddingVertical: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  attachButton: {
    padding: 6,
  },
  inputWrapper: {
    flex: 1,
    marginHorizontal: 8,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
  },
  input: {
    fontSize: 16,
    maxHeight: 80,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
