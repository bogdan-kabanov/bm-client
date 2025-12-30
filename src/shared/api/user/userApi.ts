import type { User } from '@src/entities/user/model/types';
import { apiClient } from '../client';

export const userApi = {
  getProfile: () => apiClient<any>('/users/me'),
  updateProfile: (data: any) => 
    apiClient<any>('/users/profile', {
      method: 'PUT',
      body: data,
    }),
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return apiClient<User>('/users/profile/avatar', {
      method: 'POST',
      body: formData,
    });
  },
  submitKYC: (kycData: FormData | {
    full_name: string;
    birth_date: string;
    street_address: string;
    city: string;
    postal_code: string;
    country: string;
    id_document_type: 'passport' | 'drivers_license' | 'national_id';
    id_document_number: string;
  }) =>
    apiClient<{ success: boolean; message: string }>('/users/kyc/submit', {
      method: 'POST',
      body: kycData,
    }),
  updateIslamicHalal: (isIslamicHalal: boolean) =>
    apiClient<any>('/users/profile', {
      method: 'PUT',
      body: { is_islamic_halal: isIslamicHalal },
    }),
  deleteAccount: (confirmText: string) =>
    apiClient<{ success: boolean; message: string }>('/users/account/delete', {
      method: 'DELETE',
      body: { confirm: confirmText },
    }),
};
