/**
 * Sentinel-2 evalscripts — band-math sent to the Sentinel Hub Process API.
 * Each entry mirrors a "raster function" from Esri's Sentinel-2 Explorer so the
 * server renders the visualization on the fly and returns a ready PNG tile.
 *
 * Sentinel-2 L2A bands available on Copernicus Data Space:
 *   B01 aerosol, B02 blue, B03 green, B04 red,
 *   B05/B06/B07 red-edge, B08 NIR, B8A narrow-NIR,
 *   B09 water-vapour, B11 SWIR-1, B12 SWIR-2, SCL, dataMask
 */

export type RendererId =
    | 'natural-color'
    | 'color-infrared'
    | 'agriculture'
    | 'short-wave-ir'
    | 'urban'
    | 'geology'
    | 'ndvi'
    | 'ndmi'
    | 'mndwi';

export interface RendererInfo {
    id: RendererId;
    label: string;
    /** Group used in the UI: 'composite' = band combo, 'index' = colorized index */
    group: 'composite' | 'index';
    description: string;
    evalscript: string;
}

/** Gain/gamma tuned RGB composite from three reflectance bands. */
const composite = (r: string, g: string, b: string, gain = 2.5): string => `//VERSION=3
function setup() {
  return {
    input: ["${r}", "${g}", "${b}", "dataMask"],
    output: { bands: 4 }
  };
}
function evaluatePixel(s) {
  return [${gain} * s.${r}, ${gain} * s.${g}, ${gain} * s.${b}, s.dataMask];
}`;

/**
 * Colorized normalized index (value in [-1,1]) using a ColorRamp visualizer,
 * matching the "... Colorized for Visualization" Esri renderers.
 */
const colorizedIndex = (
    numerator: [string, string],
    ramp: Array<[number, [number, number, number]]>,
): string => {
    const [a, b] = numerator;
    // Manual piecewise-linear color interpolation. (ColorRampVisualizer with a
    // plain [pos,r,g,b] ramp rendered all-black on the CDSE Process API.)
    const rampLiteral = ramp
        .map(
            ([pos, [r, g, bl]]) =>
                `[${pos}, [${r / 255}, ${g / 255}, ${bl / 255}]]`,
        )
        .join(', ');
    return `//VERSION=3
const ramp = [${rampLiteral}];
function interp(v) {
  if (v <= ramp[0][0]) return ramp[0][1];
  for (let i = 1; i < ramp.length; i++) {
    if (v <= ramp[i][0]) {
      let t = (v - ramp[i-1][0]) / (ramp[i][0] - ramp[i-1][0]);
      let a = ramp[i-1][1], b = ramp[i][1];
      return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
    }
  }
  return ramp[ramp.length-1][1];
}
function setup() {
  return {
    input: ["${a}", "${b}", "dataMask"],
    output: { bands: 4 }
  };
}
function evaluatePixel(s) {
  let idx = (s.${a} - s.${b}) / (s.${a} + s.${b});
  let c = interp(idx);
  return [c[0], c[1], c[2], s.dataMask];
}`;
};

// Color ramps (brown -> green for vegetation, etc.)
const NDVI_RAMP: Array<[number, [number, number, number]]> = [
    [-0.2, [120, 75, 40]],
    [0.0, [200, 175, 120]],
    [0.2, [225, 215, 150]],
    [0.4, [150, 190, 90]],
    [0.6, [70, 150, 50]],
    [0.8, [20, 100, 30]],
    [1.0, [10, 60, 20]],
];

const NDMI_RAMP: Array<[number, [number, number, number]]> = [
    [-0.8, [128, 70, 20]],
    [-0.4, [200, 150, 60]],
    [0.0, [240, 230, 140]],
    [0.4, [90, 180, 200]],
    [0.8, [20, 90, 200]],
];

const MNDWI_RAMP: Array<[number, [number, number, number]]> = [
    [-0.5, [180, 220, 150]],
    [0.0, [150, 200, 180]],
    [0.3, [90, 180, 200]],
    [0.6, [40, 110, 200]],
    [1.0, [10, 40, 150]],
];

export const RENDERERS: RendererInfo[] = [
    {
        id: 'natural-color',
        label: 'Natural Color',
        group: 'composite',
        description: 'True color (B4-B3-B2) — газрыг нүдэнд харагдахаар.',
        evalscript: composite('B04', 'B03', 'B02'),
    },
    {
        id: 'color-infrared',
        label: 'Color IR',
        group: 'composite',
        description: 'NIR-Red-Green (B8-B4-B3) — эрүүл ургамал тод улаан.',
        evalscript: composite('B08', 'B04', 'B03'),
    },
    {
        id: 'agriculture',
        label: 'Agriculture',
        group: 'composite',
        description: 'SWIR1-NIR-Blue (B11-B8-B2) — газар тариалан.',
        evalscript: composite('B11', 'B08', 'B02'),
    },
    {
        id: 'short-wave-ir',
        label: 'Short-wave IR',
        group: 'composite',
        description: 'SWIR2-SWIR1-Red (B12-B11-B4).',
        evalscript: composite('B12', 'B11', 'B04'),
    },
    {
        id: 'urban',
        label: 'Urban',
        group: 'composite',
        description: 'SWIR2-SWIR1-Red (B12-B11-B4) — хот суурин газар.',
        evalscript: composite('B12', 'B11', 'B04'),
    },
    {
        id: 'geology',
        label: 'Geology',
        group: 'composite',
        description: 'SWIR2-SWIR1-Blue (B12-B11-B2) — геологийн бүтэц.',
        evalscript: composite('B12', 'B11', 'B02'),
    },
    {
        id: 'ndvi',
        label: 'NDVI',
        group: 'index',
        description: 'Ургамлын индекс (B8-B4)/(B8+B4) — ногоон = өтгөн ургамал.',
        evalscript: colorizedIndex(['B08', 'B04'], NDVI_RAMP),
    },
    {
        id: 'ndmi',
        label: 'NDMI',
        group: 'index',
        description: 'Чийгийн индекс (B8-B11)/(B8+B11) — цэнхэр = чийглэг.',
        evalscript: colorizedIndex(['B08', 'B11'], NDMI_RAMP),
    },
    {
        id: 'mndwi',
        label: 'MNDWI',
        group: 'index',
        description: 'Усны индекс (B3-B11)/(B3+B11) — цэнхэр = ус.',
        evalscript: colorizedIndex(['B03', 'B11'], MNDWI_RAMP),
    },
];

export const getRenderer = (id: RendererId): RendererInfo =>
    RENDERERS.find((r) => r.id === id) ?? RENDERERS[0];
