# Apps natives (iOS / Android)

Runbook complet, copier-coller, pour empaqueter Quotidy en application iOS et
Android avec **Capacitor 8**. À exécuter **sur un Mac** (Xcode est obligatoire
pour iOS). Aucune commande native ne tourne sur le serveur Linux : la
configuration vit dans le dépôt, le build se fait sur la machine du dev.

---

## Mode hébergé (hosted mode) — comment ça marche

Quotidy n'est **pas** exporté en statique. Le shell natif est une simple coque
WebView qui **charge le serveur déployé** (`CAPACITOR_SERVER_URL`) en HTTPS.
C'est défini dans [`capacitor.config.ts`](../capacitor.config.ts) :

```ts
server: {
  url: process.env.CAPACITOR_SERVER_URL || "https://quotidy.example.com",
  cleartext: false,
}
```

Conséquences :

- **L'app affiche le site de prod**, exactement comme la PWA installée. Aucune
  réécriture SSR, aucun `next export`.
- **Les mises à jour web sont livrées automatiquement** : il suffit de
  redéployer le serveur. Pas besoin de re-builder ni de re-soumettre l'app tant
  que le contenu web change (le code natif, lui, est figé dans le binaire).
- **L'offline est fourni par l'app elle-même**, pas par Capacitor : le service
  worker [`public/sw.js`](../public/sw.js) (network-first sur les navigations
  et payloads RSC, fallback cache), l'outbox IndexedDB
  [`src/lib/offline-outbox.ts`](../src/lib/offline-outbox.ts), le hook
  [`src/lib/use-online.ts`](../src/lib/use-online.ts) et la bannière
  `OfflineIndicator`.
- `webDir: "native/www"` ne contient qu'un **fallback minimal**
  ([`native/www/index.html`](../native/www/index.html)) affiché uniquement si le
  serveur est injoignable au tout premier démarrage à froid. Une fois l'app
  chargée, le service worker prend le relais hors-ligne.

---

## Prérequis

| Plateforme | Outils |
|---|---|
| Commun | **Node 20+**, npm, le dépôt cloné |
| iOS | **Xcode** (App Store) + **Command Line Tools** (`xcode-select --install`) + **CocoaPods** (`sudo gem install cocoapods` ou `brew install cocoapods`) |
| Android | **Android Studio** + **Android SDK** (Platform-Tools + une plateforme récente) + **JDK 17** |

Vérifications rapides :

```bash
node -v            # v20 ou plus
xcodebuild -version
pod --version
java -version      # 17.x
```

---

## Étapes communes (une seule fois)

```bash
# Pointe la coque vers TON origine de prod (HTTPS obligatoire, sans slash final)
export CAPACITOR_SERVER_URL=https://YOUR-DOMAIN

npm ci               # installe les deps (Capacitor + plugins déjà au package.json)

npx cap add ios      # crée le projet natif ios/
npx cap add android  # crée le projet natif android/

npx cap sync         # copie la config + plugins dans les projets natifs
```

> `CAPACITOR_SERVER_URL` est lu **au moment du `cap sync`** et écrit en dur dans
> la config native générée. Si tu changes de domaine, ré-exporte la variable
> puis relance `npx cap sync`.

Les dossiers `ios/` et `android/` sont des artefacts de build locaux (à garder
hors du dépôt — voir `.gitignore`).

---

## iOS — installer sur ton iPhone (sans compte payant)

```bash
npx cap open ios     # ouvre le projet dans Xcode
```

Dans Xcode :

1. Sélectionne la cible **App** → onglet **Signing & Capabilities**.
2. Coche **Automatically manage signing**.
3. **Team** → choisis ton **Personal Team** (gratuit, lié à ton Apple ID ;
   « Add an Account… » si besoin). Le **Bundle Identifier** doit être unique :
   `com.quotidy.app` convient s'il n'est pas déjà pris par un autre de tes
   profils.
4. Branche ton iPhone en USB, sélectionne-le comme destination, puis **Run**
   (▶). Au premier lancement, sur l'iPhone : **Réglages → Général → VPN et
   gestion de l'appareil → fais confiance** à ton certificat de développeur.

### Limite du provisioning gratuit

- Un certificat **Personal Team gratuit expire au bout de 7 jours** : l'app
  cesse de se lancer et il faut la **réinstaller chaque semaine** depuis Xcode.
- **[AltStore](https://altstore.io)** automatise la re-signature en arrière-plan
  (il garde l'app valide tant que ton ordinateur est joignable sur le réseau),
  ce qui évite le rebuild manuel hebdomadaire.
- Sans compte payant, on est aussi limité à un petit nombre d'app IDs actifs et
  à **3 appareils**.

### Push natif vs web-push

- Le **push natif APNs** (notifications type app native) **nécessite l'Apple
  Developer Program payant** (99 $/an) pour générer les certificats push.
- Mais le **web-push de la PWA continue de fonctionner** dans la WebView : c'est
  le service worker [`public/sw.js`](../public/sw.js) qui gère `push` /
  `notificationclick`. Tu n'as donc rien à faire de plus pour les notifications
  côté Quotidy en sideload personnel.

---

## Android — sideload (sans compte Play, sans frais)

```bash
npx cap open android   # ouvre le projet dans Android Studio
```

Dans Android Studio :

1. Laisse Gradle se synchroniser.
2. **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
3. Récupère l'APK généré (Android Studio affiche un lien *locate* ; sinon
   `android/app/build/outputs/apk/debug/app-debug.apk`).

Sur le téléphone :

1. Transfère l'APK (câble, e-mail, partage…).
2. À l'ouverture, autorise **« Installer des applications inconnues »** pour
   l'app qui ouvre le fichier (gestionnaire de fichiers / navigateur).
3. Installe. Aucun compte Google Play ni frais de 25 $ requis pour le sideload.

> Un APK *debug* suffit pour un usage personnel. Pour un APK *release* signé,
> génère un keystore via **Build → Generate Signed Bundle / APK**.

---

## Comment l'offline fonctionne

L'app embarquée se comporte comme la PWA, parce que **c'est** la PWA chargée
dans une WebView :

1. **Premier démarrage en ligne** : la WebView charge `CAPACITOR_SERVER_URL`, le
   service worker s'installe et met en cache la coque applicative + les
   payloads RSC visités.
2. **Hors-ligne / réseau coupé** : `sw.js` sert en *network-first* puis bascule
   sur le cache (`/app` en dernier recours), et la bannière `OfflineIndicator`
   s'affiche (`use-online.ts`).
3. **Écritures hors-ligne** : les mutations qui échouent sont mises en file dans
   l'**outbox IndexedDB** (`offline-outbox.ts`) et rejouées au retour du réseau.
   Les routes `/api/` ne sont jamais mises en cache par le SW.
4. **Démarrage à froid sans réseau et sans cache** : seul cas où le fallback
   `native/www/index.html` s'affiche.

---

## Mettre à jour

- **Changement de contenu / code web** (le cas courant) : il suffit de
  **redéployer le serveur**. L'app, en mode hébergé, recharge la nouvelle
  version automatiquement — **pas de `cap sync`, pas de re-soumission**.
- **Changement de config native ou de plugins** (nouveau plugin Capacitor,
  changement d'`appId`, de `CAPACITOR_SERVER_URL`, d'icône/splash) : ré-exporte
  `CAPACITOR_SERVER_URL` si besoin, puis :

  ```bash
  npx cap sync
  ```

  et re-build/re-installe via Xcode / Android Studio.
- **Mise à jour de Capacitor** : `npm i @capacitor/core@latest @capacitor/cli@latest @capacitor/ios@latest @capacitor/android@latest` puis `npx cap sync`.

---

## CSP & navigation

En mode hébergé, la WebView charge l'**origine de prod** et applique **la CSP du
serveur** — celle définie dans [`next.config.ts`](../next.config.ts). **Ne pas y
toucher** pour le natif : aucun ajustement CSP n'est nécessaire côté Capacitor.

Seule considération : la WebView ne doit naviguer que vers ton origine. Par
défaut Capacitor garde la navigation interne au `server.url` et ouvre les liens
externes dans le navigateur système. Si tu sers Quotidy depuis plusieurs hôtes
(ex. domaine + sous-domaine d'auth), ajoute-les à `server.allowNavigation` dans
[`capacitor.config.ts`](../capacitor.config.ts) :

```ts
server: {
  url: process.env.CAPACITOR_SERVER_URL,
  allowNavigation: ["auth.YOUR-DOMAIN"],
}
```

---

## Dépannage

| Symptôme | Piste |
|---|---|
| L'app ouvre une page blanche | `CAPACITOR_SERVER_URL` mal défini au moment du `cap sync` (slash final, http au lieu de https). Ré-exporte et relance `npx cap sync`. |
| « Untrusted Developer » sur iPhone | Réglages → Général → VPN et gestion de l'appareil → fais confiance au certificat. |
| L'app iOS ne se lance plus après ~1 semaine | Provisioning gratuit expiré (7 j). Réinstalle depuis Xcode, ou utilise AltStore. |
| `pod install` échoue | `sudo gem install cocoapods` (ou `brew install cocoapods`), puis dans `ios/App` : `pod install`. Relance `npx cap sync`. |
| Gradle/SDK introuvable (Android) | Ouvre Android Studio → SDK Manager, installe Platform-Tools + une plateforme récente ; vérifie **JDK 17**. |
| `npx cap add ios/android` dit « already exists » | Les projets natifs existent déjà ; passe directement à `npx cap sync`. |
| Liens externes qui restent bloqués dans l'app | Ajoute l'hôte à `server.allowNavigation` (voir ci-dessus). |

---

## Note App Store (règle 4.2)

La règle Apple **4.2 (« Minimum Functionality »)** vise les apps qui ne sont
qu'un simple wrapper de site web et bloque leur **publication sur l'App Store**.
Pour Quotidy, c'est **sans objet en sideload personnel** : on installe via le
provisioning gratuit / AltStore, sans soumission à l'App Store. Une éventuelle
publication publique demanderait l'Apple Developer Program payant et une app
suffisamment « native » (offline réel, push natif, intégrations système).
