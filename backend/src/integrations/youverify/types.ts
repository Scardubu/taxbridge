/**
 * Youverify API Types
 * @see https://docs.youverify.co
 */

export interface YouverifyConfig {
  apiKey: string;
  baseUrl: string;
  sandbox: boolean;
}

// --- TIN Verification ---

export interface YouverifyTINRequest {
  id: string;
  metadata?: Record<string, any>;
}

export interface YouverifyTINResponse {
  id: string;
  statusCode: number;
  status: string; // "found" | "not_found"
  data: {
    id: string;
    fullName: string;
    tin: string;
    status: 'verified' | 'unverified';
    issuedDate?: string;
    confidence?: number;
  } | null;
}

// --- BVN Verification ---

export interface YouverifyBVNRequest {
  id: string;
  firstName: string;
  lastName: string;
  metadata?: Record<string, any>;
}

export interface YouverifyBVNResponse {
  id: string;
  statusCode: number;
  status: string;
  data: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    phoneNumber?: string;
    status: 'verified' | 'unverified';
    confidence?: number;
  } | null;
}

// --- CAC Verification ---

export interface YouverifyCACRequest {
  id: string;
  metadata?: Record<string, any>;
}

export interface YouverifyCACResponse {
  id: string;
  statusCode: number;
  status: string;
  data: {
    id: string;
    companyName: string;
    rcNumber: string;
    registrationDate?: string;
    status: 'verified' | 'unverified';
    address?: string;
    directors?: Array<{ name: string; designation: string }>;
    confidence?: number;
  } | null;
}

// --- Common result types ---

export interface VerificationResult {
  verified: boolean;
  confidence: number; // 0-100
  details: {
    name: string;
    issuedDate?: string;
    status: 'active' | 'inactive' | 'suspended';
    extra?: Record<string, any>;
  };
  reference: string;
}

export interface BusinessVerificationRequest {
  tinVerification?: boolean;
  bvnVerification?: boolean;
  cacVerification?: boolean;
  tin?: string;
  bvn?: string;
  cacNumber?: string;
  firstName?: string;
  lastName?: string;
}

export interface BusinessVerificationResult {
  verifications: {
    tin?: VerificationResult;
    bvn?: VerificationResult;
    cac?: VerificationResult;
  };
  overallStatus: 'VERIFIED' | 'PARTIAL' | 'FAILED' | 'PENDING';
}
