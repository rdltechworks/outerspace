const esbuild = require('esbuild');
const copy = require('esbuild-plugin-copy').default;

esbuild.build({
  entryPoints: ['src/client/index.tsx'],
  bundle: true,
  outdir: 'public/dist',
  splitting: true,
  sourcemap: true,
  format: 'esm',
  plugins: [
    copy({
      assets: {
        from: ['./src/client/styles.css'],
        to: ['./'],
      },
    }),
  ],
}).catch(() => process.exit(1));
