import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useGetAccountMe, getGetAccountMeQueryKey } from '@workspace/api-client-react';
import { ActivityIndicator, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  const colors = useColors();

  const { data: accountMe, isLoading: isAccountLoading } = useGetAccountMe({
    query: {
      enabled: isSignedIn,
      queryKey: getGetAccountMeQueryKey(),
    }
  });

  if (!isLoaded || (isSignedIn && isAccountLoading)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/sign-in" />;
  }

  if (accountMe) {
    if (accountMe.role === 'none') {
      return <Redirect href="/role-selection" />;
    }
    
    if (accountMe.role === 'sub') {
      if (accountMe.subStatus !== 'approved') {
        return <Redirect href="/waiting" />;
      }
      return <Redirect href="/(sub)" />;
    }

    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}