import fs from 'fs';

export const validateUblXml = (xml, xsdPath) => {
  try {
    const libxmljs = require('libxmljs');

    const xsdString = fs.readFileSync(xsdPath, 'utf8');
    const xsdDoc = libxmljs.parseXml(xsdString);
    const xmlDoc = libxmljs.parseXml(xml);

    const valid = xmlDoc.validate(xsdDoc);
    if (!valid) {
      return { ok: false, error: 'UBL XSD validation failed', details: xmlDoc.validationErrors };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UBL XSD validation failed' };
  }
}
