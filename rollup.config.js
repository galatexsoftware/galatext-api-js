import { defineConfig } from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default defineConfig({
  input: 'src/index.js',
  output: [
    {
      file: 'dist/galatext.cjs.js',
      format: 'cjs',
      exports: 'named',
    },
    {
      file: 'dist/galatext.esm.js',
      format: 'esm',
      exports: 'named',
    },
    {
      file: 'dist/galatext.umd.js',
      format: 'umd',
      name: 'Galatext',
      exports: 'named',
    },
    {
      file: 'dist/galatext.umd.min.js',
      format: 'umd',
      name: 'Galatext',
      exports: 'named',
      plugins: [terser()],
    },
  ],
  plugins: [resolve(), commonjs()],
});