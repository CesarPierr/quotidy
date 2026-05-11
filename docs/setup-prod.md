# Setup prod

## Variables à définir

- `POSTGRES_PASSWORD`
- `APP_BASE_URL`
- `APP_HOST`
- `AUTH_SECRET`

## Déploiement

1. Copier `.env.production.example` vers `.env.production`.
2. Ajuster `examples/Caddyfile` avec votre hôte.
3. Lancer :

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Le fichier de prod utilise un projet Compose distinct (`quotidy-prod`) pour pouvoir coexister avec un éventuel environnement de dev lancé depuis `docker-compose.yml` sur la même machine.
La base PostgreSQL de prod reste accessible uniquement depuis le réseau Docker interne, ce qui évite les conflits de port avec des scripts de test lancés sur le serveur.
Par défaut, le proxy de production est configuré en HTTP simple pour un accès local via VPN ou LAN, ce qui correspond mieux à un serveur privé sur IP locale comme `192.168.1.132`.

## Après déploiement

- vérifier `https://votre-domaine/api/health`
- créer le premier compte
- créer le premier foyer

## Auto-update côté serveur

Si le serveur héberge un clone git du dépôt avec un `origin`, vous pouvez activer :

```bash
sudo cp deploy/systemd/quotidy-stack.service /etc/systemd/system/
sudo cp deploy/systemd/quotidy-update.service /etc/systemd/system/
sudo cp deploy/systemd/quotidy-update.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now quotidy-stack.service
sudo systemctl enable --now quotidy-update.timer
```

Le timer vérifie `origin/main` toutes les 5 minutes, fait un `git pull --ff-only`, puis redéploie les conteneurs.

## Cas particulier : le serveur est aussi la machine de travail

Si le dépôt local sur le serveur est la source de vérité, vous pouvez utiliser un cron utilisateur simple :

```bash
crontab -l > /tmp/quotidy-cron 2>/dev/null || true
echo '*/5 * * * * cd /home/pierre/quotidy && bash scripts/server/deploy-if-head-changed.sh >> /home/pierre/quotidy/.deploy-state/cron.log 2>&1' >> /tmp/quotidy-cron
crontab /tmp/quotidy-cron
rm -f /tmp/quotidy-cron
```

Dans ce mode, chaque nouveau commit local sur `main` déclenche un redéploiement automatique au prochain passage du cron.

Vous pouvez aussi installer ce cron avec :

```bash
npm run deploy:install-local-cron
```
