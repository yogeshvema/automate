import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/store/settingsStore';
import { TelegramProvider } from '@/providers/telegram/TelegramProvider';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    destination,
    setDestination,
    clearDestination,
    autoSendEnabled,
    setAutoSendEnabled,
  } = useSettingsStore();

  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (destination?.config) {
      setBotToken(destination.config.botToken ?? '');
      setChatId(destination.config.chatId ?? '');
    }
  }, [destination]);

  const validate = () => {
    if (!botToken.trim() || !chatId.trim()) {
      Alert.alert('Missing Fields', 'Please enter both Bot Token and Chat ID.');
      return false;
    }
    return true;
  };

  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const handleTest = useCallback(async () => {
    if (!validate()) return;
    setTesting(true);
    setTestResult(null);
    setSaveSuccessMsg(null);
    try {
      const provider = new TelegramProvider({
        botToken: botToken.trim(),
        chatId: chatId.trim(),
      });
      const res = await provider.testConnectionDetailed();
      setTestResult({
        ok: res.ok,
        msg: res.message,
      });
    } catch (e: any) {
      setTestResult({ ok: false, msg: e?.message ?? 'Connection failed' });
    } finally {
      setTesting(false);
    }
  }, [botToken, chatId]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveSuccessMsg(null);
    try {
      const trimmedToken = botToken.trim();
      const trimmedChatId = chatId.trim();
      await setDestination({
        id: 'telegram-default',
        name: 'My Telegram',
        providerType: 'telegram',
        config: { botToken: trimmedToken, chatId: trimmedChatId },
        isDefault: true,
      });
      setSaveSuccessMsg('✓ Saved! You can now take photos in the Camera tab to send them.');
      if (Platform.OS !== 'web') {
        Alert.alert('Saved', 'Destination saved. You can now capture and send media!');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [botToken, chatId, setDestination]);

  const handleClear = useCallback(() => {
    Alert.alert('Clear Settings', 'Remove the saved destination?', [
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await clearDestination();
          setBotToken('');
          setChatId('');
          setTestResult(null);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [clearDestination]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#000' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.screenTitle}>Settings</Text>

        {/* ── Auto-Send Behavior ON/OFF ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AUTO-SEND BEHAVIOR</Text>
          <View style={styles.switchRowCard}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.switchTitle}>Auto-Send Media</Text>
              <Text style={styles.switchSub}>
                {autoSendEnabled
                  ? 'Capturing automatically sends to receiver immediately.'
                  : 'Off: Captures photo/video locally without auto-sending.'}
              </Text>
            </View>
            <Switch
              value={autoSendEnabled}
              onValueChange={setAutoSendEnabled}
              trackColor={{ false: '#3a3a3c', true: '#34c759' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* ── Active destination chip ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DESTINATION</Text>
          <View style={styles.providerCard}>
            <View style={styles.providerIcon}>
              <Ionicons name="send" size={20} color="#0088cc" />
            </View>
            <Text style={styles.providerName}>Telegram</Text>
            <View style={[styles.badge, destination ? styles.badgeActive : styles.badgeInactive]}>
              <Text style={[styles.badgeTxt, destination ? styles.badgeTxtActive : styles.badgeTxtInactive]}>
                {destination ? 'Configured' : 'Not set'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Configuration ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TELEGRAM CONFIGURATION</Text>

          <Text style={styles.fieldLabel}>Bot Token</Text>
          <TextInput
            style={styles.input}
            value={botToken}
            onChangeText={(t) => { setBotToken(t); setTestResult(null); }}
            placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ"
            placeholderTextColor="rgba(255,255,255,0.25)"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          <Text style={styles.hint}>
            Create a bot via @BotFather on Telegram, then copy the token here.
          </Text>

          <Text style={styles.fieldLabel}>Chat ID</Text>
          <TextInput
            style={styles.input}
            value={chatId}
            onChangeText={(t) => { setChatId(t); setTestResult(null); }}
            placeholder="-1001234567890  or  @yourchannel"
            placeholderTextColor="rgba(255,255,255,0.25)"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
            returnKeyType="done"
          />
          <Text style={styles.hint}>
            Your personal chat ID, a group ID, or a @channel username.
            Send /start to your bot and use @userinfobot to find your ID.
          </Text>
          {chatId.length > 5 && !chatId.startsWith('-') && !chatId.startsWith('@') && (
            <Text style={[styles.hint, { color: '#ff9500', marginTop: 4 }]}>
              💡 Note: If this is a Telegram group, make sure it starts with a minus sign (e.g. -{chatId}).
            </Text>
          )}
        </View>

        {/* ── Test result ── */}
        {testResult && (
          <View style={[styles.resultBox, testResult.ok ? styles.resultOk : styles.resultFail]}>
            <Ionicons
              name={testResult.ok ? 'checkmark-circle' : 'close-circle'}
              size={18}
              color={testResult.ok ? '#34c759' : '#ff3b30'}
            />
            <Text style={[styles.resultTxt, { color: testResult.ok ? '#34c759' : '#ff3b30' }]}>
              {testResult.msg}
            </Text>
          </View>
        )}

        {/* ── Save success banner ── */}
        {saveSuccessMsg && (
          <View style={[styles.resultBox, styles.resultOk]}>
            <Ionicons name="checkmark-circle" size={18} color="#34c759" />
            <Text style={[styles.resultTxt, { color: '#34c759' }]}>
              {saveSuccessMsg}
            </Text>
          </View>
        )}

        {/* ── Actions ── */}
        <TouchableOpacity
          style={styles.testBtn}
          onPress={handleTest}
          disabled={testing}
          activeOpacity={0.8}
        >
          {testing
            ? <ActivityIndicator size="small" color="#fff" />
            : (
              <>
                <Ionicons name="wifi" size={17} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.testBtnTxt}>Test Connection</Text>
              </>
            )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.saveBtnTxt}>Save Destination</Text>}
        </TouchableOpacity>

        {destination && (
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={16} color="#ff3b30" style={{ marginRight: 6 }} />
            <Text style={styles.clearBtnTxt}>Remove Destination</Text>
          </TouchableOpacity>
        )}

        {/* ── Info ── */}
        <View style={styles.infoRow}>
          <Ionicons name="lock-closed-outline" size={15} color="rgba(255,255,255,0.35)" />
          <Text style={styles.infoTxt}>
            Your bot token is stored in your device's secure keychain and never transmitted
            to any third-party server.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#000' },
  content: { paddingHorizontal: 20 },
  screenTitle: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 32 },

  section: { marginBottom: 28 },
  sectionLabel: {
    color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12,
  },

  switchRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  switchTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  switchSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    lineHeight: 18,
  },

  providerCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1c1c1e', borderRadius: 14, padding: 14, gap: 12,
  },
  providerIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(0,136,204,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  providerName: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeActive: { backgroundColor: 'rgba(52,199,89,0.15)' },
  badgeInactive: { backgroundColor: 'rgba(255,255,255,0.08)' },
  badgeTxt: { fontSize: 12, fontWeight: '600' },
  badgeTxtActive: { color: '#34c759' },
  badgeTxtInactive: { color: 'rgba(255,255,255,0.4)' },

  fieldLabel: {
    color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: '500',
    marginBottom: 8, marginTop: 16,
  },
  input: {
    backgroundColor: '#1c1c1e', borderRadius: 12,
    paddingHorizontal: 15, paddingVertical: 14,
    color: '#fff', fontSize: 15,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  hint: {
    color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 6, lineHeight: 18,
  },

  resultBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 12, padding: 14, marginBottom: 18,
  },
  resultOk: { backgroundColor: 'rgba(52,199,89,0.1)' },
  resultFail: { backgroundColor: 'rgba(255,59,48,0.1)' },
  resultTxt: { fontSize: 14, flex: 1, lineHeight: 20 },

  testBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1c1c1e', borderRadius: 14, paddingVertical: 15,
    marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  testBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '600' },

  saveBtn: {
    backgroundColor: '#007AFF', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 12,
  },
  saveBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },

  clearBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, marginBottom: 28,
  },
  clearBtnTxt: { color: '#ff3b30', fontSize: 15, fontWeight: '500' },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoTxt: { color: 'rgba(255,255,255,0.3)', fontSize: 12, lineHeight: 18, flex: 1 },
});
