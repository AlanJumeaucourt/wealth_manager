export interface GoCardlessInstitution {
  id: string;
  name: string;
  logo: string;
  countries: string[];
}

export interface GoCardlessRequisition {
  id: string;
  created: string;
  status: 'CR' | 'LN' | 'EX' | 'RJ' | 'SA' | 'GA' | 'UA' | 'FA';
  institution_id: string;
  link: string;
  reference: string;
}

export interface GoCardlessAccount {
  id: string;
  created: string;
  last_accessed: string;
  iban: string;
  institution_id: string;
  status: string;
  owner_name: string;
  currency: string;
  balance: number;
  account_type: string;
}

export interface GoCardlessError {
  type: string;
  message: string;
  code: string;
}
