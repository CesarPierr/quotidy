# Setup dev

## Prérequis

- Node.js 24+
- Docker + Docker Compose

## Lancement rapide

1. Copier les variables d'environnement :

```bash
cp .env.example .env
```

2. Installer les dépendances :

```bash
npm install
```

3. Démarrer PostgreSQL :

```bash
docker compose up -d db
```

4. Générer Prisma puis pousser le schéma :

```bash
npx prisma generate
npx prisma db push
```

5. Lancer l'application :

```bash
npm run dev
```

## Données de démo

```bash
npm run db:seed
```

Compte créé :

- email : `demo@quotidy.local`
- mot de passe : `demo12345`

## E2E navigateur

```bash
npx playwright install chromium
npm run test:e2e
```
