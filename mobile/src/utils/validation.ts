import React, { useState } from 'react';
import { Alert } from 'react-native';

interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: string) => string | null;
}

interface ValidationRules {
  [key: string]: ValidationRule;
}

interface ValidationErrors {
  [key: string]: string | null;
}

export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  validationRules: ValidationRules
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = (name: string, value: string): string | null => {
    const rules = validationRules[name];
    if (!rules) return null;

    if (rules.required && (!value || value.trim() === '')) {
      return 'This field is required';
    }

    if (rules.minLength && value.length < rules.minLength) {
      return `Minimum ${rules.minLength} characters required`;
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      return `Maximum ${rules.maxLength} characters allowed`;
    }

    if (rules.pattern && !rules.pattern.test(value)) {
      return 'Invalid format';
    }

    if (rules.custom) {
      return rules.custom(value);
    }

    return null;
  };

  const setValue = (name: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
    
    if (touched[name as string]) {
      const error = validateField(name as string, String(value));
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  };

  const setTouchedField = (name: keyof T) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name as string, String(values[name]));
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const validateAll = (): boolean => {
    const newErrors: ValidationErrors = {};
    let isValid = true;

    Object.keys(validationRules).forEach(key => {
      const error = validateField(key, String(values[key]));
      newErrors[key] = error;
      if (error) isValid = false;
    });

    setErrors(newErrors);
    setTouched(Object.keys(validationRules).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
    return isValid;
  };

  const resetForm = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  };

  return {
    values,
    errors,
    touched,
    setValue,
    setTouchedField,
    validateAll,
    resetForm,
  };
}

export const validationRules = {
  customerName: {
    required: false,
    maxLength: 100,
    custom: (value: string) => {
      if (value && !/^[a-zA-Z\s]+$/.test(value.trim())) {
        return 'Name should only contain letters and spaces';
      }
      return null;
    },
  },
  description: {
    required: true,
    minLength: 2,
    maxLength: 200,
  },
  quantity: {
    required: true,
    custom: (value: string) => {
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) {
        return 'Quantity must be greater than 0';
      }
      if (num > 9999) {
        return 'Quantity cannot exceed 9999';
      }
      return null;
    },
  },
  unitPrice: {
    required: true,
    custom: (value: string) => {
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) {
        return 'Price must be greater than 0';
      }
      if (num > 999999) {
        return 'Price cannot exceed 999,999';
      }
      return null;
    },
  },
  apiUrl: {
    required: true,
    custom: (value: string) => {
      try {
        new URL(value);
        return null;
      } catch {
        return 'Please enter a valid URL (e.g., http://10.0.2.2:3000)';
      }
    },
  },
};

export function showValidationError(title: string, message: string) {
  Alert.alert(title, message, [{ text: 'OK', style: 'default' }]);
}
