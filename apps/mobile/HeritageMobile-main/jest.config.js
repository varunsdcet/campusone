module.exports = {
  preset: '@react-native/jest-preset',
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.test.tsx'],
  setupFiles: ['<rootDir>/tests/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-community|@react-navigation|react-native-screens|react-native-safe-area-context|react-native-svg|lucide-react-native|@react-native-async-storage|@react-native-documents|@dr.pogodin)/)',
  ],
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$': '<rootDir>/tests/__mocks__/asyncStorage.ts',
    '^@react-native-documents/picker$': '<rootDir>/tests/__mocks__/documentsPicker.ts',
    '^@react-native-documents/viewer$': '<rootDir>/tests/__mocks__/documentsViewer.ts',
    '^@dr.pogodin/react-native-fs$': '<rootDir>/tests/__mocks__/fs.ts',
    '^@react-native-community/datetimepicker$': '<rootDir>/tests/__mocks__/datetimepicker.tsx',
    '^lucide-react-native$': '<rootDir>/tests/__mocks__/lucide.tsx',
    '^react-native-svg$': '<rootDir>/tests/__mocks__/svg.tsx',
  },
};
