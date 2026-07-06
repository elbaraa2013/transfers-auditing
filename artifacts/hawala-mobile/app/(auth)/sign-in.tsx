import { ThemedText } from '@/components/ThemedText'
import { ThemedView } from '@/components/ThemedView'
import { useSignIn } from '@clerk/expo'
import { type Href, Link, useRouter } from 'expo-router'
import React from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useColors } from '@/hooks/useColors'

export default function Page() {
  const { signIn, errors, fetchStatus } = useSignIn()
  const router = useRouter()
  const colors = useColors()

  const [emailAddress, setEmailAddress] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [code, setCode] = React.useState('')

  const handleSubmit = async () => {
    if (!signIn) return
    const { error } = await signIn.password({
      emailAddress,
      password,
    })
    if (error) {
      console.error(JSON.stringify(error, null, 2))
      return
    }

    if (signIn.status === 'complete') {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          router.replace('/')
        },
      })
    } else if (signIn.status === 'needs_client_trust') {
      const emailCodeFactor = signIn.supportedSecondFactors.find(
        (factor) => factor.strategy === 'email_code',
      )
      if (emailCodeFactor) {
        await signIn.mfa.sendEmailCode()
      }
    }
  }

  const handleVerify = async () => {
    if (!signIn) return
    await signIn.mfa.verifyEmailCode({ code })

    if (signIn.status === 'complete') {
      await signIn.finalize({
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

  if (signIn?.status === 'needs_client_trust') {
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
        تسجيل الدخول
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
        <ThemedText style={styles.buttonText}>دخول</ThemedText>
      </Pressable>

      <View style={styles.linkContainer}>
        <ThemedText>ليس لديك حساب؟ </ThemedText>
        <Link href="/sign-up">
          <ThemedText type="link">إنشاء حساب</ThemedText>
        </Link>
      </View>
    </ThemedView>
  )
}