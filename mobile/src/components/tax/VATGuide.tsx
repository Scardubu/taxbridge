import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { guideStyles } from './guideStyles';

export const VATGuide: React.FC = () => {
  const { t } = useTranslation();

  return (
    <View style={guideStyles.container}>
      <Text style={guideStyles.title}>{t('tax.guide.vat.title')}</Text>
      <Text style={guideStyles.body}>{t('tax.guide.vat.explainer')}</Text>

      <Text style={guideStyles.sectionTitle}>{t('tax.guide.vat.whenAppliesTitle')}</Text>
      <View style={guideStyles.bulletRow}>
        <View style={guideStyles.bulletDot} />
        <Text style={guideStyles.bulletText}>{t('tax.guide.vat.applies1')}</Text>
      </View>
      <View style={guideStyles.bulletRow}>
        <View style={guideStyles.bulletDot} />
        <Text style={guideStyles.bulletText}>{t('tax.guide.vat.applies2')}</Text>
      </View>
      <View style={guideStyles.bulletRow}>
        <View style={guideStyles.bulletDot} />
        <Text style={guideStyles.bulletText}>{t('tax.guide.vat.applies3')}</Text>
      </View>

      <Text style={guideStyles.sectionTitle}>{t('tax.guide.vat.exemptionsTitle')}</Text>
      <View style={guideStyles.bulletRow}>
        <View style={guideStyles.bulletDot} />
        <Text style={guideStyles.bulletText}>{t('tax.guide.vat.exempt1')}</Text>
      </View>
      <View style={guideStyles.bulletRow}>
        <View style={guideStyles.bulletDot} />
        <Text style={guideStyles.bulletText}>{t('tax.guide.vat.exempt2')}</Text>
      </View>
      <View style={guideStyles.bulletRow}>
        <View style={guideStyles.bulletDot} />
        <Text style={guideStyles.bulletText}>{t('tax.guide.vat.exempt3')}</Text>
      </View>

      <View style={guideStyles.callout}>
        <Text style={guideStyles.calloutText}>{t('tax.guide.vat.NRSLink')}</Text>
      </View>
    </View>
  );
};
