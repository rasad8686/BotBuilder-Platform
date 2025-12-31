import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatDistanceToNow } from 'date-fns';

import { useConversationStore } from '../../store';
import { useTheme, useRefresh, useDebounce } from '../../hooks';
import { Card, Avatar, Badge, EmptyState } from '../../components/ui';
import type { RootStackParamList, Conversation } from '../../types';
import { CONVERSATION_STATUSES } from '../../config/constants';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function ConversationsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const {
    conversations,
    fetchConversations,
    isLoading,
    hasMore,
    page,
    markAsRead,
  } = useConversationStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    fetchConversations(1, true);
  }, [fetchConversations]);

  const { refreshing, onRefresh } = useRefresh(() => fetchConversations(1, true));

  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      fetchConversations(page + 1);
    }
  }, [hasMore, isLoading, page, fetchConversations]);

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      !debouncedSearch ||
      conv.userName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      conv.lastMessage?.content.toLowerCase().includes(debouncedSearch.toLowerCase());

    const matchesStatus = !statusFilter || conv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: Conversation['status']) => {
    switch (status) {
      case 'active':
        return theme.success.main;
      case 'pending':
        return theme.warning.main;
      case 'escalated':
        return theme.error.main;
      case 'closed':
        return theme.neutral[400];
      default:
        return theme.neutral[400];
    }
  };

  const handleConversationPress = async (conversation: Conversation) => {
    if (conversation.unreadCount > 0) {
      await markAsRead(conversation.id);
    }
    navigation.navigate('ConversationDetail', { conversationId: conversation.id });
  };

  const renderConversationItem = ({ item: conversation }: { item: Conversation }) => (
    <Card
      variant="default"
      style={[
        styles.conversationCard,
        conversation.unreadCount > 0 && { backgroundColor: `${theme.primary[500]}08` },
      ]}
      onPress={() => handleConversationPress(conversation)}
    >
      <View style={styles.conversationRow}>
        <Avatar
          source={conversation.userAvatar}
          name={conversation.userName}
          size="lg"
          statusIndicator={conversation.status === 'active' ? 'online' : undefined}
        />
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text
              style={[
                styles.userName,
                { color: theme.text.primary },
                conversation.unreadCount > 0 && styles.unreadName,
              ]}
              numberOfLines={1}
            >
              {conversation.userName}
            </Text>
            <Text style={[styles.time, { color: theme.text.tertiary }]}>
              {formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}
            </Text>
          </View>

          <View style={styles.conversationMeta}>
            <Text style={[styles.botName, { color: theme.text.secondary }]}>
              via {conversation.botName}
            </Text>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(conversation.status) }]} />
          </View>

          <Text
            style={[
              styles.lastMessage,
              { color: theme.text.secondary },
              conversation.unreadCount > 0 && styles.unreadMessage,
            ]}
            numberOfLines={2}
          >
            {conversation.lastMessage?.sender === 'bot' && (
              <Text style={{ color: theme.text.tertiary }}>Bot: </Text>
            )}
            {conversation.lastMessage?.content || 'No messages yet'}
          </Text>

          {conversation.tags && conversation.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {conversation.tags.slice(0, 3).map((tag, index) => (
                <Badge key={index} text={tag} variant="default" size="sm" style={styles.tag} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.conversationRight}>
          {conversation.unreadCount > 0 && (
            <Badge count={conversation.unreadCount} variant="primary" />
          )}
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.text.tertiary}
            style={styles.chevron}
          />
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text.primary }]}>Conversations</Text>
        <TouchableOpacity style={[styles.headerButton, { backgroundColor: theme.background.secondary }]}>
          <Ionicons name="filter-outline" size={20} color={theme.text.secondary} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchInput, { backgroundColor: theme.input.background }]}>
          <Ionicons name="search" size={20} color={theme.text.tertiary} />
          <TextInput
            style={[styles.searchText, { color: theme.text.primary }]}
            placeholder="Search conversations..."
            placeholderTextColor={theme.input.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status Filter */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: null, name: 'All' }, ...CONVERSATION_STATUSES]}
          keyExtractor={(item) => item.id?.toString() || 'all'}
          contentContainerStyle={styles.filterScroll}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    statusFilter === item.id ? theme.primary[500] : theme.background.secondary,
                },
              ]}
              onPress={() => setStatusFilter(item.id)}
            >
              {item.id && (
                <View
                  style={[
                    styles.filterDot,
                    { backgroundColor: item.color || theme.neutral[400] },
                  ]}
                />
              )}
              <Text
                style={[
                  styles.filterText,
                  { color: statusFilter === item.id ? theme.white : theme.text.secondary },
                ]}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Conversations List */}
      <FlatList
        data={filteredConversations}
        renderItem={renderConversationItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title={searchQuery ? 'No conversations found' : 'No conversations yet'}
            description={
              searchQuery
                ? 'Try adjusting your search'
                : 'Conversations will appear here when users start chatting with your bots'
            }
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    gap: 8,
  },
  searchText: {
    flex: 1,
    fontSize: 16,
  },
  filterContainer: {
    marginBottom: 8,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  conversationCard: {
    marginBottom: 8,
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  conversationContent: {
    flex: 1,
    marginLeft: 12,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userName: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  unreadName: {
    fontWeight: '700',
  },
  time: {
    fontSize: 12,
    marginLeft: 8,
  },
  conversationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  botName: {
    fontSize: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 8,
  },
  lastMessage: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  unreadMessage: {
    fontWeight: '500',
  },
  tagsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 4,
  },
  tag: {
    marginRight: 4,
  },
  conversationRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  chevron: {
    marginTop: 8,
  },
});
