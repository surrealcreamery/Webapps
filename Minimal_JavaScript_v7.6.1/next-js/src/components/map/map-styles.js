import voyagerGl from './presets/voyager-gl.json';
import positronGl from './presets/positron-gl.json';
import darkMatterGl from './presets/dark-matter-gl.json';

// ----------------------------------------------------------------------

// https://basemaps.cartocdn.com/gl/positron-gl-style/style.json
const positron = positronGl;

// https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json
const darkMatter = darkMatterGl;

// https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json
const voyager = voyagerGl;

export const MAP_STYLES = {
  light: positron,
  dark: darkMatter,
  neutral: voyager,
};
