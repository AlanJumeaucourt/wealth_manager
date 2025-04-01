import { GoCardlessAccount, GoCardlessInstitution, GoCardlessRequisition } from '@/types/gocardless';
import { handleApiError } from '@/utils/apiUtils';
  import apiClient from './axiosConfig';

export const fetchInstitutions = async (): Promise<GoCardlessInstitution[]> => {
  try {
    const response = await apiClient.get('/gocardless/institutions');
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const createRequisition = async (institutionId: string): Promise<GoCardlessRequisition> => {
  try {
    const response = await apiClient.post('/gocardless/requisitions', {
      institution_id: institutionId,
    });
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const getRequisitionStatus = async (requisitionId: string): Promise<GoCardlessRequisition> => {
  try {
    const response = await apiClient.get(`/gocardless/requisitions/${requisitionId}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const getAccounts = async (requisitionId: string): Promise<GoCardlessAccount[]> => {
  try {
    const response = await apiClient.get(`/gocardless/accounts/${requisitionId}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const linkAccountsToUser = async (requisitionId: string, accountIds: string[]): Promise<void> => {
  try {
    await apiClient.post('/gocardless/link-accounts', {
      requisition_id: requisitionId,
      account_ids: accountIds,
    });
  } catch (error) {
    throw handleApiError(error);
  }
};
