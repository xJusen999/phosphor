module.exports = {
  testEnvironment: 'node',
  testRegex: 'test/.*\.e2e-spec\.ts$',
  transform: { '^.+\.ts$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }] },
};
