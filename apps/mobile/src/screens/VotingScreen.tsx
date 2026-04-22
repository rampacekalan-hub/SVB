import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { api, getDeviceId } from '../api';
import { colors, radius, space, typography, hitTarget } from '../theme';

interface Voting {
  id: string;
  title: string;
  description: string;
  status: string;
  closesAt: string;
  type: string;
  result?: { accepted: boolean; quorumReached: boolean };
}

const TYPE_LABEL: Record<string, string> = {
  SIMPLE_MAJORITY: 'Nadpolovičná väčšina',
  QUALIFIED_MAJORITY: 'Dvojtretinová väčšina',
  UNANIMOUS: 'Jednomyseľne',
};

export function VotingScreen({ route }: any) {
  const { buildingId, apartmentId, role } = route.params as {
    buildingId: string;
    apartmentId: string | null;
    role: string;
  };
  const canVote = !!apartmentId && role === 'OWNER';
  const [votings, setVotings] = useState<Voting[]>([]);
  const [loaded, setLoaded] = useState(false);
  const t = typography(false);
  const h = hitTarget(false);

  useEffect(() => {
    api<Voting[]>(`/voting/building/${buildingId}`)
      .then((v) => {
        setVotings(v);
        setLoaded(true);
      })
      .catch((e) => Alert.alert('Chyba', e.message));
  }, [buildingId]);

  async function cast(id: string, choice: 'YES' | 'NO' | 'ABSTAIN') {
    if (!apartmentId) {
      Alert.alert('Nemožno hlasovať', 'Nie ste registrovaný ako vlastník bytu v tejto budove.');
      return;
    }
    try {
      const deviceId = await getDeviceId();
      await api(`/voting/${id}/cast`, {
        method: 'POST',
        body: JSON.stringify({
          apartmentId,
          choice,
          sessionFingerprint: `device:${deviceId}:${id}`,
        }),
      });
      Alert.alert('Hlas zaznamenaný', 'Môžete ho zmeniť do uzávierky.');
    } catch (e) {
      Alert.alert('Chyba', (e as Error).message);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
      <Text style={t.h1}>Hlasovania</Text>
      <Text style={t.muted}>Váš hlas je právne záväzný. Listinný hlas má prednosť pred elektronickým.</Text>

      {loaded && votings.length === 0 && (
        <View style={styles.empty}>
          <Text style={{ fontSize: 30, marginBottom: 8 }}>🗳️</Text>
          <Text style={t.h3}>Žiadne aktívne hlasovanie</Text>
          <Text style={[t.muted, { textAlign: 'center' }]}>
            Keď predseda vytvorí hlasovanie, zobrazí sa tu.
          </Text>
        </View>
      )}

      {votings.map((v) => (
        <View key={v.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={[t.h3, { flex: 1 }]}>{v.title}</Text>
            <StatusBadge status={v.status} result={v.result} />
          </View>
          <Text style={[t.muted, { marginTop: 4 }]}>
            {TYPE_LABEL[v.type] ?? v.type} · uzávierka{' '}
            {new Date(v.closesAt).toLocaleString('sk-SK', {
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          <Text style={[t.body, { marginTop: space.sm }]}>{v.description}</Text>

          {v.status === 'OPEN' && canVote && (
            <View style={styles.voteRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.voteBtn,
                  styles.yes,
                  { minHeight: h, opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={() => cast(v.id, 'YES')}
                accessibilityLabel="Hlasovať ÁNO"
              >
                <Text style={styles.voteBtnText}>✓ ÁNO</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.voteBtn,
                  styles.no,
                  { minHeight: h, opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={() => cast(v.id, 'NO')}
                accessibilityLabel="Hlasovať NIE"
              >
                <Text style={styles.voteBtnText}>✕ NIE</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.voteBtn,
                  styles.abstain,
                  { minHeight: h, opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={() => cast(v.id, 'ABSTAIN')}
                accessibilityLabel="Zdržať sa"
              >
                <Text style={[styles.voteBtnText, { color: colors.fg }]}>Zdržať sa</Text>
              </Pressable>
            </View>
          )}

          {v.status === 'OPEN' && !canVote && (
            <View style={styles.resultBox}>
              <Text style={t.muted}>
                Pre hlasovanie musíte byť zaregistrovaný ako vlastník bytu v tejto budove.
              </Text>
            </View>
          )}

          {v.result && (
            <View style={styles.resultBox}>
              <Text style={[t.body, { fontWeight: '600' }]}>
                Výsledok: {v.result.accepted ? '✓ Prijaté' : '✕ Zamietnuté'}
              </Text>
              <Text style={t.muted}>
                Kvórum {v.result.quorumReached ? 'dosiahnuté' : 'nedosiahnuté'}
              </Text>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function StatusBadge({ status, result }: { status: string; result?: Voting['result'] }) {
  let bg = colors.surface2;
  let fg = colors.fgMuted;
  let label: string = status;
  if (status === 'OPEN') {
    bg = colors.infoSoft;
    fg = colors.info;
    label = 'Prebieha';
  } else if (status === 'DRAFT') {
    label = 'Pripravené';
  } else if (result?.accepted) {
    bg = colors.successSoft;
    fg = colors.success;
    label = 'Prijaté';
  } else if (status === 'CLOSED') {
    label = 'Uzavreté';
  }
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, paddingBottom: space.xxl },
  card: {
    padding: space.lg,
    marginTop: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  voteRow: { flexDirection: 'row', gap: 8, marginTop: space.md },
  voteBtn: { flex: 1, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  voteBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  yes: { backgroundColor: colors.success },
  no: { backgroundColor: colors.danger },
  abstain: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderStrong },
  empty: {
    alignItems: 'center',
    padding: space.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginTop: space.md,
  },
  resultBox: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
  },
});
