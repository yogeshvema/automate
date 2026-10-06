import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  AppState,
  DeviceEventEmitter,
} from 'react-native';
import VolumeManager from 'react-native-volume-manager';
import {
  CameraView,
  CameraType,
  FlashMode,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { SendStatusOverlay } from '@/components/SendStatusOverlay';
import { useCamera } from '@/hooks/useCamera';
import { useMediaSend } from '@/hooks/useMediaSend';
import { useSettingsStore } from '@/store/settingsStore';

type CaptureMode = 'picture' | 'video';

export default function CameraScreen() {
  const [captureMode, setCaptureMode] = useState<CaptureMode>('picture');
  const [recordSeconds, setRecordSeconds] = useState(0);

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();

  const insets = useSafeAreaInsets();
  const { destination, autoSendEnabled } = useSettingsStore();
  const { sendStatus, send, retry, reset } = useMediaSend();
  const {
    cameraRef, facing, flash, isReady, isRecording,
    setIsReady, flipCamera, cycleFlash,
    takePhoto, startRecording, stopRecording,
  } = useCamera();

  useEffect(() => {
    if (!isRecording) { setRecordSeconds(0); return; }
    const id = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' && isRecording) {
        stopRecording();
      }
    });
    return () => sub.remove();
  }, [isRecording, stopRecording]);

  useEffect(() => {
    if (sendStatus.state !== 'sent') return;
    const t = setTimeout(reset, 2500);
    return () => clearTimeout(t);
  }, [sendStatus.state, reset]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const guardDestination = useCallback(() => {
    if (destination) return true;
    Alert.alert(
      'No Destination Set',
      'Configure a Telegram destination in Settings first.',
      [
        { text: 'Settings', onPress: () => router.push('/(tabs)/settings') },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
    return false;
  }, [destination]);

  const safeHaptic = async (style: Haptics.ImpactFeedbackStyle) => {
    try {
      await Haptics.impactAsync(style);
    } catch {}
  };

  const isCapturing = useRef(false);

  const captureModeRef = useRef(captureMode);
  captureModeRef.current = captureMode;

  const handleCaptureRef = useRef<(() => void) | null>(null);
  const handleVideoToggleRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let lastTriggerTime = 0;
    const onKey = (event: any) => {
      const now = Date.now();
      if (now - lastTriggerTime < 500) return;
      console.log('[CameraScreen] Hardware key event received:', event);
      const k = event?.key || (event?.keyCode === 25 ? 'VOLUME_DOWN' : event?.keyCode === 24 ? 'VOLUME_UP' : null);
      if (k === 'VOLUME_DOWN' || k === 'VOLUME_UP') {
        lastTriggerTime = now;
        if (captureModeRef.current === 'picture') {
          handleCaptureRef.current?.();
        } else {
          handleVideoToggleRef.current?.();
        }
      }
    };

    const sub1 = DeviceEventEmitter.addListener('hardwareKeyEvent', onKey);
    const sub2 = DeviceEventEmitter.addListener('onHardwareVolumeButton', onKey);

    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let sub: any = null;
    try {
      VolumeManager?.showNativeVolumeUI?.({ enabled: false })?.catch?.(() => {});

      VolumeManager?.setVolume?.(0.5, { showUI: false, playSound: false })?.catch?.(() => {});

      sub = VolumeManager?.addVolumeListener?.((result) => {
        try {
          VolumeManager?.setVolume?.(0.5, { showUI: false, playSound: false })?.catch?.(() => {});

          if (captureModeRef.current === 'picture') {
            handleCaptureRef.current?.();
          } else {
            handleVideoToggleRef.current?.();
          }
        } catch (err) {
          console.warn('Shutter remote trigger error:', err);
        }
      });
    } catch (e) {
      console.warn('VolumeManager initialization error:', e);
    }

    return () => {
      try {
        sub?.remove?.();
      } catch {}
      try {
        VolumeManager?.showNativeVolumeUI?.({ enabled: true })?.catch?.(() => {});
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyDown = (e: any) => {
      if (e.code === 'Space' || e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault?.();
        if (captureModeRef.current === 'picture') {
          handleCaptureRef.current?.();
        } else {
          handleVideoToggleRef.current?.();
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, []);


  const handleCapture = useCallback(async () => {
    if (isCapturing.current || sendStatus.state === 'sending') return;
    isCapturing.current = true;
    try {
      await safeHaptic(Haptics.ImpactFeedbackStyle.Medium);
      const media = await takePhoto();
      if (!media) return;

      if (!autoSendEnabled) {
        Alert.alert(
          'Auto-Send is OFF',
          'Photo captured! Auto-send is currently disabled, so this photo was not sent.',
          [{ text: 'OK' }]
        );
        return;
      }

      if (!guardDestination()) return;
      send(media);
    } finally {
      isCapturing.current = false;
    }
  }, [sendStatus.state, autoSendEnabled, guardDestination, takePhoto, send]);


  const handleVideoToggle = useCallback(async () => {
    if (isRecording) {
      await safeHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      stopRecording();
      return;
    }

    if (Platform.OS !== 'web' && !micPerm?.granted) {
      const { granted } = await requestMicPerm();
      if (!granted) {
        Alert.alert('Microphone Required', 'Please grant microphone permission to record videos.');
        return;
      }
    }

    await safeHaptic(Haptics.ImpactFeedbackStyle.Medium);
    const media = await startRecording();
    if (!media) return;

    if (!autoSendEnabled) {
      Alert.alert(
        'Auto-Send is OFF',
        'Video recorded! Auto-send is currently disabled, so this video was not sent.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!guardDestination()) return;
    send(media);
  }, [isRecording, micPerm, requestMicPerm, startRecording, stopRecording, autoSendEnabled, guardDestination, send]);

  handleCaptureRef.current = handleCapture;
  handleVideoToggleRef.current = handleVideoToggle;

  const handleModeSwitch = useCallback((mode: CaptureMode) => {
    if (isRecording) return;
    setCaptureMode(mode);
    if (Platform.OS !== 'web') {
      setIsReady(false);
    }
  }, [isRecording, setIsReady]);

  if (!camPerm) return <View style={styles.container} />;

  if (!camPerm.granted) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="camera-outline" size={72} color="#fff" />
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permSub}>
          SnapSend needs your camera to capture and instantly send photos and videos.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestCamPerm}>
          <Text style={styles.permBtnTxt}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flash}
        enableTorch={captureMode === 'video' && isRecording && flash === 'on'}
        mode={captureMode}
        onCameraReady={() => setIsReady(true)}
      />

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        {/* Flash */}
        <TouchableOpacity style={styles.topBtn} onPress={cycleFlash}>
          <Ionicons
            name={flash === 'on' ? 'flash' : flash === 'auto' ? 'flash-outline' : 'flash-off-outline'}
            size={22} color="#fff"
          />
        </TouchableOpacity>

        {/* Center: Recording badge when recording */}
        {isRecording ? (
          <View style={styles.recBadge}>
            <View style={styles.recDot} />
            <Text style={styles.recTimer}>{fmt(recordSeconds)}</Text>
          </View>
        ) : (
          <View style={{ width: 44 }} />
        )}

        {/* Flip */}
        <TouchableOpacity style={styles.topBtn} onPress={flipCamera}>
          <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Bottom controls ── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>

        {/* Mode toggle */}
        <View style={styles.modeWrap}>
          {(['picture', 'video'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeTab, captureMode === m && styles.modeTabActive]}
              onPress={() => handleModeSwitch(m)}
            >
              <Text style={[styles.modeTabTxt, captureMode === m && styles.modeTabTxtActive]}>
                {m === 'picture' ? '📷  PHOTO' : '🎥  VIDEO'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Capture button row */}
        <View style={styles.captureRow}>
          {/* Left spacer for centered shutter */}
          <View style={styles.sideBtn} />

          {/* Centre — shutter */}
          {captureMode === 'picture' ? (
            <TouchableOpacity
              style={[styles.shutterRing, sendStatus.state === 'sending' && { opacity: 0.4 }]}
              onPress={handleCapture}
              disabled={sendStatus.state === 'sending'}
              activeOpacity={0.75}
            >
              <View style={styles.shutterDisc} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.shutterRing, isRecording && styles.shutterRingRed]}
              onPress={handleVideoToggle}
              activeOpacity={0.75}
            >
              {isRecording
                ? <View style={styles.stopSquare} />
                : <View style={[styles.shutterDisc, { backgroundColor: '#ff3b30' }]} />}
            </TouchableOpacity>
          )}

          {/* Right — placeholder for symmetry */}
          <View style={styles.sideBtn} />
        </View>
      </View>

      {/* ── Send status overlay ── */}
      <SendStatusOverlay status={sendStatus} onRetry={retry} onDismiss={reset} />

      {/* ── Remote active indicator ── */}
      {Platform.OS !== 'web' && (
        <View style={[styles.remoteIndicator, { top: insets.top + 64 }]}>
          <Text style={styles.remoteIndicatorTxt}>🔘 Remote Ready</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  remoteIndicator: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,200,120,0.25)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,220,130,0.5)',
  },
  remoteIndicatorTxt: {
    color: 'rgba(0,255,150,0.9)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  center: { alignItems: 'center', justifyContent: 'center', padding: 36 },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  topBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center', justifyContent: 'center',
  },
  appLabel: {
    color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 1.5,
  },
  recBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(220,30,30,0.88)',
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', marginRight: 7 },
  recTimer: { color: '#fff', fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center',
  },
  modeWrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.52)',
    borderRadius: 22, padding: 3,
    marginBottom: 26,
  },
  modeTab: {
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: 19,
  },
  modeTabActive: { backgroundColor: '#fff' },
  modeTabTxt: { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '600' },
  modeTabTxtActive: { color: '#000' },

  captureRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-around', width: '100%', paddingHorizontal: 32, marginBottom: 6,
  },
  sideBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  shutterRing: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterRingRed: { borderColor: '#ff3b30' },
  shutterDisc: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
  stopSquare: {
    width: 28, height: 28, borderRadius: 5, backgroundColor: '#ff3b30',
  },

  permTitle: {
    color: '#fff', fontSize: 22, fontWeight: '700',
    marginTop: 24, marginBottom: 10, textAlign: 'center',
  },
  permSub: {
    color: 'rgba(255,255,255,0.6)', fontSize: 15,
    textAlign: 'center', lineHeight: 22, marginBottom: 32,
  },
  permBtn: {
    backgroundColor: '#007AFF', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14,
  },
  permBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
