# Bêta publique — readiness

## Gate technique

Avant ouverture à de nouveaux utilisateurs :

```bash
npm run lint && npm run typecheck && npm test
```

Vérifier aussi :

- `/api/health` répond en liveness.
- `/api/health?db=1` répond en readiness avec DB.
- Une sauvegarde PostgreSQL a été restaurée au moins une fois sur un environnement isolé.
- `ADMIN_EMAILS`, `CSRF_SECRET`, `AUTH_SECRET`, `CRON_SECRET` sont configurés en production.

## RGPD minimal

- Pages publiques : `/privacy`, `/terms`, `/contact`.
- Export utilisateur : `/api/me/export`, exposé dans Compte → Données & RGPD.
- Suppression compte : `/api/me/delete`, exposée via Foyer → Zone sensible.
- Les signalements et événements UX sont persistés afin de suivre support et activation.

## Sécurité opérationnelle

Baseline visée : OWASP ASVS niveau 2 en audit interne.

À contrôler avant scale multi-instance :

- remplacer le rate limiter en mémoire par un stockage partagé ;
- vérifier les accès cross-household sur chaque route sensible ;
- tester restauration backup mensuellement ;
- garder un canal de contact sécurité actif via `NEXT_PUBLIC_CONTACT_EMAIL`.

## Runbook incident court

1. Qualifier : panne, bug fonctionnel, suspicion sécurité, perte de données.
2. Stabiliser : désactiver l'intégration ou la fonctionnalité fautive si possible.
3. Préserver : sauvegarder logs et snapshot DB avant correction destructive.
4. Corriger : patch, `npm run lint && npm run typecheck && npm test`, déployer.
5. Communiquer : informer les utilisateurs touchés si données ou disponibilité impactées.
6. Rétrospective : créer un `AdminAuditEvent` ou une note d'incident avec cause et prévention.
