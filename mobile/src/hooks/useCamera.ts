import { useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { CameraView, CameraType, FlashMode } from 'expo-camera';
import { CapturedMedia } from '../types';

export function useCamera() {
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [isReady, setIsReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Web recording refs
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webAudioStreamRef = useRef<MediaStream | null>(null);

  const flipCamera = useCallback(() => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  }, []);

  const cycleFlash = useCallback(() => {
    const order: FlashMode[] = ['off', 'on', 'auto'];
    setFlash((f) => order[(order.indexOf(f) + 1) % order.length]);
  }, []);

  const takePhoto = useCallback(async (): Promise<CapturedMedia | null> => {
    if (!cameraRef.current) {
      console.warn('[useCamera] cameraRef is not available');
      return null;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!photo?.uri) {
        console.warn('[useCamera] takePictureAsync returned no URI', photo);
        return null;
      }
      console.log('[useCamera] photo URI:', photo.uri, 'size:', photo.width, 'x', photo.height);
      return { uri: photo.uri, type: 'photo', width: photo.width, height: photo.height };
    } catch (e) {
      console.error('[useCamera] takePhoto error:', e);
      return null;
    }
  }, []);

  const startRecording = useCallback(async (): Promise<CapturedMedia | null> => {
    if (isRecording) return null;

    // ── Web Video Recording via MediaRecorder ──
    if (Platform.OS === 'web') {
      try {
        const videoEl = typeof document !== 'undefined' ? document.querySelector('video') : null;
        const videoStream = videoEl?.srcObject as MediaStream | null;
        if (!videoStream) {
          console.error('[useCamera] No active camera stream found for recording');
          return null;
        }

        const videoTrack = videoStream.getVideoTracks()[0];
        if (!videoTrack) {
          console.error('[useCamera] No video track available');
          return null;
        }

        const tracks: MediaStreamTrack[] = [videoTrack];

        // Request microphone stream on web if possible
        try {
          if (navigator?.mediaDevices?.getUserMedia) {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            webAudioStreamRef.current = audioStream;
            const audioTrack = audioStream.getAudioTracks()[0];
            if (audioTrack) tracks.push(audioTrack);
          }
        } catch (audioErr) {
          console.warn('[useCamera] Audio permission not granted or mic unavailable, recording video only:', audioErr);
        }

        const combinedStream = new MediaStream(tracks);

        // Find supported MIME type
        const candidates = [
          'video/mp4;codecs=avc1,mp4a.40.2',
          'video/mp4',
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
        ];
        let selectedMime = '';
        for (const candidate of candidates) {
          if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(candidate)) {
            selectedMime = candidate;
            break;
          }
        }

        const recorder = selectedMime
          ? new MediaRecorder(combinedStream, { mimeType: selectedMime })
          : new MediaRecorder(combinedStream);

        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        const recordingPromise = new Promise<CapturedMedia | null>((resolve) => {
          const maxTimer = setTimeout(() => {
            if (recorder.state === 'recording') {
              recorder.stop();
            }
          }, 60000); // 60s max

          recorder.onstop = () => {
            clearTimeout(maxTimer);

            // Clean up microphone tracks so browser mic indicator turns off
            if (webAudioStreamRef.current) {
              webAudioStreamRef.current.getTracks().forEach((t) => t.stop());
              webAudioStreamRef.current = null;
            }

            if (chunks.length === 0) {
              resolve(null);
              return;
            }

            const outputMime = selectedMime || 'video/mp4';
            const blob = new Blob(chunks, { type: outputMime });
            const uri = URL.createObjectURL(blob);
            resolve({ uri, type: 'video' });
          };

          recorder.onerror = (err) => {
            clearTimeout(maxTimer);
            console.error('[useCamera] MediaRecorder error:', err);
            resolve(null);
          };
        });

        webRecorderRef.current = recorder;
        recorder.start(500);
        setIsRecording(true);

        const result = await recordingPromise;
        setIsRecording(false);
        webRecorderRef.current = null;
        return result;
      } catch (err) {
        console.error('[useCamera] Web recording failed to start:', err);
        setIsRecording(false);
        return null;
      }
    }

    // ── Native Mobile Recording via CameraView ──
    if (!cameraRef.current) return null;
    setIsRecording(true);
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: 60 });
      return video?.uri ? { uri: video.uri, type: 'video' } : null;
    } catch (e) {
      console.error('[useCamera] startRecording error:', e);
      return null;
    } finally {
      setIsRecording(false);
    }
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    if (Platform.OS === 'web') {
      if (webRecorderRef.current && webRecorderRef.current.state !== 'inactive') {
        webRecorderRef.current.stop();
      }
      return;
    }
    cameraRef.current?.stopRecording();
  }, []);

  return {
    cameraRef,
    facing,
    flash,
    isReady,
    isRecording,
    setIsReady,
    flipCamera,
    cycleFlash,
    takePhoto,
    startRecording,
    stopRecording,
  };
}
