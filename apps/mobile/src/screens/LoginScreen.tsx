import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  api,
  storeTokens,
  storeBiometricCredentials,
  readBiometricCredentials,
} from '../api';
import { colors, radius, space, typography, hitTarget } from '../theme';

export function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('vlastnik@domovplus.local');
  const [password, setPassword] = useState('DemoHeslo12345!');
  const [totpToken, setTotpToken] = useState('');
  const [mfa, setMfa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioStored, setBioStored] = useState(false);
  const t = typography(false);
  const h = hitTarget(false);

  useEffect(() => {
    (async () => {
      const supported = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBioAvailable(supported && enrolled);
      // Ak máme uložené credentials, ponúkneme biometric prihlásenie.
      const creds = await readBiometricCredentials().catch(() => null);
      setBioStored(!!creds);
    })();
  }, []);

  async function biometricLogin() {
    const ok = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Prihlásiť do DomovPlus',
      fallbackLabel: 'Použiť heslo',
    });
    if (!ok.success) return;
    const creds = await readBiometricCredentials();
    if (!creds) return;
    setEmail(creds.email);
    setPassword(creds.password);
    // Submit automaticky so zapamätanými údajmi.
    await doLogin(creds.email, creds.password, totpToken, false);
  }

  async function doLogin(
    emailArg: string,
    passwordArg: string,
    totpArg: string,
    saveBio: boolean,
  ) {
    setBusy(true);
    try {
      const body: Record<string, string> = { email: emailArg, password: passwordArg };
      if (totpArg) body.totpToken = totpArg;
      const res = await api<{ accessToken?: string; refreshToken?: string; mfaRequired?: boolean }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify(body) },
      );
      if (res.mfaRequired) {
        setMfa(true);
        return;
      }
      if (res.accessToken && res.refreshToken) {
        await storeTokens(res.accessToken, res.refreshToken);
        if (saveBio && bioAvailable) {
          await storeBiometricCredentials(emailArg, passwordArg).catch(() => void 0);
        }
        navigation.replace('Home');
      }
    } catch (e) {
      Alert.alert('Chyba prihlásenia', 'Nesprávne údaje. Skúste znova.');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    await doLogin(email, password, totpToken, bioAvailable && !bioStored);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>D+</Text>
          </View>
          <Text style={styles.brandText}>DomovPlus</Text>
        </View>

        <View style={styles.card}>
          <Text style={[t.h1, { marginBottom: 4 }]}>Vitajte späť</Text>
          <Text style={[t.muted, { marginBottom: space.lg }]}>
            Prihláste sa do vášho bytového domu.
          </Text>

          <Text style={t.label}>Email</Text>
          <TextInput
            style={[styles.input, { minHeight: h }]}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="vas@email.sk"
            placeholderTextColor={colors.fgSubtle}
          />

          <Text style={[t.label, { marginTop: space.md }]}>Heslo</Text>
          <TextInput
            style={[styles.input, { minHeight: h }]}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Vaše heslo"
            placeholderTextColor={colors.fgSubtle}
          />

          {mfa && (
            <>
              <Text style={[t.label, { marginTop: space.md }]}>Overovací kód (6 číslic)</Text>
              <TextInput
                style={[styles.input, { minHeight: h, letterSpacing: 4 }]}
                value={totpToken}
                onChangeText={(v) => setTotpToken(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
                placeholderTextColor={colors.fgSubtle}
              />
            </>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              { minHeight: h, opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
            ]}
            onPress={submit}
            disabled={busy}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.primaryBtnText}>Prihlásiť sa</Text>
            )}
          </Pressable>

          {bioAvailable && bioStored && (
            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                { minHeight: h, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={biometricLogin}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryBtnText}>🔐 Prihlásiť cez Face ID / odtlačok</Text>
            </Pressable>
          )}

          <View style={styles.demoHint}>
            <Text style={[t.subtle]}>
              Demo · <Text style={{ fontWeight: '600' }}>vlastnik@domovplus.local</Text> /{' '}
              <Text style={{ fontWeight: '600' }}>DemoHeslo12345!</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, flexGrow: 1, justifyContent: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: space.lg, justifyContent: 'center' },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: { color: 'white', fontWeight: '800', fontSize: 16 },
  brandText: { fontSize: 20, fontWeight: '700', color: colors.fg, letterSpacing: -0.3 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    fontSize: 16,
    backgroundColor: colors.surface,
    color: colors.fg,
  },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.lg,
  },
  primaryBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  secondaryBtnText: { color: colors.fg, fontSize: 15, fontWeight: '600' },
  demoHint: {
    marginTop: space.md,
    padding: space.sm,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
  },
});
