# DomovPlus

Self-hosted SaaS platforma pre správu bytových domov (SVB / BD) v regióne SK / CZ.

Celý stack je self-hosted — žiadne externé cloudové závislosti. Všetko beží cez Docker Compose (PostgreSQL + MinIO pre dokumenty + API).

## Moduly

| Modul | Popis |
|---|---|
| **Auth** | JWT + refresh tokens + 2FA TOTP (povinné pre hlasovanie). |
| **Users / Apartments** | Vlastníci, správcovia, predsedovia, údržbári. Evidencia bytov a podielov. |
| **Hlasovanie** | Elektronické hlasovanie so zápisom paperu (listinný hlas má prioritu). Posledný elektronický hlas pred uzávierkou sa započítava. Nemenná auditná stopa. |
| **Tickets** | Hlásenie porúch s foto-dokumentáciou a stavmi. |
| **Documents** | Archív zmlúv, revíznych správ, vyúčtovaní (S3 / MinIO). |
| **Energy** | Zber a agregácia 15-minútových intervalov z IoT meračov (EDC integrácia). |
| **Audit** | Append-only log všetkých akcií s hash-reťazením. |
| **Notifications** | Digitálna nástenka s potvrdením o prečítaní. |

## Legislatívny kontext

- **SR:** Zákon 182/1993 Z. z. o vlastníctve bytov a nebytových priestorov.
- **ČR:** NOZ (zákon č. 89/2012 Sb.), §1200+ o SVJ.
- **Prístupnosť:** WCAG 2.1 AA (SR zákon č. 351/2022 Z. z.).
- **GDPR:** príslušné moduly logujú súhlasy a obmedzujú retenciu.

## Stack

- **Backend:** NestJS (Node.js 20+), Prisma, PostgreSQL 16
- **Úložisko dokumentov:** MinIO (S3-kompatibilné, self-hosted)
- **Web admin:** React 18 + Vite + TypeScript
- **Mobile:** React Native (Expo) + TypeScript
- **Auth:** JWT + TOTP (otpauth)
- **Orchestrácia:** Docker Compose

## Rýchly štart

```bash
# 1. Spusti databázu a MinIO
docker compose up -d postgres minio

# 2. Inštalácia závislostí
npm install

# 3. Migrácie a seed
npm run db:migrate
npm run db:seed

# 4. Spusti API (dev mode)
npm run dev:api

# 5. Spusti web admin (samostatný terminál)
npm run dev:web

# 6. Spusti mobile (samostatný terminál)
npm run dev:mobile
```

Po spustení:
- API: `http://localhost:3000`
- OpenAPI dokumentácia: `http://localhost:3000/docs`
- Web admin: `http://localhost:5173`
- MinIO konzola: `http://localhost:9001` (login: `domovplus` / `domovplus_dev_password`)

## Role

- `OWNER` — vlastník bytu
- `CHAIRMAN` — predseda SVB / BD
- `MANAGER` — správca
- `MAINTENANCE` — údržbár
- `ADMIN` — systémový administrátor

## Štruktúra

```
.
├── apps/
│   ├── api/          # NestJS backend
│   ├── web/          # React admin panel
│   └── mobile/       # Expo React Native
├── packages/
│   └── shared/       # spoločné typy, enumy, i18n
├── docker-compose.yml
└── package.json
```

## Bezpečnosť

- Všetky heslá hashované Argon2id.
- 2FA TOTP (RFC 6238) je **povinné** pre hlasovanie.
- Audit log využíva hash-reťaz (každý záznam obsahuje hash predchádzajúceho).
- JWT access token 15 minút, refresh token 7 dní (rotácia).
- Šifrovanie v pokoji: PostgreSQL storage a MinIO šifrujte na úrovni FS / LUKS podľa hostingu.
