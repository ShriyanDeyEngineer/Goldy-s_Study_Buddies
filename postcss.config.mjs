/**
 * PostCSS configuration.
 *
 * Tailwind CSS v4 ships as a PostCSS plugin — this file is the only glue
 * needed to make Tailwind work. All actual theme configuration (colors,
 * fonts, radii) lives in CSS, in app/globals.css, under the @theme block.
 * Tailwind v4 has no tailwind.config.js; do not create one.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
