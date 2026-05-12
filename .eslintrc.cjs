module.exports = {
  root: true,
  ignorePatterns: ["node_modules/", "build/", "dist/", "coverage/"],
  extends: ["eslint:recommended", "prettier"],
  overrides: [
    {
      files: ["backend/**/*.js"],
      env: {
        node: true,
        es2022: true,
      },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "script",
      },
      rules: {
        "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      },
    },
    {
      files: ["frontend/**/*.js", "frontend/**/*.jsx"],
      env: {
        browser: true,
        es2022: true,
      },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      plugins: ["react", "react-hooks"],
      extends: [
        "eslint:recommended",
        "plugin:react/recommended",
        "plugin:react-hooks/recommended",
        "prettier",
      ],
      settings: {
        react: {
          version: "detect",
        },
      },
      rules: {
        "react/react-in-jsx-scope": "off",
        "react/prop-types": "off",
      },
    },
    {
      files: ["frontend/src/**/*.test.js", "frontend/src/**/*.spec.js"],
      env: {
        jest: true,
      },
    },
  ],
};
