import React, { useState } from 'react';
import i18n from '../i18n';
import { showToast } from '../components/ui/Toast';

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

    const trimmed = value?.trim?.() ?? '';

    if (!rules.required && trimmed === '') {
      return null;
    }

    if (rules.required && trimmed === '') {
      return i18n.t('validation.required');
    }

    if (rules.minLength && trimmed.length < rules.minLength) {
      return i18n.t('validation.minLength', { count: rules.minLength });
    }

    if (rules.maxLength && trimmed.length > rules.maxLength) {
      return i18n.t('validation.maxLength', { count: rules.maxLength });
    }

    if (rules.pattern && !rules.pattern.test(trimmed)) {
      return i18n.t('validation.invalidFormat');
    }

    if (rules.custom) {
      return rules.custom(trimmed);
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

  const validateFields = (fieldNames: string[]): boolean => {
    const newErrors: ValidationErrors = { ...errors };
    let isValid = true;

    fieldNames.forEach(key => {
      const error = validateField(key, String(values[key]));
      newErrors[key] = error;
      if (error) isValid = false;
    });

    setErrors(newErrors);
    setTouched(prev => ({
      ...prev,
      ...fieldNames.reduce((acc, key) => ({ ...acc, [key]: true }), {}),
    }));
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
    validateFields,
    resetForm,
  };
}

export const validationRules = {
  customerName: {
    required: false,
    maxLength: 100,
    custom: (value: string) => {
      if (value && !/^[a-zA-Z\s]+$/.test(value.trim())) {
        return i18n.t('validation.nameLettersOnly');
      }
      return null;
    },
  },
  customerTIN: {
    required: false,
    minLength: 10,
    maxLength: 20,
    custom: (value: string) => {
      if (value && value.trim() && !/^[A-Z0-9-]+$/.test(value.trim())) {
        return i18n.t('validation.tinFormat');
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
        return i18n.t('validation.quantityMin');
      }
      if (num > 9999) {
        return i18n.t('validation.quantityMax', { max: 9999 });
      }
      return null;
    },
  },
  unitPrice: {
    required: true,
    custom: (value: string) => {
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) {
        return i18n.t('validation.priceMin');
      }
      if (num > 999999) {
        return i18n.t('validation.priceMax', { max: 999999 });
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
        return i18n.t('validation.invalidUrl', { example: 'http://10.0.2.2:3000' });
      }
    },
  },
};

export function showValidationError(title: string, message: string) {
  const combinedMessage = title ? `${title}: ${message}` : message;
  showToast({
    type: 'error',
    message: combinedMessage,
    haptic: 'error',
  });
}
