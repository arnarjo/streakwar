import { useState, useEffect, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import { supabase } from '../lib/supabase';

// Lazy-load native module so the app doesn't crash if it's not linked in this build
let Purchases: typeof import('react-native-purchases').default | null = null;
try { Purchases = require('react-native-purchases').default; } catch {}
type PurchasesPackage = import('react-native-purchases').PurchasesPackage;

const ENTITLEMENT_PRO = 'pro';

const RC_API_KEY = Platform.select({
  ios:     process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS     ?? '',
  android: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? '',
  default: '',
})!;

let _configured = false;

const RC_KEY_VALID = RC_API_KEY.startsWith('appl_') || RC_API_KEY.startsWith('goog_') || RC_API_KEY.startsWith('test_');

export function configurePurchases(userId: string) {
  if (!Purchases || !RC_KEY_VALID) return;
  if (!_configured) {
    try {
      Purchases.configure({ apiKey: RC_API_KEY });
      _configured = true;
    } catch { return; }
  }
  Purchases.logIn(userId).catch(() => {});
}

export function logOutPurchases() {
  if (!Purchases || !_configured) return;
  Purchases.logOut().catch(() => {});
}

export interface PremiumOffering {
  monthly: PurchasesPackage | null;
  yearly:  PurchasesPackage | null;
}

export function usePremium(userId: string) {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offering, setOffering] = useState<PremiumOffering>({ monthly: null, yearly: null });

  const refresh = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const { data } = await supabase
      .from('profiles')
      .select('is_pro, pro_expires_at')
      .eq('id', userId)
      .single();
    if (data) {
      const active = data.is_pro && (
        !data.pro_expires_at || new Date(data.pro_expires_at) > new Date()
      );
      setIsPro(active);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!Purchases || !RC_KEY_VALID) return;
    Purchases.getOfferings().then(offerings => {
      const current = offerings.current;
      if (!current) return;
      const monthly = current.monthly ?? null;
      const yearly  = current.annual  ?? null;
      setOffering({ monthly, yearly });
    }).catch(() => {});
  }, []);

  async function purchase(pkg: PurchasesPackage): Promise<boolean> {
    if (!Purchases) return false;
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const entitlement = customerInfo.entitlements.active[ENTITLEMENT_PRO];
      const pro = !!entitlement;
      if (pro) {
        await supabase
          .from('profiles')
          .update({ is_pro: true, pro_expires_at: entitlement?.expirationDate ?? null })
          .eq('id', userId);
        setIsPro(true);
      }
      return pro;
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Purchase failed', e.message ?? 'Something went wrong.');
      }
      return false;
    }
  }

  async function restore(): Promise<boolean> {
    if (!Purchases) return false;
    try {
      const info = await Purchases.restorePurchases();
      const entitlement = info.entitlements.active[ENTITLEMENT_PRO];
      const pro = !!entitlement;
      if (pro) {
        await supabase
          .from('profiles')
          .update({ is_pro: true, pro_expires_at: entitlement?.expirationDate ?? null })
          .eq('id', userId);
      }
      setIsPro(pro);
      Alert.alert(pro ? 'Restored!' : 'Nothing to restore', pro ? 'Pro is active.' : 'No active subscription found.');
      return pro;
    } catch {
      return false;
    }
  }

  const FREE_MAX_CHALLENGES = 2;

  return {
    isPro,
    loading,
    offering,
    purchase,
    restore,
    refresh,
    FREE_MAX_CHALLENGES,
  };
}
