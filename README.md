# Монгол Imagery Explorer 🛰️🇲🇳

Монгол улсын нутаг дэвсгэрийн **Sentinel-2** хиймэл дагуулын зургийг үзэх, шинжлэх
web app. Esri-ийн Imagery Explorer-ийн концепцийг **үнэгүй нээлттэй эх сурвалж**
(Copernicus Data Space / Sentinel Hub) дээр суурилуулан дахин бүтээв.

## Технологи

- **Vite + React + TypeScript**
- **MapLibre GL JS** — нээлттэй эх газрын зураг
- **Copernicus Data Space → Sentinel Hub Process API** — серверт band-math (NDVI гэх мэт)
  тооцоолоод бэлэн зураг буцаадаг
- **Tailwind CSS**

## Боломжууд

- **Composite дүрслэл:** Natural Color, Color IR, Agriculture, Short-wave IR,
  Urban, Geology, Bathymetric
- **Анализ индекс:** NDVI (ургамал), NDMI (чийг), MNDWI (ус)
- Огнооны муж сонгох (хугацааны хайлт)
- Үүлний хувь шүүх (maxCloudCoverage)
- Давхаргын тунгалаг тохируулах
- Монголын хилээр төвлөрсөн газрын зураг

## Тохиргоо

1. [Copernicus Data Space](https://dataspace.copernicus.eu/) дээр **үнэгүй** бүртгүүлнэ.
2. Sentinel Hub dashboard → User settings → **OAuth clients** → шинэ client үүсгэнэ.
3. `.env.example`-г `.env` болгож хуулаад client ID/secret-ээ оруулна:

   ```
   VITE_SH_CLIENT_ID=...
   VITE_SH_CLIENT_SECRET=...
   ```

## Ажиллуулах

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
```

## ⚠️ Аюулгүй байдал

Одоогийн хувилбар OAuth secret-ийг браузерт ашиглаж байгаа (прототипд тохиромжтой).
**Production-д** token солилцоог жижиг backend proxy-гээр дамжуулах хэрэгтэй.

## Архитектур

```
src/
  config/mongolia.ts        — хил, төв, zoom
  services/
    evalscripts.ts          — бүх renderer-ийн band-math (Esri raster function эквивалент)
    sentinelHub.ts          — OAuth + MapLibre "sh://" protocol (Process API tile renderer)
  components/
    MapView.tsx             — MapLibre газрын зураг + Sentinel давхарга
    ControlPanel.tsx        — renderer/огноо/үүл/тунгалаг удирдлага
  App.tsx
```
