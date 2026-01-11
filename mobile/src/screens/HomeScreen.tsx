import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getInvoices } from '../services/database';
import OfflineBadge from '../components/OfflineBadge';
import { useNetwork } from '../contexts/NetworkContext';

export default function HomeScreen(props: any) {
  const { t } = useTranslation();
  const [count, setCount] = useState(0);
  const { isOnline } = useNetwork();

  useEffect(() => {
    let mounted = true;

    void getInvoices()
      .then((rows) => {
        if (!mounted) return;
        setCount(rows.length);
      })
      .catch(() => setCount(0));

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
          <OfflineBadge online={isOnline} />
        <Text style={styles.h1}>{t('home.welcome')}</Text>
        <Text style={styles.sub}>{t('home.offlineNotice')}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('home.monthlySales')}</Text>
          <Text style={styles.cardValue}>₦0.00</Text>
          <Text style={styles.cardMeta}>{count} invoices stored on this phone</Text>
        </View>

        <Pressable style={styles.cta} onPress={() => props.navigation.navigate('Create')}>
          <Text style={styles.ctaText}>{t('home.createInvoice')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F4F7' },
  container: { flex: 1, padding: 16 },
  h1: { fontSize: 24, fontWeight: '800', color: '#101828', marginBottom: 6 },
  sub: { color: '#475467', marginBottom: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    marginBottom: 16
  },
  cardTitle: { color: '#667085', fontWeight: '700' },
  cardValue: { fontSize: 28, fontWeight: '900', color: '#101828', marginTop: 8 },
  cardMeta: { marginTop: 8, color: '#667085' },
  cta: {
    backgroundColor: '#0B5FFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center'
  },
  ctaText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 }
});
