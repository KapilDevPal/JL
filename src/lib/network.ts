import { useNetworkState } from 'expo-network';

/** True unless the device reports that it has no connection. */
export function useIsOnline(): boolean {
  const state = useNetworkState();
  return !(state.isConnected === false || state.isInternetReachable === false);
}
