# Changelog

Toutes les évolutions notables de Quotidy. Format inspiré de
[Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ; versionnage [SemVer](https://semver.org/lang/fr/).

## [Non publié]

Refonte de l'expérience et durcissement avant ouverture d'un port sur Internet.

### Ajouté
- **Architecture en 5 espaces** : Tâches, Aide-mémoire, Épargne, Foyer, Compte — chacun autonome avec sa sous-navigation, pilotés par une source unique (`src/lib/app-sections.ts`).
- **Aide-mémoire du foyer** : notes rapides à usage unique (FIFO, purge automatique configurable) et listes/checklists réutilisables.
- **Onboarding 3 étapes** (Bienvenue → Profil → Prêt) : passable et reprenable (localStorage), aucune écriture en base avant l'étape finale, télémétrie `onboarding.*`.
- **Hub Foyer matriciel** : choix de la sous-section via une grille de cartes plutôt qu'une barre horizontale.
- **Panneau admin** : métriques d'usage agrégées (sans donnée personnelle) — actifs 1/7/30 j, complétion, entonnoir d'onboarding, mix des signalements — avec purge de rétention de la télémétrie.

### Modifié
- **Navigation mobile** : remplacement de la barre d'onglets par deux primitives naturelles — **Retour** + **Accueil** — qui passent à l'échelle quel que soit le nombre d'espaces.
- **Épargne / calculatrices** : transitions d'ouverture *et* de fermeture des feuilles, retours tactiles sur les onglets et cartes, formulaire de calcul centré sur mobile.
- **Compte** : cartes de sections homogènes, hiérarchie et espacements normalisés, dépassements de texte corrigés, action de suppression isolée dans une zone sensible.
- **Thème sombre** : 94 occurrences du littéral `#262830` remplacées par le token `surface` (`dark:bg-surface`), rendu identique au pixel.
- **Polish** : statistiques d'activité compactes, grille de métriques admin sur 2 colonnes en mobile, en-tête « Tâches à venir » qui ne se tronque plus.

### Sécurité
- Conteneur applicatif durci : `read_only`, `cap_drop: ALL`, `no-new-privileges`, `tmpfs`, utilisateur non-root, limites mémoire/CPU.
- Base de données isolée sur un réseau Docker `internal`.
- `X-Forwarded-For` lu sur l'IP la plus à droite (anti-spoofing derrière le reverse proxy).
- Télémétrie `UxEvent` sans donnée personnelle, query string retirée des chemins enregistrés.

### Retiré
- **Serveur MCP** et son intégration (UI, API, scripts, smoke test).
- **Facturation** et les surfaces de réglages redondantes (dissoutes dans les 5 espaces ; anciennes routes conservées en redirections).

## [0.1.0]

Socle initial : moteur de récurrence et d'attribution équitable, module épargne,
calendrier, PWA, authentification par session cookie, déploiement Docker self-hosted.
