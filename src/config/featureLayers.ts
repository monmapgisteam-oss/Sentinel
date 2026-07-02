/**
 * ArcGIS Feature Service (Mongolia environment / land-use thematic layers).
 * Toggleable overlay layers loaded as GeoJSON.
 */
export const ARCGIS_FEATURESERVER =
    'https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services/Sentinel_2/FeatureServer';

export interface Category {
    /** unique key for this category (used for toggle state) */
    value: string;
    label: string;
    color: string;
    /** fill opacity 0-1 (ArcGIS transparency 60% → 0.4). Default 0.45. */
    opacity?: number;
    /** raw field values grouped into this category (defaults to [value]) */
    values?: string[];
}

/** The raw field values that map to a category. */
export const catValues = (c: Category): string[] => c.values ?? [c.value];

export interface FeatureLayerDef {
    id: number;
    name: string;
    color: string;
    /** if set, style the layer by unique values of this field */
    categoryField?: string;
    categories?: Category[];
    /** if set, clicking a polygon shows this field's value in a popup */
    popupField?: string;
    /** abbreviate the popup value with the landscape rule (layer 4 only) */
    popupAbbreviate?: boolean;
}

/**
 * Shorten a long landscape description to "location + main type": keep the first
 * clause, drop directional / filler words. e.g.
 * "Чойбалсангийн умардын хуурай хээр, нуга и хужир мараат" → "Чойбалсангийн хуурай хээр".
 */
export function abbreviateLandscape(text: string): string {
    if (!text) return '';
    const first = text.split(',')[0];
    return first
        .replace(
            /\b(умардын|өмнөдийн|ар хажуугийн|дээд хэсгийн|доод хэсгийн|дунд хэсгийн|болон|заримдаг)\b/g,
            ' ',
        )
        .replace(/\s+/g, ' ')
        .trim();
}

/** ТХГН protected-area types (short_name) with unique symbol colors. */
export const TKHGN_CATEGORIES: Category[] = [
    { value: 'БЦГ', label: 'БЦГ', color: '#ed5151', opacity: 0.4 },
    { value: 'БНГ', label: 'БНГ', color: '#149ece', opacity: 0.4 },
    { value: 'ДЦГ', label: 'ДЦГ', color: '#a7c636', opacity: 0.4 },
    { value: 'ДГ', label: 'ДГ', color: '#9e559c', opacity: 0.4 },
];

/** Хадлан, бэлчээр zones (zonemon). "тэжээлийн эдэлбэр" abbreviated to "Т/Э". */
export const PASTURE_CATEGORIES: Category[] = [
    {
        value: 'Уулын ойн тэжээлийн эдэлбэр',
        label: 'Уулын ойн Т/Э',
        color: '#4a8f4a',
        opacity: 0.45,
    },
    {
        value: 'Өндөр уулын хүйтсэг нуга, хээрийн тэжээлийн эдэлбэр',
        label: 'Өндөр уулын Т/Э',
        color: '#5fb3a3',
        opacity: 0.45,
    },
    {
        value: 'Хээрийн тэжээлийн эдэлбэр',
        label: 'Хээрийн Т/Э',
        color: '#b5c95a',
        opacity: 0.45,
    },
    {
        value: 'Цөлийн тэжээлийн эдэлбэр',
        label: 'Цөлийн Т/Э',
        color: '#ecdcc0',
        opacity: 0.45,
    },
    {
        value: 'Бусад газар',
        label: 'Бусад газар',
        color: '#9ca3af',
        opacity: 0.45,
    },
];

/** Экологийн чухал газар zones (zone_mn) with shortened labels. */
export const ECO_CATEGORIES: Category[] = [
    {
        value: 'Монгол орны хээрийн бүс',
        label: 'Хээрийн бүс',
        color: '#b5c95a',
        opacity: 0.45,
    },
    {
        value: 'Хангай, Хөвсгөлийн экологийн бүс нутаг',
        label: 'Хангай, Хөвсгөлийн бүс',
        color: '#4a8f4a',
        opacity: 0.45,
    },
    {
        value: 'Монгол орны өмнийн говь',
        label: 'Говийн бүс',
        color: '#e0b866',
        opacity: 0.45,
    },
    {
        value: 'Баруун бүс: Монгол Алтайн нуруу, Их нууруудын хотгор, Олон нуурын хөндийн экологийн бүс нутаг',
        label: 'Баруун бүс',
        color: '#6f9fd8',
        opacity: 0.45,
    },
];

/** Ургамалжилт vegetation classes (classmon). */
export const VEG_CATEGORIES: Category[] = [
    { value: 'Уулын тайга', label: 'Уулын тайга', color: '#1f6b3b', opacity: 0.45 },
    { value: 'Уулын ойт хээр', label: 'Уулын ойт хээр', color: '#4a8f4a', opacity: 0.45 },
    { value: 'Өндөр уулын', label: 'Өндөр уулын', color: '#a3d9c9', opacity: 0.45 },
    { value: 'Уулын хээр', label: 'Уулын хээр', color: '#7fae4b', opacity: 0.45 },
    { value: 'Хээрийн ба хуурай хээр', label: 'Хээрийн ба хуурай хээр', color: '#b5c95a', opacity: 0.45 },
    { value: 'Уулын цөлийн хээр', label: 'Уулын цөлийн хээр', color: '#d9c07a', opacity: 0.45 },
    { value: 'Цөлийн хээр', label: 'Цөлийн хээр', color: '#e0b866', opacity: 0.45 },
    { value: 'Цөл', label: 'Цөл', color: '#ecdcc0', opacity: 0.45 },
    { value: 'Бэлчээр биш', label: 'Бэлчээр биш', color: '#9ca3af', opacity: 0.45 },
];

/** Хөрс soil groups (groupmon). */
export const SOIL_CATEGORIES: Category[] = [
    { value: 'Уулын хөрс', label: 'Уулын хөрс', color: '#8b5a2b', opacity: 0.45 },
    { value: 'Нам уул, ухаа-толгодын хөрс', label: 'Нам уул, ухаа-толгодын хөрс', color: '#b5834a', opacity: 0.45 },
    { value: 'Тал газар, хөндий хотгорын хөрс', label: 'Тал газар, хөндий хотгорын хөрс', color: '#cda86b', opacity: 0.45 },
    { value: 'Чийгт гаралын хөрс', label: 'Чийгт гаралын хөрс', color: '#8a9a5b', opacity: 0.45 },
    { value: 'Голын татмын хөрс', label: 'Голын татмын хөрс', color: '#7fb3b3', opacity: 0.45 },
    { value: 'Давсархаг хөрс', label: 'Давсархаг хөрс', color: '#d9d2c5', opacity: 0.45 },
    { value: 'Бусад хөрс ба хөрсгүй газар', label: 'Бусад хөрс ба хөрсгүй газар', color: '#9ca3af', opacity: 0.45 },
];

/** Газрын бүрхэвч physical-geographic provinces (mapcode). Transparency 70%. */
export const LANDCOVER_CATEGORIES: Category[] = [
    { value: 'I1', label: 'I1', color: '#e6194b', opacity: 0.3 },
    { value: 'I2', label: 'I2', color: '#f58231', opacity: 0.3 },
    { value: 'II1', label: 'II1', color: '#ffe119', opacity: 0.3 },
    { value: 'II2', label: 'II2', color: '#bfef45', opacity: 0.3 },
    { value: 'II3', label: 'II3', color: '#3cb44b', opacity: 0.3 },
    { value: 'II4', label: 'II4', color: '#aaffc3', opacity: 0.3 },
    { value: 'II5', label: 'II5', color: '#469990', opacity: 0.3 },
    { value: 'II6', label: 'II6', color: '#42d4f4', opacity: 0.3 },
    { value: 'III1', label: 'III1', color: '#4363d8', opacity: 0.3 },
    { value: 'III2', label: 'III2', color: '#911eb4', opacity: 0.3 },
    { value: 'III3', label: 'III3', color: '#f032e6', opacity: 0.3 },
    { value: 'III4', label: 'III4', color: '#9a6324', opacity: 0.3 },
    { value: 'III5', label: 'III5', color: '#808000', opacity: 0.3 },
    { value: 'IV1', label: 'IV1', color: '#a9a9a9', opacity: 0.3 },
    { value: '99', label: '99 (Ус)', color: '#4a90d9', opacity: 0.3 },
];

/** Газар ашиглалт land-use classes (classmon). */
export const LANDUSE_CATEGORIES: Category[] = [
    { value: 'Хөдөө аж ахуйн газар', label: 'Хөдөө аж ахуйн газар', color: '#c5c95a', opacity: 0.45 },
    { value: 'Ойн сан бүхий газар', label: 'Ойн сан бүхий газар', color: '#2e7d32', opacity: 0.45 },
    { value: 'Тусгай хэрэгцээний газар', label: 'Тусгай хэрэгцээний газар', color: '#9e559c', opacity: 0.45 },
    { value: 'Хот, тосгон бусад суурины газар', label: 'Хот, тосгон бусад суурины газар', color: '#e05252', opacity: 0.5 },
    { value: 'Усан сан бүхий газар', label: 'Усан сан бүхий газар', color: '#4a90d9', opacity: 0.5 },
    { value: 'Бусад газар', label: 'Бусад газар', color: '#9ca3af', opacity: 0.45 },
];

/** Ой forest species (SPECIESMON). */
export const FOREST_CATEGORIES: Category[] = [
    { value: 'Шинэс', label: 'Шинэс', color: '#3a8c3a', opacity: 0.5 },
    { value: 'Нарс', label: 'Нарс', color: '#1f6b3b', opacity: 0.5 },
    { value: 'Гацуур', label: 'Гацуур', color: '#2e7d5b', opacity: 0.5 },
    { value: 'Хуш', label: 'Хуш', color: '#4a8f6f', opacity: 0.5 },
    { value: 'Хус, улиангар', label: 'Хус, улиангар', color: '#9acd32', opacity: 0.5 },
    { value: 'Заг', label: 'Заг', color: '#c2b280', opacity: 0.5 },
    { value: 'Ойн зурвас', label: 'Ойн зурвас', color: '#6fae4b', opacity: 0.5 },
    { value: 'Шатсан буюу үхсэн ой', label: 'Шатсан буюу үхсэн ой', color: '#7d6b5d', opacity: 0.5 },
];

export const FEATURE_LAYERS: FeatureLayerDef[] = [
    {
        id: 0,
        name: 'Улсын ТХГН',
        color: '#34d399',
        categoryField: 'short_name',
        categories: TKHGN_CATEGORIES,
    },
    {
        id: 1,
        name: 'Хадлан, бэлчээр',
        color: '#a3e635',
        categoryField: 'zonemon',
        categories: PASTURE_CATEGORIES,
    },
    {
        id: 2,
        name: 'Экологийн чухал газар',
        color: '#2dd4bf',
        categoryField: 'zone_mn',
        categories: ECO_CATEGORIES,
    },
    {
        id: 3,
        name: 'Ургамалжилт',
        color: '#4ade80',
        categoryField: 'classmon',
        categories: VEG_CATEGORIES,
    },
    {
        id: 5,
        name: 'Хөрс',
        color: '#fb923c',
        categoryField: 'groupmon',
        categories: SOIL_CATEGORIES,
    },
    {
        id: 6,
        name: 'Газрын бүрхэвч',
        color: '#c084fc',
        categoryField: 'mapcode',
        categories: LANDCOVER_CATEGORIES,
        popupField: 'descmon',
    },
    {
        id: 7,
        name: 'Газар ашиглалт',
        color: '#f87171',
        categoryField: 'classmon',
        categories: LANDUSE_CATEGORIES,
    },
    {
        id: 8,
        name: 'Ой',
        color: '#166534',
        categoryField: 'SPECIESMON',
        categories: FOREST_CATEGORIES,
    },
];
