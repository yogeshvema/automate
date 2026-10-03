import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SendStatus } from '@/types';

interface Props {
  status: SendStatus;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function SendStatusOverlay({ status, onRetry, onDismiss }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (status.state === 'idle') {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start();
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 220, friction: 10, useNativeDriver: true }),
    ]).start();
  }, [status.state, opacity, scale]);

  if (status.state === 'idle') return null;

  return (
    <Animated.View style={[styles.backdrop, { opacity }]}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>

        {/* SENDING */}
        {status.state === 'sending' && (
          <>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.title}>Sending…</Text>
            {status.progress !== undefined && (
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${status.progress}%` as any }]} />
              </View>
            )}
            <Text style={styles.sub}>
              {status.progress !== undefined ? `${Math.round(status.progress)}%` : 'Please wait'}
            </Text>
          </>
        )}

        {/* SENT */}
        {status.state === 'sent' && (
          <>
            <View style={[styles.iconCircle, { backgroundColor: '#34c759' }]}>
              <Ionicons name="checkmark" size={38} color="#fff" />
            </View>
            <Text style={styles.title}>Sent ✓</Text>
          </>
        )}

        {/* ERROR */}
        {status.state === 'error' && (
          <>
            <View style={[styles.iconCircle, { backgroundColor: '#ff3b30' }]}>
              <Ionicons name="close" size={38} color="#fff" />
            </View>
            <Text style={styles.title}>Failed to Send</Text>
            <Text style={styles.errorMsg} numberOfLines={3}>
              {status.error ?? 'Something went wrong'}
            </Text>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.85}>
                <Ionicons name="refresh" size={15} color="#fff" style={{ marginRight: 5 }} />
                <Text style={styles.retryTxt}>Retry</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} activeOpacity={0.85}>
                <Text style={styles.dismissTxt}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  card: {
    backgroundColor: '#1c1c1e',
    borderRadius: 22,
    padding: 30,
    alignItems: 'center',
    minWidth: 210,
    maxWidth: 290,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 16,
  },
  iconCircle: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    color: '#fff', fontSize: 19, fontWeight: '700', marginTop: 14,
  },
  sub: {
    color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 6,
  },
  errorMsg: {
    color: 'rgba(255,255,255,0.55)', fontSize: 13,
    textAlign: 'center', marginTop: 8, lineHeight: 20,
  },
  progressTrack: {
    width: 160, height: 4, backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2, marginTop: 14, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: '#007AFF', borderRadius: 2,
  },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#007AFF', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 11,
  },
  retryTxt: { color: '#fff', fontSize: 15, fontWeight: '600' },
  dismissBtn: {
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dismissTxt: { color: 'rgba(255,255,255,0.65)', fontSize: 15 },
});
