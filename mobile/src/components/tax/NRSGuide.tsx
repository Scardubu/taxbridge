import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { guideStyles } from './guideStyles';

export const NRSGuide: React.FC = () => {
  const { t } = useTranslation();

  return (
    <View style={guideStyles.container}>
      <Text style={guideStyles.title}>{t('tax.guide.nrs.title')}</Text>
      <Text style={guideStyles.body}>{t('tax.guide.nrs.explainer')}</Text>

      <Text style={guideStyles.sectionTitle}>{t('tax.guide.nrs.howItWorksTitle')}</Text>
      <View style={guideStyles.bulletRow}>
        <View style={guideStyles.bulletDot} />
        <Text style={guideStyles.bulletText}>{t('tax.guide.nrs.step1')}</Text>
      </View>
      <View style={guideStyles.bulletRow}>
        <View style={guideStyles.bulletDot} />
        <Text style={guideStyles.bulletText}>{t('tax.guide.nrs.step2')}</Text>
      </View>
      <View style={guideStyles.bulletRow}>
        <View style={guideStyles.bulletDot} />
        <Text style={guideStyles.bulletText}>{t('tax.guide.nrs.step3')}</Text>
      </View>

      <View style={guideStyles.callout}>
        <Text style={guideStyles.calloutText}>{t('tax.guide.nrs.note')}</Text>
      </View>
    </View>
  );
};
