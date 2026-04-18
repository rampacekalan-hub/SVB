import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { api, storeTokens } from '../api';

export function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('vlastnik@domovplus.local');
  const [password, setPassword] = useState('DemoHeslo12345!');
  const [totpToken, setTotpToken] = useState('');
  const [mfa, setMfa] = useState(false);

  async function submit() {
    try {
      const body: Record<string, string> = { email, password };
      if (totpToken) body.totpToken = totpToken;
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
        navigation.replace('Home');
      }
    } catch (e) {
      Alert.alert('Chyba prihlásenia', (e as Error).message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Text style={styles.label}>Heslo</Text>
      <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />
      {mfa && (
        <>
          <Text style={styles.label}>TOTP kód</Text>
          <TextInput
            style={styles.input}
            value={totpToken}
            onChangeText={setTotpToken}
            keyboardType="number-pad"
            maxLength={6}
          />
        </>
      )}
      <Button title="Prihlásiť" onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, flex: 1, justifyContent: 'center' },
  label: { fontSize: 16, marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 10, fontSize: 16 },
});
