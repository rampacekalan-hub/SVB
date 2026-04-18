import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { api } from '../api';

interface Voting {
  id: string;
  title: string;
  description: string;
  status: string;
  closesAt: string;
  type: string;
  result?: { accepted: boolean; quorumReached: boolean };
}

export function VotingScreen({ route }: any) {
  const { buildingId } = route.params;
  const [votings, setVotings] = useState<Voting[]>([]);

  useEffect(() => {
    api<Voting[]>(`/voting/building/${buildingId}`).then(setVotings).catch((e) =>
      Alert.alert('Chyba', e.message),
    );
  }, [buildingId]);

  async function cast(id: string, choice: 'YES' | 'NO' | 'ABSTAIN') {
    try {
      await api(`/voting/${id}/cast`, {
        method: 'POST',
        body: JSON.stringify({
          apartmentId: '',
          choice,
          sessionFingerprint: `mobile-${Date.now()}`,
        }),
      });
      Alert.alert('Hlas zaznamenaný', 'Môžete ho zmeniť do uzávierky.');
    } catch (e) {
      Alert.alert('Chyba', (e as Error).message);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>Hlasovania</Text>
      {votings.length === 0 && <Text>Žiadne hlasovania.</Text>}
      {votings.map((v) => (
        <View key={v.id} style={styles.card}>
          <Text style={styles.title}>{v.title}</Text>
          <Text style={styles.meta}>
            {v.status} · uzávierka {new Date(v.closesAt).toLocaleString('sk-SK')}
          </Text>
          <Text>{v.description}</Text>
          {v.status === 'OPEN' && (
            <View style={styles.row}>
              <Pressable style={[styles.btn, styles.yes]} onPress={() => cast(v.id, 'YES')}>
                <Text style={styles.btnText}>ÁNO</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.no]} onPress={() => cast(v.id, 'NO')}>
                <Text style={styles.btnText}>NIE</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.abstain]}
                onPress={() => cast(v.id, 'ABSTAIN')}
              >
                <Text style={styles.btnText}>Zdržať sa</Text>
              </Pressable>
            </View>
          )}
          {v.result && (
            <Text style={{ marginTop: 8 }}>
              Výsledok: {v.result.accepted ? 'PRIJATÉ' : 'ZAMIETNUTÉ'} (kvórum{' '}
              {v.result.quorumReached ? 'OK' : 'nedosiahnuté'})
            </Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  h1: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
  card: {
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dde',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  title: { fontSize: 18, fontWeight: '500', marginBottom: 4 },
  meta: { color: '#666', marginBottom: 6 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: { flex: 1, padding: 10, borderRadius: 6, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '600' },
  yes: { backgroundColor: '#2f855a' },
  no: { backgroundColor: '#c53030' },
  abstain: { backgroundColor: '#718096' },
});
