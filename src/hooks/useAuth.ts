// Re-export from AuthContext so all existing import paths continue to work.
// State and the onAuthStateChange subscription now live in AuthProvider (a singleton),
// eliminating the duplicate-subscription problem that existed when each call site
// instantiated its own hook instance.
export { useAuth, AuthProvider, AuthContext } from '../context/AuthContext';
export type { AuthContextValue } from '../context/AuthContext';
