/// <reference types="vite/client" />

declare module 'react-financial-charts';
declare module 'd3-scale';
declare module 'd3-shape';
declare module 'd3-array';
declare module 'd3-format';
declare module 'd3-time-format';

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.ico' {
  const src: string;
  export default src;
}

declare module '*.ico?url' {
  const src: string;
  export default src;
}