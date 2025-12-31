import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { Avatar } from '../../components/ui';
import { voiceService } from '../../services/voiceService';

type CallStatus = 'connecting' | 'ringing' | 'connected' | 'ended' | 'failed';

export const VoiceCallScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { botId, botName } = route.params as { botId: string; botName?: string };

  const [callStatus, setCallStatus] = useState<CallStatus>('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isKeypadVisible, setIsKeypadVisible] = useState(false);
  const [dtmfInput, setDtmfInput] = useState('');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const callIdRef = useRef<string | null>(null);

  // Pulse animation for connecting/ringing state
  useEffect(() => {
    if (callStatus === 'connecting' || callStatus === 'ringing') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [callStatus, pulseAnim]);

  // Start call on mount
  useEffect(() => {
    startCall();
    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, []);

  const startCall = async () => {
    try {
      setCallStatus('connecting');
      const response = await voiceService.startTestCall(botId);
      callIdRef.current = response.callId;

      // Simulate call states
      setTimeout(() => setCallStatus('ringing'), 1000);
      setTimeout(() => {
        setCallStatus('connected');
        if (Platform.OS !== 'web') {
          Vibration.vibrate(100);
        }
        // Start duration timer
        durationInterval.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
      }, 3000);
    } catch (error) {
      setCallStatus('failed');
    }
  };

  const endCall = useCallback(async () => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
    }

    try {
      if (callIdRef.current) {
        await voiceService.endCall(callIdRef.current);
      }
    } catch (error) {
      console.error('Failed to end call:', error);
    }

    setCallStatus('ended');
    if (Platform.OS !== 'web') {
      Vibration.vibrate(200);
    }

    setTimeout(() => {
      navigation.goBack();
    }, 1500);
  }, [navigation]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (callIdRef.current) {
      voiceService.setMute(callIdRef.current, !isMuted);
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };

  const sendDTMF = (digit: string) => {
    setDtmfInput(prev => prev + digit);
    if (callIdRef.current) {
      voiceService.sendDTMF(callIdRef.current, digit);
    }
    if (Platform.OS !== 'web') {
      Vibration.vibrate(50);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'connecting': return 'Connecting...';
      case 'ringing': return 'Ringing...';
      case 'connected': return formatDuration(callDuration);
      case 'ended': return 'Call Ended';
      case 'failed': return 'Call Failed';
    }
  };

  const getStatusColor = () => {
    switch (callStatus) {
      case 'connected': return theme.colors.success;
      case 'failed': return theme.colors.error;
      case 'ended': return theme.colors.textSecondary;
      default: return theme.colors.primary;
    }
  };

  const renderKeypad = () => {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['*', '0', '#'],
    ];

    return (
      <View style={styles.keypadContainer}>
        <Text style={[styles.dtmfInput, { color: theme.colors.text }]}>
          {dtmfInput || 'Enter digits'}
        </Text>
        {keys.map((row, i) => (
          <View key={i} style={styles.keypadRow}>
            {row.map(key => (
              <TouchableOpacity
                key={key}
                style={[styles.keypadKey, { backgroundColor: theme.colors.card }]}
                onPress={() => sendDTMF(key)}
              >
                <Text style={[styles.keypadKeyText, { color: theme.colors.text }]}>
                  {key}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Voice Call</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <Animated.View
          style={[
            styles.avatarContainer,
            {
              transform: [{ scale: callStatus === 'connected' ? 1 : pulseAnim }],
            },
          ]}
        >
          <View
            style={[
              styles.avatarRing,
              {
                borderColor: getStatusColor(),
                opacity: callStatus === 'connected' ? 0.3 : 0.5,
              },
            ]}
          />
          <Avatar
            name={botName || 'Voice Bot'}
            size={100}
            style={{ backgroundColor: theme.colors.primary }}
          />
        </Animated.View>

        <Text style={[styles.botName, { color: theme.colors.text }]}>
          {botName || 'Voice Bot'}
        </Text>
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>

        {isKeypadVisible && callStatus === 'connected' && renderKeypad()}
      </View>

      <View style={styles.controls}>
        {callStatus === 'connected' && (
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={[
                styles.controlButton,
                { backgroundColor: isMuted ? theme.colors.error : theme.colors.card },
              ]}
              onPress={toggleMute}
            >
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic'}
                size={24}
                color={isMuted ? '#fff' : theme.colors.text}
              />
              <Text
                style={[
                  styles.controlLabel,
                  { color: isMuted ? '#fff' : theme.colors.textSecondary },
                ]}
              >
                {isMuted ? 'Unmute' : 'Mute'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.controlButton,
                { backgroundColor: isKeypadVisible ? theme.colors.primary : theme.colors.card },
              ]}
              onPress={() => setIsKeypadVisible(!isKeypadVisible)}
            >
              <Ionicons
                name="keypad"
                size={24}
                color={isKeypadVisible ? '#fff' : theme.colors.text}
              />
              <Text
                style={[
                  styles.controlLabel,
                  { color: isKeypadVisible ? '#fff' : theme.colors.textSecondary },
                ]}
              >
                Keypad
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.controlButton,
                { backgroundColor: isSpeakerOn ? theme.colors.primary : theme.colors.card },
              ]}
              onPress={toggleSpeaker}
            >
              <Ionicons
                name={isSpeakerOn ? 'volume-high' : 'volume-medium'}
                size={24}
                color={isSpeakerOn ? '#fff' : theme.colors.text}
              />
              <Text
                style={[
                  styles.controlLabel,
                  { color: isSpeakerOn ? '#fff' : theme.colors.textSecondary },
                ]}
              >
                Speaker
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {(callStatus === 'connecting' || callStatus === 'ringing' || callStatus === 'connected') && (
          <TouchableOpacity
            style={[styles.endCallButton, { backgroundColor: theme.colors.error }]}
            onPress={endCall}
          >
            <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        )}

        {callStatus === 'failed' && (
          <View style={styles.failedActions}>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
              onPress={startCall}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.retryText}>Retry Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: theme.colors.border }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={[styles.cancelText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  avatarRing: {
    position: 'absolute',
    top: -15,
    left: -15,
    right: -15,
    bottom: -15,
    borderRadius: 75,
    borderWidth: 3,
  },
  botName: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '500',
  },
  controls: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  controlButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  endCallButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  failedActions: {
    gap: 12,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
  keypadContainer: {
    marginTop: 30,
    alignItems: 'center',
  },
  dtmfInput: {
    fontSize: 24,
    fontWeight: '300',
    letterSpacing: 4,
    marginBottom: 20,
    minHeight: 30,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
  },
  keypadKey: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadKeyText: {
    fontSize: 28,
    fontWeight: '400',
  },
});

export default VoiceCallScreen;
