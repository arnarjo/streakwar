import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ActivityIndicator, ScrollView, Platform, Alert,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import type { PremiumOffering } from '../hooks/usePremium';
import { C } from '../theme';


const PRO_FEATURES = [
  { icon: '🛡️', text: 'Streak freeze — protect 1 day per month' },
  { icon: '🌍', text: 'Public challenges visible in Discover' },
  { icon: '♾️', text: 'Unlimited participants per challenge' },
  { icon: '📸', text: 'Require photo proof' },
  { icon: '✏️', text: 'Custom scoring formulas' },
  { icon: '💎', text: 'Diamond league access' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  offering: PremiumOffering;
  onPurchase: (pkg: PurchasesPackage) => Promise<boolean>;
  onRestore: () => Promise<boolean>;
  reason?: string;
}

export default function UpgradeModal({ visible, onClose, offering, onPurchase, onRestore, reason }: Props) {
  const [loading, setLoading] = useState<'monthly' | 'yearly' | 'restore' | null>(null);
  const [selected, setSelected] = useState<'monthly' | 'yearly'>(
    offering?.yearly ? 'yearly' : 'monthly'
  );

  useEffect(() => {
    setSelected(offering?.yearly ? 'yearly' : 'monthly');
  }, [offering?.yearly]);

  async function handlePurchase() {
    const pkg = selected === 'yearly' ? offering.yearly : offering.monthly;
    if (!pkg) return;
    setLoading(selected);
    const success = await onPurchase(pkg);
    setLoading(null);
    if (success) {
      onClose();
    } else {
      Alert.alert('Purchase failed', 'Something went wrong. Please try again or restore your purchases.');
    }
  }

  async function handleRestore() {
    setLoading('restore');
    const success = await onRestore();
    setLoading(null);
    if (!success) {
      Alert.alert('Nothing to restore', 'No previous purchases found for this account.');
    }
  }

  const monthlyPrice = offering.monthly?.product.priceString ?? '$4.99';
  const yearlyPrice  = offering.yearly?.product.priceString  ?? '$34.99';
  const noRcKey = !offering.monthly && !offering.yearly;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.handle} />

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.badge}>STREAKWAR PRO</Text>
          <Text style={s.headline}>Win more{'\n'}challenges 🏆</Text>
          {reason ? <Text style={s.reason}>{reason}</Text> : null}

          <View style={s.socialProof}>
            <Text style={s.socialProofText}>⭐ Pro users win 3× more challenges</Text>
          </View>

          <View style={s.featureList}>
            {PRO_FEATURES.map(f => (
              <View key={f.text} style={s.featureRow}>
                <Text style={s.featureIcon}>{f.icon}</Text>
                <Text style={s.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          {noRcKey ? (
            __DEV__ ? (
              <View style={s.comingSoon}>
                <Text style={s.comingSoonText}>
                  RevenueCat not configured yet.{'\n'}
                  Add EXPO_PUBLIC_REVENUECAT_API_KEY_{Platform.OS.toUpperCase()} to eas.json.
                </Text>
              </View>
            ) : null
          ) : (
            <>
              <View style={s.plans}>
                <TouchableOpacity
                  style={[s.plan, selected === 'yearly' && s.planSelected]}
                  onPress={() => setSelected('yearly')}
                >
                  <View style={s.saveBadge}><Text style={s.saveBadgeText}>BEST VALUE</Text></View>
                  <Text style={s.planTitle}>Yearly</Text>
                  <Text style={s.planPrice}>{yearlyPrice}</Text>
                  {(() => {
                    const yearlyProduct = offering.yearly?.product;
                    if (yearlyProduct?.price && yearlyProduct.price > 0) {
                      const monthlyPrice = yearlyProduct.price / 12;
                      const symbol = yearlyProduct.priceString?.replace(/[\d.,\s]/g, '').trim() ?? '$';
                      return <Text style={s.planSub}>~{symbol}{monthlyPrice.toFixed(2)}/month</Text>;
                    }
                    return <Text style={s.planSub}>~$2.92/month</Text>;
                  })()}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.plan, selected === 'monthly' && s.planSelected]}
                  onPress={() => setSelected('monthly')}
                >
                  <Text style={s.planTitle}>Monthly</Text>
                  <Text style={s.planPrice}>{monthlyPrice}</Text>
                  <Text style={s.planSub}>per month</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[s.ctaBtn, loading && { opacity: 0.7 }]}
                onPress={handlePurchase}
                disabled={!!loading}
              >
                {loading === selected
                  ? <ActivityIndicator color="#000" />
                  : <Text style={s.ctaBtnText}>Get Pro — {selected === 'yearly' ? yearlyPrice : monthlyPrice}</Text>
                }
              </TouchableOpacity>

              <Text style={s.legal}>
                Cancel anytime. Subscription auto-renews unless cancelled at least 24 hours before renewal.
                {Platform.OS === 'ios' ? ' Managed in App Store settings.' : ' Managed in Google Play.'}
              </Text>

              <TouchableOpacity onPress={handleRestore} disabled={!!loading} style={s.restoreBtn}>
                {loading === 'restore'
                  ? <ActivityIndicator color={C.muted} size="small" />
                  : <Text style={s.restoreText}>Restore purchases</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
          <Text style={s.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginTop: 12 },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 60 },
  badge: { alignSelf: 'center', backgroundColor: C.gold + '20', borderWidth: 1, borderColor: C.gold + '40', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, fontSize: 11, fontWeight: '800', color: C.gold, letterSpacing: 1.5, marginBottom: 16 },
  headline: { fontSize: 32, fontWeight: '900', color: C.text, textAlign: 'center', lineHeight: 38, marginBottom: 8 },
  reason: { fontSize: 14, color: C.muted, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  socialProof: { backgroundColor: '#22C55E15', borderWidth: 1, borderColor: '#22C55E30', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'center', marginBottom: 20 },
  socialProofText: { fontSize: 13, fontWeight: '700', color: '#22C55E' },
  featureList: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, gap: 12, marginBottom: 24 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { fontSize: 22, width: 32, textAlign: 'center' },
  featureText: { fontSize: 15, color: C.text, fontWeight: '600', flex: 1 },
  plans: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  plan: { flex: 1, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  planSelected: { borderColor: C.primary, backgroundColor: C.primary + '10' },
  saveBadge: { backgroundColor: C.primary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 },
  saveBadgeText: { fontSize: 9, fontWeight: '800', color: '#000', letterSpacing: 0.5 },
  planTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  planPrice: { fontSize: 22, fontWeight: '900', color: C.text },
  planSub: { fontSize: 11, color: C.muted },
  ctaBtn: { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 20, alignItems: 'center', marginBottom: 12 },
  ctaBtnText: { fontSize: 18, fontWeight: '800', color: '#000' },
  legal: { fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 16, marginBottom: 16 },
  restoreBtn: { alignItems: 'center', paddingVertical: 8 },
  restoreText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  comingSoon: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 20, alignItems: 'center' },
  comingSoonText: { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  closeBtn: { position: 'absolute', top: 20, right: 20, width: 32, height: 32, borderRadius: 16, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: C.muted, fontSize: 14, fontWeight: '700' },
});
