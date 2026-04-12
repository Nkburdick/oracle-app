import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
	js.configs.recommended,
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: tsParser,
			parserOptions: { sourceType: 'module', ecmaVersion: 2020 },
			globals: {
				...globals.node,
				...globals.browser,
				__APP_VERSION__: 'readonly'
			}
		},
		plugins: { '@typescript-eslint': ts },
		rules: {
			...ts.configs['recommended'].rules,
			'no-undef': 'off', // TypeScript handles this
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: { parser: tsParser, sourceType: 'module', ecmaVersion: 2020 },
			globals: {
				...globals.browser,
				__APP_VERSION__: 'readonly'
			}
		},
		plugins: { svelte, '@typescript-eslint': ts },
		rules: {
			...svelte.configs.recommended.rules,
			'no-undef': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
		}
	},
	{
		ignores: [
			'*.cjs',
			'.svelte-kit/**',
			'build/**',
			'node_modules/**',
			'docs/**',
			'scripts/**',
			'tests/fixtures/**',
			'deploy/**'
		]
	},
	prettier
];
