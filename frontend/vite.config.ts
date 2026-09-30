import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, lazyPlugins } from 'vite-plus'

const config = defineConfig({
  server: {
    port: 3000,
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: false } },
  },
  test: { exclude: ['e2e/**', 'node_modules/**', 'dist/**'] },
  lint: {
    plugins: ['oxc', 'typescript', 'unicorn', 'import'],
    categories: { correctness: 'error' },
    options: {
      typeAware: true,
      typeCheck: true,
    },
    env: { browser: true, es2020: true },
    ignorePatterns: ['src/routeTree.gen.ts', 'dist/**', 'coverage/**'],
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
    jsPlugins: [
      {
        name: 'vite-plus',
        specifier: 'vite-plus/oxlint-plugin',
      },
    ],
  },

  fmt: {
    endOfLine: 'lf',
    semi: false,
    singleQuote: true,
    tabWidth: 2,
    trailingComma: 'es5',
    printWidth: 80,
    sortPackageJson: false,
    sortTailwindcss: {
      stylesheet: 'src/styles.css',
      functions: ['cn', 'cva'],
    },
    sortImports: true,
    ignorePatterns: [
      'src/routeTree.gen.ts',
      'package-lock.json',
      'pnpm-lock.yaml',
      'yarn.lock',
    ],
  },
  resolve: { tsconfigPaths: true },
  plugins: lazyPlugins(() => [
    devtools(),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
  ]),
})

export default config
