module.exports = {
  readAsStringAsync: async (uri, options) => {
    // Return empty base64 string for tests; specific tests can override by mocking this module
    return '';
  },
  writeAsStringAsync: async () => undefined,
  documentDirectory: '/mock-docs/',
};
