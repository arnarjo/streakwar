// Auth state now lives in a single AuthProvider (src/contexts/AuthContext.tsx)
// that owns the one-and-only supabase.auth.onAuthStateChange subscription.
// This re-export keeps existing `import { useAuth } from '../hooks/useAuth'`
// call sites working unchanged.
export { useAuth } from '../contexts/AuthContext';
export type { AuthContextValue } from '../contexts/AuthContext';
