import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { signInWithGoogle } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Fonts, Radius, Shadows } from '../constants/theme';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSignInPress = async () => {
    try {
      setLoading(true);
      console.log('Initiating Firebase Google sign in...');
      
      await signInWithGoogle();
      
      console.log('Sign in successful');
    } catch (error: any) {
      console.error('Error initiating sign in:', error);
      
      let errorMessage = error.message || 'Failed to sign in';
      
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in was cancelled';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Pop-up was blocked by your browser. Please allow pop-ups for this site.';
      }
      
      if (Platform.OS === 'web') {
        window.alert(errorMessage);
      } else {
        Alert.alert('Sign In Error', errorMessage);
      }
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>⚡</Text>
          </View>
          <Text style={styles.appName}>BoltUp</Text>
          <Text style={styles.tagline}>Connect, plan, and hang out with your crew</Text>
          
          {loading && (
            <View style={{ marginTop: 16, padding: 12, backgroundColor: Colors.surface, borderRadius: 8 }}>
              <Text style={{ fontSize: 12, color: Colors.textMuted, textAlign: 'center' }}>
                Signing in...
              </Text>
            </View>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.googleButton, loading && styles.buttonDisabled]}
            onPress={handleSignInPress}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={Colors.text} />
            ) : (
              <>
                <View style={styles.googleIcon}>
                  <Text style={styles.googleIconText}>G</Text>
                </View>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    gap: 16,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    ...Shadows.lg,
  },
  logo: {
    fontSize: 56,
  },
  appName: {
    fontSize: 36,
    fontFamily: Fonts.extraBold,
    color: Colors.text,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: Colors.textSub,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 24,
  },
  buttonContainer: {
    gap: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
    ...Shadows.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  googleIconText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
  disclaimer: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
