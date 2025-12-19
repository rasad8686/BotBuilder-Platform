/**
 * Bots Screen
 * List of all bots with create/edit functionality
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BotCard, Button, Input } from '../components';
import { useBots } from '../contexts/BotContext';

const BotsScreen = ({ navigation }) => {
  const {
    bots,
    loading,
    fetchBots,
    createBot,
    deleteBot,
  } = useBots();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBotName, setNewBotName] = useState('');

  useEffect(() => {
    fetchBots();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBots(true);
    setRefreshing(false);
  };

  const filteredBots = bots.filter((bot) =>
    bot.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleBotPress = (bot) => {
    navigation.navigate('Chat', { bot });
  };

  const handleBotLongPress = (bot) => {
    Alert.alert(
      bot.name,
      'What would you like to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Chat',
          onPress: () => navigation.navigate('Chat', { bot }),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => confirmDelete(bot),
        },
      ]
    );
  };

  const confirmDelete = (bot) => {
    Alert.alert(
      'Delete Bot',
      `Are you sure you want to delete "${bot.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteBot(bot.id),
        },
      ]
    );
  };

  const handleCreateBot = async () => {
    if (!newBotName.trim()) {
      Alert.alert('Error', 'Please enter a bot name');
      return;
    }

    const result = await createBot({ name: newBotName.trim() });
    if (result.success) {
      setNewBotName('');
      setShowCreateModal(false);
      Alert.alert('Success', 'Bot created successfully');
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const renderBot = ({ item }) => (
    <BotCard
      bot={item}
      onPress={handleBotPress}
      onLongPress={handleBotLongPress}
    />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🤖</Text>
      <Text style={styles.emptyTitle}>No Bots Yet</Text>
      <Text style={styles.emptyText}>
        Create your first bot to get started
      </Text>
      <Button
        title="Create Bot"
        onPress={() => setShowCreateModal(true)}
        style={styles.createButton}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Bots</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Input
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search bots..."
          style={styles.searchInput}
          leftIcon={<Text>🔍</Text>}
        />
      </View>

      {/* Bot List */}
      <FlatList
        data={filteredBots}
        renderItem={renderBot}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={!loading && renderEmpty}
      />

      {/* Create Modal */}
      {showCreateModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Create New Bot</Text>
            <Input
              label="Bot Name"
              value={newBotName}
              onChangeText={setNewBotName}
              placeholder="Enter bot name"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => {
                  setShowCreateModal(false);
                  setNewBotName('');
                }}
                style={styles.modalButton}
              />
              <Button
                title="Create"
                onPress={handleCreateBot}
                loading={loading}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '500',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  searchInput: {
    marginBottom: 0,
  },
  listContent: {
    padding: 20,
    paddingTop: 12,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 24,
  },
  createButton: {
    paddingHorizontal: 32,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
  },
});

export default BotsScreen;
