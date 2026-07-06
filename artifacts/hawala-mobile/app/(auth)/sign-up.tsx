import { ThemedText } from '@/components/ThemedText'
import { ThemedView } from '@/components/ThemedView'
import { useAuth, useSignUp } from '@clerk/expo'
import { type Href, Link, useRouter } from 'expo-router'
import React from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useColors } from '@/hooks/useColors'

export default function Page() {
  const { signUp, errors, fetchStatus } = useSignUp()
  const { isSignedIn } = useAuth()
  const router = useRouter()
  const colors = useColors()

  const [emailAddress, setEmailAddress] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [code, setCode] = React.useState('')

  const handleSubmit = async () => {
    if (!signUp) return
    const { error } = await signUp.password({
      emailAddress,
      password,
    })
    if (error) {
      console.error(JSON.stringify(error, null, 2))
      return
    }

    if (!error) await signUp.verifications.sendEmailCode()
  }

  const handleVerify = async () => {
    if (!signUp) return
    await signUp.verifications.verifyEmailCode({ code })
    if (signUp.status === 'complete') {
      await signUp.finalize({
        navigate: ({ session, decorateUrl }) => {
          router.replace('/')
        },
      })
    }
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 24,
      justifyContent: 'center',
    },
    title: {
      marginBottom: 24,
      textAlign: 'center',
    },
    label: {
      marginBottom: 8,
      fontFamily: 'Cairo_600SemiBold',
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      padding: 12,
      marginBottom: 16,
      fontFamily: 'Cairo_400Regular',
      textAlign: 'right',
      writingDirection: 'rtl',
      backgroundColor: colors.card,
    },
    button: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: colors.radius,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: colors.primaryForeground,
      fontFamily: 'Cairo_700Bold',
      fontSize: 16,
    },
    error: {
      color: colors.destructive,
      marginBottom: 16,
      fontFamily: 'Cairo_400Regular',
      textAlign: 'right',
    },
    linkContainer: {
      flexDirection: 'row-reverse',
      justifyContent: 'center',
      marginTop: 24,
      gap: 4,
    },
  })

  if (signUp?.status === 'complete' || isSignedIn) {
    return null
  }

  if (
    signUp?.status === 'missing_requirements' &&
    signUp.unverifiedFields.includes('email_address') &&
    signUp.missingFields.length === 0
  ) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          تأكيد الحساب
        </ThemedText>
        <TextInput
          style={styles.input}
          value={code}
          placeholder="رمز التحقق"
          placeholderTextColor={colors.mutedForeground}
          onChangeText={(code) => setCode(code)}
          keyboardType="numeric"
        />
        <Pressable
          style={[styles.button, fetchStatus === 'fetching' && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={fetchStatus === 'fetching'}
        >
          <ThemedText style={styles.buttonText}>تحقق</ThemedText>
        </Pressable>
      </ThemedView>
    )
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        إنشاء حساب
      </ThemedText>

      <ThemedText style={styles.label}>البريد الإلكتروني</ThemedText>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        value={emailAddress}
        placeholder="أدخل البريد الإلكتروني"
        placeholderTextColor={colors.mutedForeground}
        onChangeText={(emailAddress) => setEmailAddress(emailAddress)}
        keyboardType="email-address"
      />

      <ThemedText style={styles.label}>كلمة المرور</ThemedText>
      <TextInput
        style={styles.input}
        value={password}
        placeholder="أدخل كلمة المرور"
        placeholderTextColor={colors.mutedForeground}
        secureTextEntry={true}
        onChangeText={(password) => setPassword(password)}
      />

      <Pressable
        style={[
          styles.button,
          (!emailAddress || !password || fetchStatus === 'fetching') && styles.buttonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!emailAddress || !password || fetchStatus === 'fetching'}
      >
        <ThemedText style={styles.buttonText}>إنشاء</ThemedText>
      </Pressable>

      <View style={styles.linkContainer}>
        <ThemedText>لديك حساب بالفعل؟ </ThemedText>
        <Link href="/sign-in">
          <ThemedText type="link">دخول</ThemedText>
        </Link>
      </View>
    </ThemedView>
  )
}