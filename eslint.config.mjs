import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
    {
        ignores: [
            'dist/**',
            'dist-build/**',
            'dist-build*/**',
            'dist-electron/**',
            'release/**',
            'output/**',
            'coverage/**',
            'tmp/**',
            'test-results/**',
            'playwright-report/**',
            '.codex-run/**',
            'node_modules/**',
            'docs/**',
            '.idea/**',
            '.expo/**',
            '.playwright-cli/**',
            '.playwright-mcp/**',
            '.venv*/**',
            '**/.venv*/**',
            'third_party/**',
            'scripts/**/*.mjs',
            'scripts/**/*.cjs'
        ]
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: [
            'src/**/*.{ts,tsx}',
            'packages/notifications/src/**/*.{ts,tsx}',
            'vite.config.mts',
            'tsup.config.ts',
            'vitest.setup.ts',
            'scripts/run-mechanics-appendix.ts'
        ],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node
            },
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: __dirname
            }
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': [
                'warn',
                {
                    allowConstantExport: true,
                    allowExportNames: [
                        'useCardArtFilters',
                        'useCardArtFiltersOptional',
                        'usePlatformTiltContext',
                        'wipEndproductSvgFiles'
                    ]
                }
            ],
            '@typescript-eslint/consistent-type-imports': 'warn',
            '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }]
        }
    },
    {
        files: ['e2e/**/*.ts', 'playwright.config.ts'],
        extends: [tseslint.configs.disableTypeChecked],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node
            },
            parserOptions: {
                project: false,
                tsconfigRootDir: __dirname
            }
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': [
                'warn',
                {
                    allowConstantExport: true,
                    allowExportNames: [
                        'useCardArtFilters',
                        'useCardArtFiltersOptional',
                        'usePlatformTiltContext',
                        'wipEndproductSvgFiles'
                    ]
                }
            ],
            '@typescript-eslint/consistent-type-imports': 'off',
            '@typescript-eslint/no-misused-promises': 'off'
        }
    },
    {
        // src/shared is the pure gameplay domain and imports React nowhere. The
        // react-hooks rules only produced false positives there: useRunInventoryItem
        // is a domain transition, not a React hook, so rules-of-hooks flagged every
        // call site.
        files: ['src/shared/**/*.ts'],
        rules: {
            'react-hooks/rules-of-hooks': 'off',
            'react-hooks/exhaustive-deps': 'off'
        }
    },
    {
        // The codebase already marks deliberately-unused bindings with a leading
        // underscore (destructured rest-omits, kept-for-signature parameters); honour
        // that convention instead of reporting each one.
        files: ['src/**/*.{ts,tsx}', 'packages/notifications/src/**/*.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    args: 'after-used',
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                    ignoreRestSiblings: true
                }
            ]
        }
    }
);
