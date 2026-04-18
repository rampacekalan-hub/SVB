import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { api } from '../api';

interface Me {
  firstName: string;
  lastName: string;
  memberships: Array<{
    role: string;
    building: { id: string; name: string; city: string };
    apartment?: { unitNumber: string } | null;
  }>;
}

export function HomeScreen({ navigation }: any) {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api<Me>('/users/me').then(setMe).catch(() => navigation.replace('Login'));
  }, []);

  if (!me) return null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>Vitajte, {me.firstName}</Text>
      <Text style={styles.h2}>Vaše budovy</Text>
      {me.memberships.map((m) => (
        <Pressable
          key={m.building.id + m.role}
          style={styles.card}
          onPress={() => navigation.navigate('Voting', { buildingId: m.building.id })}
        >
          <Text style={styles.cardTitle}>{m.building.name}</Text>
          <Text>
            {m.building.city} · {m.role}
            {m.apartment && ` · byt ${m.apartment.unitNumber}`}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  h1: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
  h2: { fontSize: 18, fontWeight: '500', marginTop: 12, marginBottom: 8 },
  card: {
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#dde',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  cardTitle: { fontSize: 18, fontWeight: '500', marginBottom: 4 },
});
