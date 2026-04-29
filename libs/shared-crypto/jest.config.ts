export default {
  displayName: 'shared-crypto',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: { '^.+\.[tj]s$': ['@swc/jest', { jsc: { target: 'es2021' } }] },
  coverageDirectory: '../../coverage/libs/shared-crypto',
};
