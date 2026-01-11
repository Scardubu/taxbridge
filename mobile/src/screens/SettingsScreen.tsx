import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import i18n, { type SupportedLanguage } from '../i18n';
import { getSetting, setSetting } from '../services/database';
import { getApiBaseUrl, setApiBaseUrl } from '../services/api';
import { useFormValidation, validationRules, showValidationError } from '../utils/validation';
import AnimatedButton from '../components/AnimatedButton';

const LANGUAGE_KEY = 'language';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const [lang, setLang] = useState<SupportedLanguage>('en');

  const { values, errors, touched, setValue, setTouchedField, validateAll } = useFormValidation(
    { apiUrl: '' },
    { apiUrl: validationRules.apiUrl }
  );

  useEffect(() => {
    void getSetting(LANGUAGE_KEY)
      .then((v) => {
        if (v === 'pidgin' || v === 'en') {
          setLang(v);
          void i18n.changeLanguage(v);
        }
      })
      .catch(() => undefined);

    void getApiBaseUrl().then(url => {
      setValue('apiUrl', url);
    }).catch(() => undefined);
  }, [setValue]);

  const choose = async (next: SupportedLanguage) => {
    setLang(next);
    await setSetting(LANGUAGE_KEY, next);
    await i18n.changeLanguage(next);
  };

  const saveApiUrl = async () => {
    if (!validateAll()) {
      showValidationError('Validation Error', 'Please enter a valid API URL');
      return;
    }

    try {
      await setApiBaseUrl(values.apiUrl);
      Alert.alert('Success', 'API URL updated successfully');
    } catch (error) {
      showValidationError('Error', 'Failed to save API URL');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.h1}>{t('settings.title')}</Text>

        <Text style={styles.label}>{t('settings.language')}</Text>

        <View style={styles.row}>
          <Pressable style={[styles.option, lang === 'en' && styles.optionActive]} onPress={() => void choose('en')}>
            <Text style={[styles.optionText, lang === 'en' && styles.optionTextActive]}>{t('settings.english')}</Text>
          </Pressable>
          <Pressable
            style={[styles.option, lang === 'pidgin' && styles.optionActive]}
            onPress={() => void choose('pidgin')}
          >
            <Text style={[styles.optionText, lang === 'pidgin' && styles.optionTextActive]}>{t('settings.pidgin')}</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{t('settings.apiUrl')}</Text>
          <TextInput
            style={[styles.input, errors.apiUrl && touched.apiUrl && styles.inputError]}
            value={values.apiUrl}
            onChangeText={(text) => setValue('apiUrl', text)}
            onBlur={() => setTouchedField('apiUrl')}
            placeholder="http://10.0.2.2:3000"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {errors.apiUrl && touched.apiUrl && (
            <Text style={styles.errorText}>{errors.apiUrl}</Text>
          )}
          <AnimatedButton
            title={t('settings.save')}
            onPress={saveApiUrl}
            style={styles.saveButton}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F4F7' },
  container: { flex: 1, padding: 16 },
  h1: { fontSize: 24, fontWeight: '800', color: '#101828', marginBottom: 16 },
  label: { color: '#344054', marginBottom: 10, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 12 },
  section: { marginTop: 24 },
  option: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    alignItems: 'center'
  },
  optionActive: {
    borderColor: '#0B5FFF',
    backgroundColor: '#EEF4FF'
  },
  optionText: { color: '#344054', fontWeight: '800' },
  optionTextActive: { color: '#0B5FFF' },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12
  },
  inputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '500',
  },
  saveButton: {
    marginTop: 8,
  },
});
