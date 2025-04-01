import { createEndUserAgreement, createRequisition, fetchInstitutions } from '@/api/gocardlessApi';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GoCardlessEndUserAgreement, GoCardlessInstitution } from '@/types/gocardless';
import { useRouter } from '@tanstack/react-router';
import { AlertCircle, ExternalLink, Loader2, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ConnectBank() {
  const router = useRouter();
  const [institutions, setInstitutions] = useState<GoCardlessInstitution[]>([]);
  const [filteredInstitutions, setFilteredInstitutions] = useState<GoCardlessInstitution[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInstitution, setSelectedInstitution] = useState<GoCardlessInstitution | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [connectProgress, setConnectProgress] = useState('');

  // List of European countries to choose from
  const countries = [
    { code: 'AT', name: 'Austria' },
    { code: 'BE', name: 'Belgium' },
    { code: 'BG', name: 'Bulgaria' },
    { code: 'HR', name: 'Croatia' },
    { code: 'CY', name: 'Cyprus' },
    { code: 'CZ', name: 'Czech Republic' },
    { code: 'DK', name: 'Denmark' },
    { code: 'EE', name: 'Estonia' },
    { code: 'FI', name: 'Finland' },
    { code: 'FR', name: 'France' },
    { code: 'DE', name: 'Germany' },
    { code: 'GR', name: 'Greece' },
    { code: 'HU', name: 'Hungary' },
    { code: 'IS', name: 'Iceland' },
    { code: 'IE', name: 'Ireland' },
    { code: 'IT', name: 'Italy' },
    { code: 'LV', name: 'Latvia' },
    { code: 'LI', name: 'Liechtenstein' },
    { code: 'LT', name: 'Lithuania' },
    { code: 'LU', name: 'Luxembourg' },
    { code: 'MT', name: 'Malta' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'NO', name: 'Norway' },
    { code: 'PL', name: 'Poland' },
    { code: 'PT', name: 'Portugal' },
    { code: 'RO', name: 'Romania' },
    { code: 'SK', name: 'Slovakia' },
    { code: 'SI', name: 'Slovenia' },
    { code: 'ES', name: 'Spain' },
    { code: 'SE', name: 'Sweden' },
    { code: 'GB', name: 'United Kingdom' },
  ];

  useEffect(() => {
    if (selectedCountry) {
      loadInstitutions(selectedCountry);
    } else {
      setInstitutions([]);
      setFilteredInstitutions([]);
    }
  }, [selectedCountry]);

  useEffect(() => {
    if (institutions.length > 0) {
      const filtered = institutions.filter(institution =>
        institution.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredInstitutions(filtered);
    }
  }, [searchQuery, institutions]);

  const loadInstitutions = async (countryCode: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchInstitutions(countryCode);
      console.log('Institutions loaded:', data);
      setInstitutions(data);
      setFilteredInstitutions(data);
    } catch (err: any) {
      console.error('Error loading institutions:', err);
      setError(err.message || 'Failed to load banks. Please try again.');
      setInstitutions([]);
      setFilteredInstitutions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInstitutionSelect = (institution: GoCardlessInstitution) => {
    setSelectedInstitution(institution);
  };

  const handleConnect = async () => {
    if (!selectedInstitution) return;

    try {
      setConnecting(true);
      setConnectProgress('Creating end user agreement...');

      // 1. Create end user agreement (optional step in the API flow)
      let agreementId: string | undefined = undefined;

      try {
        const agreement: GoCardlessEndUserAgreement = await createEndUserAgreement(
          selectedInstitution.id,
          parseInt(selectedInstitution.transaction_total_days || '90'), // Use institution's max transaction days if available
          parseInt(selectedInstitution.max_access_valid_for_days || '90'), // Use institution's max access days if available
          ['balances', 'details', 'transactions'] // accessScope
        );

        console.log('End user agreement created:', agreement);
        agreementId = agreement.id;
      } catch (err) {
        console.warn('Could not create end user agreement, continuing with default values:', err);
      }

      setConnectProgress('Initiating bank connection...');

      // 2. Create requisition
      const requisition = await createRequisition(
        selectedInstitution.id,
        `${window.location.origin}/gocardless/callback`, // Redirect URL
        agreementId, // EUA agreement ID (optional)
        `wealth-${Date.now()}`, // Reference (unique ID)
        'EN', // User language
        true // Account selection enabled
      );

      console.log('Requisition created:', requisition);
      setConnectProgress('Redirecting to bank authentication...');

      // 3. Redirect to the bank's authorization page
      window.location.href = requisition.link;
    } catch (err: any) {
      console.error('Error connecting to bank:', err);
      setError(err.message || 'Failed to connect to bank. Please try again.');
      setConnecting(false);
    }
  };

  const handleCountryChange = (value: string) => {
    setSelectedCountry(value);
    setSelectedInstitution(null);
  };

  if (connecting) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Connecting to Bank</h1>
        <p className="text-lg text-muted-foreground mb-6">{connectProgress}</p>
        <p className="text-muted-foreground text-center max-w-md">
          Please wait while we prepare your bank connection...
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Connect Your Bank</h1>
        <p className="text-muted-foreground mb-8">
          Select your bank to securely connect your accounts with GoCardless.
        </p>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Select Country <span className="text-red-500">*</span></label>
          <div className="flex items-start gap-4">
            <Select
              value={selectedCountry}
              onValueChange={handleCountryChange}
            >
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="Select a country" />
              </SelectTrigger>
              <SelectContent>
                {countries.map(country => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!selectedCountry && (
              <div className="flex items-center text-amber-500 text-sm">
                <AlertCircle className="h-4 w-4 mr-2" />
                Country selection is required
              </div>
            )}
          </div>
        </div>

        {selectedCountry && (
          <>
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="Search for your bank..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {selectedInstitution ? (
              <Card className="mb-6 border-2 border-primary">
                <CardHeader>
                  <div className="flex items-center">
                    {selectedInstitution.logo && (
                      <img
                        src={selectedInstitution.logo}
                        alt={selectedInstitution.name}
                        className="h-10 w-10 mr-3 object-contain"
                      />
                    )}
                    <div>
                      <CardTitle>{selectedInstitution.name}</CardTitle>
                      <CardDescription>
                        Available in: {selectedInstitution.countries.join(', ')}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-4">
                    <p>
                      By connecting your account, you'll be able to securely access your bank data
                      including your transactions, balances and account details.
                    </p>
                    <p className="mt-2">
                      Your credentials are never stored and the connection is secured through open banking.
                    </p>
                    {selectedInstitution.transaction_total_days && (
                      <p className="mt-2">
                        Available transaction history: up to {selectedInstitution.transaction_total_days} days
                      </p>
                    )}
                    {selectedInstitution.max_access_valid_for_days && (
                      <p className="mt-2">
                        Connection valid for: up to {selectedInstitution.max_access_valid_for_days} days
                      </p>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" onClick={() => setSelectedInstitution(null)}>
                    Cancel
                  </Button>
                  <Button onClick={handleConnect} disabled={connecting}>
                    {connecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      'Connect'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            ) : loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div>
                {filteredInstitutions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredInstitutions.map((institution) => (
                      <Card
                        key={institution.id}
                        className="cursor-pointer hover:border-primary transition-colors"
                        onClick={() => handleInstitutionSelect(institution)}
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">{institution.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {institution.logo && (
                            <div className="flex justify-center mb-4">
                              <img
                                src={institution.logo}
                                alt={institution.name}
                                className="h-12 w-12 object-contain"
                              />
                            </div>
                          )}
                          {institution.bic && (
                            <CardDescription className="mb-1">
                              BIC: {institution.bic}
                            </CardDescription>
                          )}
                          {institution.countries && (
                            <CardDescription>
                              Available in: {institution.countries.join(', ')}
                            </CardDescription>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-xl text-muted-foreground mb-4">
                      {searchQuery ? `No banks found matching "${searchQuery}"` : 'No banks found for this country'}
                    </p>
                    {searchQuery && (
                      <Button variant="outline" onClick={() => setSearchQuery('')}>
                        Clear Search
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className="mt-8 flex justify-center">
          <a
            href="https://bankaccountdata.gocardless.com/api/docs/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors"
          >
            <ExternalLink size={14} />
            GoCardless Bank Account Data API Documentation
          </a>
        </div>
      </div>
    </div>
  );
}
