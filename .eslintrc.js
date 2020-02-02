module.exports = {
  root: true,
  env: {
    node: true
  },
  // 'extends': [
  //   '@vue/airbnb',
  //   'plugin:vue/essential'
  // ],
  rules: {
    'arrow-parens': ['error', 'as-needed'],
    'space-before-function-paren': ['error', 'always'],
    'comma-dangle': [
      'error',
      'never'
    ],
    'linebreak-style': ['error', 'windows'],
    quotes: ['error', 'double'],
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off'
  },
  parserOptions: {
    parser: 'babel-eslint'
  },
  overrides: [
    {
      files: [
        '**/__tests__/*.{j,t}s?(x)'
      ],
      env: {
        jest: true
      }
    },
    {
      files: [
        '**/__tests__/*.{j,t}s?(x)'
      ],
      env: {
        jest: true
      }
    }
  ]
}
