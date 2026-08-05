import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: false, // generated separately via `tsc --emitDeclarationOnly` - see package.json build script
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  treeshake: true,
  target: 'es2022',
});
