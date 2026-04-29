export default {
  displayName: 'shared-audit',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: { '^.+\.[tj]s$': ['@swc/jest', { jsc: { target: 'es2021' } }] },
  coverageDirectory: '../../coverage/libs/shared-audit',
};
