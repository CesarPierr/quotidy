# Backup

## Dump PostgreSQL

```bash
docker compose exec db pg_dump -U quotidy -d quotidy > quotidy-backup.sql
```

## Restauration

```bash
cat quotidy-backup.sql | docker compose exec -T db psql -U quotidy -d quotidy
```

## Fréquence recommandée

- quotidien si usage réel du foyer
- test de restauration mensuel
