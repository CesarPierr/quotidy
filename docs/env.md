# Variables d'environnement

## Cœur

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | URL PostgreSQL Prisma |
| `APP_BASE_URL` | URL publique de l'application (liens email, iCal, etc.) |
| `NEXT_PUBLIC_APP_NAME` | Nom affiché dans les nouvelles surfaces publiques/support |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Email public pour support, RGPD et sécurité |
| `NEXT_PUBLIC_SUPPORT_URL` | Lien de don/soutien optionnel |
| `AUTH_SECRET` | Secret de signature des sessions cookie |
| `DEFAULT_TIMEZONE` | Timezone par défaut des nouveaux foyers (ex. `Europe/Paris`) |
| `OCCURRENCE_PAST_DAYS` | Fenêtre passée conservée pour la génération |
| `OCCURRENCE_FUTURE_DAYS` | Horizon futur généré |

## Sécurité

| Variable | Rôle |
|---|---|
| `CSRF_SECRET` | Secret pour le double-submit CSRF (sinon dérivé de `AUTH_SECRET`) |
| `CSRF_DISABLED` | `1` pour désactiver le check CSRF (déconseillé hors tests) |
| `RATE_LIMIT_DISABLED` | `1` pour désactiver le rate-limiter en dev |
| `ICAL_SECRET` | Secret de signature des liens iCal partageables |
| `ADMIN_EMAILS` | Liste CSV des emails autorisés à accéder à `/app/admin` |

## SMTP (optionnel)

Si non défini, les liens de reset sont loggés dans la console en dev.

| Variable | Rôle |
|---|---|
| `SMTP_HOST` | Hôte SMTP |
| `SMTP_PORT` | Port SMTP (587 par défaut) |
| `SMTP_USER` | Utilisateur SMTP |
| `SMTP_PASS` | Mot de passe SMTP |
| `SMTP_FROM` | Adresse expéditeur (ex. `noreply@makemenage.local`) |

## Observabilité

| Variable | Rôle |
|---|---|
| `LOG_REQUESTS` | `1` pour logger chaque requête API (route, status, durée) |
| `GITHUB_REPORT_REPO` | Repo `owner/name` où créer les issues de feedback optionnelles |
| `GITHUB_REPORT_TOKEN` | Token GitHub pour créer les issues de feedback optionnelles |

## Billing préparatoire

| Variable | Rôle |
|---|---|
| `BILLING_ENABLED` | `1` pour activer les feature gates payants. Rester à `0` pendant la bêta. |

Voir [.env.example](../.env.example) pour un point de départ.
