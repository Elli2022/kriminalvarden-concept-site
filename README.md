# Kriminalvården planeringsyta

Det här repot är nu en intern planeringsapp i `Next.js + TypeScript` i stället för en ren HTML-skiss. Målet är att ge personalen en robust översikt över klienters aktiviteter, stoppa dubbelbokningar och förbereda projektet för framtida backend, databas och integration med klienternas paddor.

## Vald stack

- `Next.js App Router` för UI, serverrendering, route handlers och framtida backend i samma kodbas
- `TypeScript` för tydliga domänregler kring klienter, tider, aktiviteter och behörigheter
- `Prisma` som datalager mellan appen och databasen
- `SQLite` i lokal utveckling för enkel uppstart
- `PostgreSQL` är den tänkta produktionsvägen när systemet ska driftsättas på riktigt
- `Netlify` används för publik demo, med `Netlify Blobs` som lättviktig lagring för demo-flödet

## Vad som finns nu

- intern inloggning för personal
- databaskopplad planeringsvy
- klientintervall per avdelning:
  - `5.1` → `501-513`
  - `5.2` → `514-530`
  - `5.3` → `531-545`
  - `5.4` → `546-557`
  - `6.1` → `601-611`
  - `6.2` → `612-629`
  - `6.3` → `630-646`
  - `6.4` → `647-660`
- bokningsregler som blockerar överlappande tider för samma klient
- kö för inkommande önskemål från klientpaddor
- audit-logg för inloggning, bokningsskapande, borttagning och hantering av önskemål
- legacy-versionen kvar under `public/legacy/html/kriminalvarden.html`
- produktion på Netlify kör ett separat demolager som inte påverkar den lokala Prisma-databasen

## Projektstruktur

- `src/app/` innehåller routes, login och API-endpoints
- `src/components/planner-app.tsx` innehåller personalens planeringsyta
- `src/lib/` innehåller domänlogik, aktivitetskatalog, avdelningar och datumhjälpare
- `src/server/` innehåller auth, Prisma-klient och serverlogik
- `prisma/schema.prisma` beskriver datamodellen
- `prisma/seed.mjs` fyller den lokala databasen med testdata
- `prisma/bootstrap.mjs` sätter upp utvecklingsdatabasen från migrationerna

## Kom igång lokalt

```bash
npm install
npm run db:setup
npm run dev
```

Appen startar på `http://127.0.0.1:4322` om du använder samma port som i det här projektet lokalt.

## Lokal testinloggning

- `admin@kriminalvarden.local` / `demo-anstalt-2026`
- `arbetsledare@kriminalvarden.local` / `demo-anstalt-2026`

## Viktiga kommandon

```bash
npm run lint
npm run test
npm run build
npm run db:reset
```

## Nuvarande utvecklingsflöde

För lokal utveckling använder projektet en SQLite-databas i `prisma/dev.db`. Det gör att vi snabbt kan bygga vidare på planeringslogik, inloggning och integrationer utan att behöva drifta en extern databas redan nu.

Den publika demo-versionen på Netlify använder i stället `Netlify Blobs` för att kunna spara bokningar och önskemål utan lokal SQLite i serverless-miljön.

När appen går vidare mot verklig drift bör vi byta till:

- `PostgreSQL`
- riktig rollstyrning och central identitetshantering
- integration mot klienternas padda-system
- revisionslogg med tydligare historik och spårbarhet
- säkrare intern driftmiljö för känsliga uppgifter
