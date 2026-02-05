import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { guideStyles } from './guideStyles';

export const PITGuide: React.FC = () => {
  const { t } = useTranslation();

  return (
    <View style={guideStyles.container}>
      <Text style={guideStyles.title}>{t('tax.guide.pit.title')}</Text>
      <Text style={guideStyles.body}>{t('tax.guide.pit.explainer')}</Text>

      <Text style={guideStyles.sectionTitle}>{t('tax.guide.pit.bandsTitle')}</Text>
      <View style={guideStyles.bulletRow}>
        <View style={guideStyles.bulletDot} />
        <Text style={guideStyles.bulletText}>{t('tax.guide.pit.band1')}</Text>
      </View>
      <View style={guideStyles.bulletRow}>
        <View style={guideStyles.bulletDot} />
        <Text style={guideStyles.bulletText}>{t('tax.guide.pit.band2')}</Text>
      </View>
      <View style={guideStyles.bulletRow}>
        <View style={guideStyles.bulletDot} />
        <Text style={guideStyles.bulletText}>{t('tax.guide.pit.band3')}</Text>
      </View>

      <View style={guideStyles.callout}>
        <Text style={guideStyles.calloutText}>{t('tax.guide.pit.tip')}</Text>
      </View>
    </View>
  );
};
