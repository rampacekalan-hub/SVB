import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { api } from '../api';
import { colors, radius, space, typography, hitTarget } from '../theme';

interface Me {
  firstName: string;
  lastName: string;
  memberships: Array<{
    role: string;
    building: { id: string; name: string; city: string };
    apartment?: { unitNumber: string } | null;
  }>;
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Vlastník',
  CHAIRMAN: 'Predseda',
  MANAGER: 'Správca',
  MAINTENANCE: 'Údržba',
  ADMIN: 'Administrátor',
};

export function HomeScreen({ navigation }: any) {
  const [me, setMe] = useState<Me | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const t = typography(false);
  const h = hitTarget(false);

  function load() {
    return api<Me>('/users/me')
      .then(setMe)
      .catch(() => navigation.replace('Login'));
  }
  useEffect(() => {
    load();
  }, []);

  const hour = new Date().getHours();
  const greet = hour < 11 ? 'Dobré ráno' : hour < 18 ? 'Dobrý deň' : 'Dobrý večer';

  if (!me) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={colors.brand}
        />
      }
    >
      <Text style={t.h1}>
        {greet}, {me.firstName}.
      </Text>
      <Text style={t.muted}>Vyberte si budovu, ktorú chcete spravovať.</Text>

      <Text style={[t.h2, { marginTop: space.xl }]}>Vaše budovy</Text>

      {me.memberships.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Text style={{ fontSize: 30 }}>🏠</Text>
          </View>
          <Text style={[t.h3, { marginTop: 8 }]}>Zatiaľ žiadna budova</Text>
          <Text style={[t.muted, { textAlign: 'center' }]}>
            Požiadajte správcu o aktivačný kód z vyúčtovania.
          </Text>
        </View>
      ) : (
        me.memberships.map((m) => (
          <Pressable
            key={m.building.id + m.role}
            style={({ pressed }) => [styles.card, { minHeight: h, opacity: pressed ? 0.85 : 1 }]}
            onPress={() =>
              navigation.navigate('Voting', {
                buildingId: m.building.id,
                apartmentId: m.role === 'OWNER' ? m.apartment?.id ?? null : null,
                role: m.role,
              })
            }
            accessibilityRole="button"
            accessibilityLabel={`${m.building.name}, ${ROLE_LABEL[m.role] ?? m.role}`}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.cardHeader}>
                <Text style={t.h3} numberOfLines={1}>
                  {m.building.name}
                </Text>
                <View style={styles.rolePill}>
                  <Text style={styles.rolePillText}>{ROLE_LABEL[m.role] ?? m.role}</Text>
                </View>
              </View>
              <Text style={[t.muted, { marginTop: 4 }]}>
                📍 {m.building.city}
                {m.apartment && `  ·  byt ${m.apartment.unitNumber}`}
              </Text>
            </View>
            <Text style={{ color: colors.fgSubtle, fontSize: 24 }}>›</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, paddingBottom: space.xxl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: space.lg,
    marginBottom: space.md,
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' },
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.infoSoft,
  },
  rolePillText: { fontSize: 12, fontWeight: '600', color: colors.info },
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
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
