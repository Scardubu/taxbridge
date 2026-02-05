import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { guideStyles } from './guideStyles';

export const TINGuide: React.FC = () => {
  const { t } = useTranslation();

  return (
    <View style={guideStyles.container}>
      <Text style={guideStyles.title}>{t('tax.guide.tin.title')}</Text>
      <Text style={guideStyles.body}>{t('tax.guide.tin.explainer')}</Text>

      <Text style={guideStyles.sectionTitle}>{t('tax.guide.tin.whyTitle')}</Text>
      <View style={guideStyles.bulletRow}>
        <View style={guideStyles.bulletDot} />
        <Text style={guideStyles.bulletText}>{t('tax.guide.tin.why1')}</Text>
      </View>
      <View style={guideStyles.bulletRow}>
        <View style={guideStyles.bulletDot} />
        <Text style={guideStyles.bulletText}>{t('tax.guide.tin.why2')}</Text>
      </View>
      <View style={guideStyles.bulletRow}>
        <View style={guideStyles.bulletDot} />
        <Text style={guideStyles.bulletText}>{t('tax.guide.tin.why3')}</Text>
      </View>

      <View style={guideStyles.callout}>
        <Text style={guideStyles.calloutText}>{t('tax.guide.tin.howTo')}</Text>
      </View>
    </View>
  );
};
