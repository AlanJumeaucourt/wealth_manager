import axios, { AxiosError } from 'axios';

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const handleApiError = (error: unknown): never => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ error: string }>;
    const errorMessage = axiosError.response?.data?.error || axiosError.message;
    const status = axiosError.response?.status;

    throw new ApiError(errorMessage, status);
  }

  if (error instanceof Error) {
    throw new ApiError(error.message);
  }

  throw new ApiError('An unexpected error occurred');
};
