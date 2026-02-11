/**
 * Business API Service
 *
 * Mobile client for business management and Youverify verification endpoints.
 */

import { api } from './api';

// =============================================================================
// Types
// =============================================================================

export type BusinessType = 'SOLE_PROPRIETOR' | 'PARTNERSHIP' | 'LIMITED_COMPANY' | 'NGO';
export type BusinessStatus = 'PENDING' | 'VERIFIED' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

export interface BusinessAddress {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface BusinessProfile {
  id: string;
  name: string;
  cacNumber?: string;
  tin?: string;
  email?: string;
  phone?: string;
  address: BusinessAddress;
  businessType: BusinessType;
  status: BusinessStatus;
  verification: {
    tinVerified: boolean;
    bvnVerified: boolean;
    cacVerified: boolean;
  };
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
  counts?: {
    employees: number;
    expenses: number;
    taxRemittances: number;
  };
}

export interface VerificationResult {
  verified: boolean;
  confidence: number;
  details: {
    name: string;
    issuedDate?: string;
    status: 'active' | 'inactive' | 'suspended';
    extra?: Record<string, any>;
  };
  reference: string;
}

export interface BusinessVerificationResponse {
  verifications: {
    tin?: VerificationResult;
    bvn?: VerificationResult;
    cac?: VerificationResult;
  };
  overallStatus: 'VERIFIED' | 'PARTIAL' | 'FAILED' | 'PENDING';
}

export interface VerificationStatus {
  businessId: string;
  status: BusinessStatus;
  verifications: {
    tin: { provided: boolean; verified: boolean };
    bvn: { provided: boolean; verified: boolean };
    cac: { provided: boolean; verified: boolean };
  };
  verifiedAt?: string;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Create a new business for the authenticated user
 */
export async function createBusiness(params: {
  name: string;
  cacNumber?: string;
  tin?: string;
  bvn?: string;
  email?: string;
  phone?: string;
  address?: BusinessAddress;
  businessType?: BusinessType;
}): Promise<BusinessProfile> {
  const res = await api.post('/business', params);
  return (res as any).data.business;
}

/**
 * Get the authenticated user's business profile
 */
export async function getBusinessProfile(): Promise<BusinessProfile> {
  const res = await api.get('/business/profile');
  return (res as any).data;
}

/**
 * Update the business profile
 */
export async function updateBusinessProfile(params: {
  name?: string;
  email?: string;
  phone?: string;
  address?: BusinessAddress;
  businessType?: BusinessType;
}): Promise<BusinessProfile> {
  const res = (await api.put('/business/profile', params)) as any;
  return res.data;
}

/**
 * Trigger business verification via Youverify
 */
export async function verifyBusiness(params: {
  tinVerification?: boolean;
  bvnVerification?: boolean;
  cacVerification?: boolean;
}): Promise<BusinessVerificationResponse> {
  const res = await api.post('/business/verify', params);
  return (res as any).data;
}

/**
 * Get current verification status
 */
export async function getVerificationStatus(): Promise<VerificationStatus> {
  const res = await api.get('/business/verification');
  return (res as any).data;
}
