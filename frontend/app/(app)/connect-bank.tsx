import { fetchInstitutions } from '@/app/api/gocardlessApi';
import { darkTheme } from '@/constants/theme';
import { sharedStyles } from '@/styles/sharedStyles';
import { GoCardlessInstitution } from '@/types/gocardless';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Searchbar } from 'react-native-paper';

export default function ConnectBankScreen() {
  const [institutions, setInstitutions] = useState<GoCardlessInstitution[]>([]);
  const [filteredInstitutions, setFilteredInstitutions] = useState<GoCardlessInstitution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadInstitutions();
  }, []);

  useEffect(() => {
    if (institutions.length > 0) {
      const filtered = institutions.filter(institution =>
        institution.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredInstitutions(filtered);
    }
  }, [searchQuery, institutions]);

  const loadInstitutions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchInstitutions();
      setInstitutions(response);
      setFilteredInstitutions(response);
    } catch (err) {
      setError('Failed to load banks. Please try again.');
      console.error('Error loading institutions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInstitutionPress = (institution: GoCardlessInstitution) => {
    router.push({
      pathname: '/connect-bank/[id]',
      params: { id: institution.id }
    });
  };

  const renderInstitutionItem = ({ item }: { item: GoCardlessInstitution }) => (
    <Pressable
      style={styles.institutionItem}
      onPress={() => handleInstitutionPress(item)}
    >
      <View style={styles.institutionIconContainer}>
        {item.logo ? (
          <Image
            source={{ uri: item.logo }}
            style={styles.institutionIcon}
            resizeMode="contain"
          />
        ) : (
          <Ionicons name="business-outline" size={24} color={darkTheme.colors.primary} />
        )}
      </View>
      <View style={styles.institutionContent}>
        <Text style={styles.institutionName}>{item.name}</Text>
        <Text style={styles.institutionCountries}>
          {item.countries.join(', ')}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={24}
        color={darkTheme.colors.textSecondary}
      />
    </Pressable>
  );

  return (
    <View style={[sharedStyles.container]}>
      <View style={sharedStyles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={darkTheme.colors.text} />
        </Pressable>
        <Text style={sharedStyles.headerTitle}>Connect Bank</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={sharedStyles.body}>
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="Search banks..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
            iconColor={darkTheme.colors.textSecondary}
            placeholderTextColor={darkTheme.colors.textSecondary}
          />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={darkTheme.colors.primary} />
            <Text style={styles.loadingText}>Loading banks...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color={darkTheme.colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={loadInstitutions}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : filteredInstitutions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search" size={48} color={darkTheme.colors.textSecondary} />
            <Text style={styles.emptyText}>No banks found</Text>
          </View>
        ) : (
          <FlatList
            data={filteredInstitutions}
            renderItem={renderInstitutionItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    padding: darkTheme.spacing.s,
  },
  searchContainer: {
    paddingHorizontal: darkTheme.spacing.m,
    paddingVertical: darkTheme.spacing.m,
  },
  searchBar: {
    backgroundColor: darkTheme.colors.surface,
    elevation: 0,
    borderRadius: darkTheme.borderRadius.m,
    height: 48,
  },
  searchInput: {
    color: darkTheme.colors.text,
    fontSize: 16,
  },
  listContainer: {
    padding: darkTheme.spacing.m,
  },
  institutionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: darkTheme.spacing.m,
    backgroundColor: darkTheme.colors.surface,
    borderRadius: darkTheme.borderRadius.m,
    marginBottom: darkTheme.spacing.m,
    ...darkTheme.shadows.small,
  },
  institutionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${darkTheme.colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: darkTheme.spacing.m,
  },
  institutionIcon: {
    width: 32,
    height: 32,
  },
  institutionContent: {
    flex: 1,
  },
  institutionName: {
    fontSize: 16,
    fontWeight: '600',
    color: darkTheme.colors.text,
    marginBottom: darkTheme.spacing.xs,
  },
  institutionCountries: {
    fontSize: 12,
    color: darkTheme.colors.textSecondary,
    textTransform: 'uppercase',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: darkTheme.spacing.m,
    fontSize: 16,
    color: darkTheme.colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: darkTheme.spacing.xl,
  },
  errorText: {
    marginTop: darkTheme.spacing.m,
    fontSize: 16,
    color: darkTheme.colors.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: darkTheme.spacing.l,
    paddingVertical: darkTheme.spacing.m,
    paddingHorizontal: darkTheme.spacing.xl,
    backgroundColor: darkTheme.colors.primary,
    borderRadius: darkTheme.borderRadius.m,
  },
  retryButtonText: {
    color: darkTheme.colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: darkTheme.spacing.xl,
  },
  emptyText: {
    marginTop: darkTheme.spacing.m,
    fontSize: 16,
    color: darkTheme.colors.textSecondary,
    textAlign: 'center',
  },
});
