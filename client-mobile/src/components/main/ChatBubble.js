/**
 * ChatBubble Component
 * Message bubble for chat interface
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';

const ChatBubble = ({
  message,
  isUser,
  showAvatar = true,
  showTimestamp = true,
  onLongPress,
  isTyping = false,
}) => {
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Typing indicator animation
  const TypingIndicator = () => {
    const dots = [1, 2, 3];
    return (
      <View style={styles.typingContainer}>
        {dots.map((dot, index) => (
          <Animated.View
            key={index}
            style={[
              styles.typingDot,
              { animationDelay: `${index * 0.15}s` },
            ]}
          />
        ))}
      </View>
    );
  };

  if (isTyping) {
    return (
      <View style={[styles.container, styles.botContainer]}>
        {showAvatar && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>🤖</Text>
          </View>
        )}
        <View style={[styles.bubble, styles.botBubble]}>
          <TypingIndicator />
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onLongPress={() => onLongPress?.(message)}
      activeOpacity={0.8}
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.botContainer,
      ]}
    >
      {/* Avatar (bot only) */}
      {!isUser && showAvatar && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>🤖</Text>
        </View>
      )}

      {/* Message Bubble */}
      <View style={styles.bubbleWrapper}>
        <View
          style={[
            styles.bubble,
            isUser ? styles.userBubble : styles.botBubble,
            message.error && styles.errorBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isUser && styles.userMessageText,
              message.error && styles.errorText,
            ]}
          >
            {message.content}
          </Text>
        </View>

        {/* Timestamp & Status */}
        {showTimestamp && (
          <View style={[styles.meta, isUser && styles.metaRight]}>
            <Text style={styles.timestamp}>
              {formatTime(message.timestamp)}
            </Text>
            {isUser && message.status && (
              <Text style={styles.status}>
                {message.status === 'sent' && '✓'}
                {message.status === 'delivered' && '✓✓'}
                {message.status === 'read' && '✓✓'}
                {message.status === 'error' && '!'}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Avatar (user only) */}
      {isUser && showAvatar && (
        <View style={[styles.avatar, styles.userAvatar]}>
          <Text style={styles.avatarText}>👤</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Quick reply buttons
export const QuickReplies = ({ replies, onSelect }) => (
  <View style={styles.quickRepliesContainer}>
    {replies.map((reply, index) => (
      <TouchableOpacity
        key={index}
        style={styles.quickReply}
        onPress={() => onSelect(reply)}
      >
        <Text style={styles.quickReplyText}>{reply}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  botContainer: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  userAvatar: {
    backgroundColor: '#6366f1',
    marginRight: 0,
    marginLeft: 10,
  },
  avatarText: {
    fontSize: 18,
  },
  bubbleWrapper: {
    maxWidth: '75%',
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: '#6366f1',
    borderBottomRightRadius: 6,
  },
  botBubble: {
    backgroundColor: '#f1f5f9',
    borderBottomLeftRadius: 6,
  },
  errorBubble: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1e293b',
  },
  userMessageText: {
    color: '#ffffff',
  },
  errorText: {
    color: '#dc2626',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  metaRight: {
    justifyContent: 'flex-end',
  },
  timestamp: {
    fontSize: 11,
    color: '#94a3b8',
  },
  status: {
    fontSize: 12,
    color: '#6366f1',
  },
  // Typing indicator
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94a3b8',
    opacity: 0.6,
  },
  // Quick replies
  quickRepliesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  quickReply: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#6366f1',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  quickReplyText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
  },
});

export default ChatBubble;
