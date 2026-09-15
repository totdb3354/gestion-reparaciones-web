import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Componentes shadcn: exportan componente + variantes (cva) en el mismo fichero; no aplica fast refresh estricto.
    files: ['src/shared/ui/**/*.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // Frontera de capas: shared es la base y no puede depender de las capas que la usan.
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/*', '@/app/**', '@/modules/*', '@/modules/**'],
              message: 'src/shared no puede importar de app ni de modules: la dependencia va siempre de app/modules hacia shared.',
            },
          ],
        },
      ],
    },
  },
  {
    // Frontera entre módulos: un módulo no depende de otro; lo común sube a shared.
    // Dentro del propio módulo los imports son relativos, así que este patrón solo alcanza a los módulos ajenos.
    files: ['src/modules/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/modules/*', '@/modules/**'],
              message: 'Un módulo no puede importar de otro módulo: mueve lo compartido a src/shared (dentro del módulo usa rutas relativas).',
            },
          ],
        },
      ],
    },
  },
  prettier,
)
