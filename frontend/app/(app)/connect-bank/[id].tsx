import { createRequisition, getAccounts, getRequisitionStatus, linkAccountsToUser } from '@/app/api/gocardlessApi';
import { darkTheme } from '@/constants/theme';
import { sharedStyles } from '@/styles/sharedStyles';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export default function ConnectBankDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'initial' | 'connecting' | 'verifying'>('initial');
  const [checkInterval, setCheckInterval] = useState<NodeJS.Timeout | null>(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, [checkInterval]);

  const checkRequisitionStatus = async (requisitionId: string) => {
    try {
      const status = await getRequisitionStatus(requisitionId);

      if (status.status === 'GA') {
        // Still linking, continue checking
        return false;
      } else if (status.status === 'LN') {
        // Successfully linked
        return true;
      } else {
        // Failed or other status
        throw new Error('Bank connection failed');
      }
    } catch (err) {
      throw err;
    }
  };

  const handleConnect = async () => {
    try {
      setLoading(true);
      setError(null);
      setStep('connecting');

      // Create a requisition for the selected bank
      const requisition = await createRequisition(id as string);

      // Open the bank's authentication page in the browser
      const result = await WebBrowser.openAuthSessionAsync(
        requisition.link,
        'wealthapp://'
      );

      if (result.type === 'success') {
        setStep('verifying');

        // Start polling for requisition status
        const interval = setInterval(async () => {
          try {
            const isComplete = await checkRequisitionStatus(requisition.id);

            if (isComplete) {
              clearInterval(interval);

              // Get accounts if authorization was successful
              const accounts = await getAccounts(requisition.id);

              // Link accounts to user
              await linkAccountsToUser(requisition.id, accounts.map(acc => acc.id));

              // Navigate back to accounts page
              router.push('/(app)/(tabs)/accounts');
            }
          } catch (err) {
            clearInterval(interval);
            setError('Bank connection failed. Please try again.');
            setStep('initial');
          }
        }, 2000); // Check every 2 seconds

        setCheckInterval(interval);
      } else {
        setError('Connection cancelled. Please try again.');
        setStep('initial');
      }
    } catch (err) {
      setError('Failed to connect to bank. Please try again.');
      console.error('Error connecting to bank:', err);
      setStep('initial');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 'connecting':
        return (
          <>
            <ActivityIndicator size="large" color={darkTheme.colors.primary} />
            <Text style={styles.statusText}>Connecting to your bank...</Text>
            <Text style={styles.statusSubtext}>
              You'll be redirected to your bank's login page
            </Text>
          </>
        );
      case 'verifying':
        return (
          <>
            <ActivityIndicator size="large" color={darkTheme.colors.primary} />
            <Text style={styles.statusText}>Verifying connection...</Text>
            <Text style={styles.statusSubtext}>
              Please wait while we securely connect your accounts
            </Text>
          </>
        );
      default:
        return (
          <>
            <View style={styles.securityContainer}>
              <Ionicons name="shield-checkmark" size={48} color={darkTheme.colors.success} />
              <Text style={styles.securityTitle}>Secure Connection</Text>
              <Text style={styles.securityText}>
                Your banking credentials are never stored. We use industry-standard encryption
                to securely connect to your bank.
              </Text>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={24} color={darkTheme.colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Pressable
              style={[styles.connectButton, loading && styles.connectButtonDisabled]}
              onPress={handleConnect}
              disabled={loading}
            >
              <Text style={styles.connectButtonText}>
                {loading ? 'Connecting...' : 'Connect Bank'}
              </Text>
            </Pressable>
          </>
        );
    }
  };

  return (
    <View style={[sharedStyles.container]}>
      <View style={sharedStyles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={darkTheme.colors.text} />
        </Pressable>
        <Text style={sharedStyles.headerTitle}>Connect Bank</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[sharedStyles.body, styles.content]}>
        {renderStepContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    padding: darkTheme.spacing.s,
  },
  content: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: darkTheme.spacing.xl,
  },
  securityContainer: {
    alignItems: 'center',
    marginBottom: darkTheme.spacing.xl,
  },
  securityTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: darkTheme.colors.text,
    marginTop: darkTheme.spacing.m,
    marginBottom: darkTheme.spacing.s,
  },
  securityText: {
    fontSize: 16,
    color: darkTheme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  connectButton: {
    backgroundColor: darkTheme.colors.primary,
    paddingVertical: darkTheme.spacing.m,
    paddingHorizontal: darkTheme.spacing.xl,
    borderRadius: darkTheme.borderRadius.m,
    width: '100%',
    alignItems: 'center',
    ...darkTheme.shadows.small,
  },
  connectButtonDisabled: {
    opacity: 0.7,
  },
  connectButtonText: {
    color: darkTheme.colors.background,
    fontSize: 18,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${darkTheme.colors.error}20`,
    padding: darkTheme.spacing.m,
    borderRadius: darkTheme.borderRadius.m,
    marginBottom: darkTheme.spacing.l,
    width: '100%',
  },
  errorText: {
    color: darkTheme.colors.error,
    marginLeft: darkTheme.spacing.s,
    flex: 1,
  },
  statusText: {
    fontSize: 18,
    color: darkTheme.colors.textSecondary,
    marginTop: darkTheme.spacing.l,
    textAlign: 'center',
  },
  statusSubtext: {
    fontSize: 14,
    color: darkTheme.colors.textTertiary,
    marginTop: darkTheme.spacing.s,
    textAlign: 'center',
  },
});
