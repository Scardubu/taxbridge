import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getDatabase } from '../services/database';
import { zustandKvStorage } from '../storage/kv';

export interface BusinessProfile {
  id?: number;
  businessName?: string;
  businessType?: string;
  tin?: string;
  cacNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxOffice?: string;
  registrationDate?: string;
  isVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface BusinessProfileState {
  // State
  profile: BusinessProfile | null;
  isLoading: boolean;
  isDirty: boolean;
  error: string | null;
  
  // Actions
  hydrate: () => Promise<void>;
  updateField: <K extends keyof BusinessProfile>(
    field: K,
    value: BusinessProfile[K]
  ) => Promise<void>;
  updateProfile: (updates: Partial<BusinessProfile>) => Promise<void>;
  syncToBackend: () => Promise<void>;
  reset: () => void;
  clearError: () => void;
}

// Debounce helper
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const useBusinessProfileStore = create<BusinessProfileState>()(
  persist(
    (set, get) => ({
      // Initial state
      profile: null,
      isLoading: false,
      isDirty: false,
      error: null,

      // Hydrate from SQLite
      hydrate: async () => {
        set({ isLoading: true, error: null });
        
        try {
          const db = await getDatabase();
          const result = await db.getFirstAsync<BusinessProfile>(
            'SELECT * FROM business_profiles ORDER BY id DESC LIMIT 1'
          );
          
          if (result) {
            set({ 
              profile: result,
              isDirty: false,
            });
          }
        } catch (error) {
          console.error('Failed to hydrate business profile:', error);
          set({ error: 'Failed to load business profile' });
        } finally {
          set({ isLoading: false });
        }
      },

      // Update a single field with debounce
      updateField: async (field, value) => {
        const state = get();
        const currentProfile: BusinessProfile = state.profile ?? {};
        
        // Update local state immediately
        const updatedProfile = { ...currentProfile, [field]: value };
        set({ 
          profile: updatedProfile,
          isDirty: true,
        });

        // Debounced SQLite update
        debouncedUpdateField(field, value);
      },

      // Update multiple fields
      updateProfile: async (updates) => {
        const state = get();
        const currentProfile: BusinessProfile = state.profile ?? {};
        
        const updatedProfile = { ...currentProfile, ...updates };
        set({ 
          profile: updatedProfile,
          isDirty: true,
        });

        // Update SQLite
        try {
          const db = await getDatabase();
          await db.withExclusiveTransactionAsync(async () => {
            // Check if profile exists
            const existing = await db.getFirstAsync<{ id: number }>(
              'SELECT id FROM business_profiles ORDER BY id DESC LIMIT 1'
            );

            if (existing) {
              // Update existing
              const fields = Object.keys(updates)
                .map(key => `${key} = ?`)
                .join(', ');
              const values = Object.values(updates);
              
              await db.runAsync(
                `UPDATE business_profiles SET ${fields}, updated_at = datetime('now') WHERE id = ?`,
                [...values, existing.id]
              );
            } else {
              // Insert new
              const fields = Object.keys(updates).join(', ');
              const placeholders = Object.keys(updates).map(() => '?').join(', ');
              const values = Object.values(updates);
              
              await db.runAsync(
                `INSERT INTO business_profiles (${fields}, created_at, updated_at) VALUES (${placeholders}, datetime('now'), datetime('now'))`,
                values
              );
            }
          });
        } catch (error) {
          console.error('Failed to update business profile:', error);
          set({ error: 'Failed to save business profile' });
        }
      },

      // Sync to backend
      syncToBackend: async () => {
        const state = get();
        if (!state.profile || !state.isDirty) return;

        set({ isLoading: true, error: null });

        try {
          // TODO: Implement backend sync
          // await apiClient.patch('/api/v1/business/profile', state.profile);
          
          console.log('Syncing business profile to backend...');
          
          // Mark as synced
          set({ isDirty: false });
        } catch (error) {
          console.error('Failed to sync to backend:', error);
          set({ error: 'Failed to sync to backend' });
        } finally {
          set({ isLoading: false });
        }
      },

      // Reset store
      reset: () => {
        set({
          profile: null,
          isLoading: false,
          isDirty: false,
          error: null,
        });
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'business-profile-store',
      storage: createJSONStorage(() => zustandKvStorage),
      // Only persist basic profile info, not loading states
      partialize: (state) => ({
        profile: state.profile,
        isDirty: state.isDirty,
      }),
      version: 1,
    }
  )
);

// Debounced field update function
const debouncedUpdateField = debounce(async <K extends keyof BusinessProfile>(
  field: K,
  value: BusinessProfile[K]
) => {
  try {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async () => {
      // Check if profile exists
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM business_profiles ORDER BY id DESC LIMIT 1'
      );

      if (existing) {
        // Update existing
        await db.runAsync(
          `UPDATE business_profiles SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`,
          [value ?? null, existing.id]
        );
      } else {
        // Insert new if this is the first field
        await db.runAsync(
          `INSERT INTO business_profiles (${field}, created_at, updated_at) VALUES (?, datetime('now'), datetime('now'))`,
          [value ?? null]
        );
      }
    });
  } catch (error) {
    console.error(`Failed to update field ${field}:`, error);
  }
}, 800);

// Selectors
export const useBusinessProfile = () => 
  useBusinessProfileStore((state) => state.profile);
export const useIsBusinessProfileLoading = () => 
  useBusinessProfileStore((state) => state.isLoading);
export const useIsBusinessProfileDirty = () => 
  useBusinessProfileStore((state) => state.isDirty);
export const useBusinessProfileError = () => 
  useBusinessProfileStore((state) => state.error);

// Computed selectors
export const useIsBusinessVerified = () => {
  const profile = useBusinessProfile();
  return profile?.isVerified ?? false;
};

export const useBusinessDisplayName = () => {
  const profile = useBusinessProfile();
  return profile?.businessName ?? 'Your Business';
};

export const useBusinessType = () => {
  const profile = useBusinessProfile();
  return profile?.businessType ?? '';
};

// Validation helpers
export const validateBusinessProfile = (profile: Partial<BusinessProfile>): {
  isValid: boolean;
  errors: Record<string, string>;
} => {
  const errors: Record<string, string> = {};

  if (!profile.businessName?.trim()) {
    errors.businessName = 'Business name is required';
  }

  if (!profile.businessType?.trim()) {
    errors.businessType = 'Business type is required';
  }

  if (profile.tin && !/^[A-Za-z0-9]{10,15}$/.test(profile.tin)) {
    errors.tin = 'Invalid TIN format';
  }

  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
    errors.email = 'Invalid email format';
  }

  if (profile.phone && !/^(\+234|0)[789][01]\d{8}$/.test(profile.phone)) {
    errors.phone = 'Invalid Nigerian phone number';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
