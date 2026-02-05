import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { guideStyles } from './guideStyles';

export const WHTGuide: React.FC = () => {
  const { t } = useTranslation();

  return (
    <View style={guideStyles.container}>
      <Text style={guideStyles.title}>{t('tax.guide.wht.title')}</Text>
      <Text style={guideStyles.body}>{t('tax.guide.wht.explainer')}</Text>

      <Text style={guideStyles.sectionTitle}>{t('tax.guide.wht.whenAppliesTitle')}</Text>
      <View style={guideStyles.bulletRow}>
        <View style={guideStyles.bulletDot} />
        <Text style={guideStyles.bulletText}>{t('tax.guide.wht.applies1')}</Text>
      </View>
      <View style={guideStyles.bulletRow}>
        <View style={guideStyles.bulletDot} />
        <Text style={guideStyles.bulletText}>{t('tax.guide.wht.applies2')}</Text>
      </View>
      <View style={guideStyles.bulletRow}>
        <View style={guideStyles.bulletDot} />
        <Text style={guideStyles.bulletText}>{t('tax.guide.wht.applies3')}</Text>
      </View>

      <View style={guideStyles.callout}>
        <Text style={guideStyles.calloutText}>{t('tax.guide.wht.remember')}</Text>
      </View>
    </View>
  );
};
