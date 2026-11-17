# SCF analytics POC (Umami fork)

Ce POC présente les parcours du RFP « Web and API Analytics for Stellar Ecosystem Projects » :
https://stellar.gitbook.io/scf-handbook/scf-awards/build-award/rfp-track#web-and-api-analytics-for-stellar-ecosystem-projects

Le PDF technique fourni sert de contexte fonctionnel. AWS, EC2, Cloudflare, Supabase,
Francfort, Redis et la haute disponibilité ne sont pas des prérequis de cette démonstration.

## Démarrer la démo sans base de données

Prérequis : Node 22.23.4 (ou une version compatible avec Prisma), pnpm 12.3.4.

```sh
pnpm install --frozen-lockfile
# Génération du client uniquement ; aucune connexion à PostgreSQL.
DATABASE_URL=postgresql://demo:demo@127.0.0.1:5432/scf_demo pnpm run generate:db:client
pnpm run dev:scf
```

Ouvrir http://localhost:3000/scf. Avec `SCF_DEMO_MODE=true`, `/` redirige vers `/scf`.
Sans ce flag, `/scf` affiche la page introuvable, `/api/scf/health` répond 404 et la racine conserve le parcours Umami.
Next.js peut envoyer un statut 200 pour une page introuvable après le début du rendu progressif.
Le lancement local génère un secret éphémère si `APP_SECRET` est absent. La démo ne nécessite ni compte ni collecte réelle. Tous les projets sont fictifs.
L'interface est en anglais pour faciliter la présentation au SCF.

## Parcours de présentation

1. Overview : métriques globales, graphique natif Umami et tableau comparatif.
2. Sélectionner 7, 30 ou 90 jours ; filtrer, trier et comparer des projets.
3. Web : pages vues, visiteurs, rebond, durée, pages, sources, pays, appareils, navigateurs.
4. API : volume, distribution HTTP, p50/p95, services et routes normalisées.
5. Choisir un projet dans le sélecteur pour prévisualiser la perspective tenant.
6. Add project : inscription gratuite, identité tenant + website, puis instructions d'intégration.
   Les nouveaux projets commencent à zéro. Cet ajout est en mémoire et disparaît au rechargement.
7. Export : JSON des données synthétiques et du journal correspondant au périmètre et à la période.
8. SCF administration : métriques standardisées par projet, répartition du trafic API et actions de gestion.
9. Data & privacy : suppression web/API/les deux sur la période courante ou tout l’historique ; retrait d’un projet et de ses données, après saisie du nom exact.

Les sélecteurs représentent des perspectives UX et ne constituent pas une authentification.
Les fixtures sont publiques ; aucune isolation de production ni RLS n'est implémentée.
La démo ne stocke pas de données personnelles ni ne vérifie les preuves d'appartenance à Stellar.
Les changements de projets ne sont pas écrits en base. Pas de promesse RGPD ou de SLA dans ce POC.

## Administration et effacement des données

L’entrée **SCF administration** est disponible dans la perspective globale. Elle regroupe les visiteurs,
pages vues, rebond, durée, volume API, erreurs 5xx et latences par projet, avec recherche, tri,
répartition du trafic et accès aux contrôles de données. Elle permet de préparer le rôle opérateur SCF.

**Data & privacy** est accessible aux deux perspectives. Un tenant ne peut sélectionner que son projet.
L’opérateur peut sélectionner un projet de l’écosystème. Deux actions sont proposées :

- **Erase analytics** conserve le projet et ses identifiants ; les données web, API ou les deux peuvent
  être effacées sur la période du dashboard ou tout l’historique disponible (90 jours de fixtures).
- **Delete project and all data** retire le projet et ses métriques de toutes les vues. Le motif permet
  notamment d’illustrer le retrait d’un projet hors écosystème par SCF.

La confirmation précise le projet, les flux, les dates UTC et les compteurs affectés. Un motif et la
saisie exacte du nom du projet sont requis. Annuler ou fermer la fenêtre n’applique rien.
Les suppressions s’appliquent immédiatement aux tableaux, graphiques, comparaisons, agrégats et exports.
La suppression du dernier projet est prise en charge ; il reste possible d’ajouter un nouveau projet.

Le journal de session conserve le libellé du projet, l’acteur simulé, la période, les compteurs et le motif.
Il reste consultable après le retrait d’un projet. Dans la perspective tenant, seuls les événements
concernant ce tenant sont affichés et exportés.

**Périmètre du POC :** ces actions ne modifient que l’état React et les filtres des fixtures dans le navigateur.
Un rechargement restaure les trois projets d’origine et vide le journal. Elles n’appellent aucune API de
suppression native, n’effacent aucune donnée PostgreSQL, ne révoquent aucune clé et ne purgent pas les sauvegardes.
Les restrictions de perspective ne constituent pas une autorisation authentifiée. La suppression réelle,
la politique de conservation du journal et la propagation de l’effacement aux systèmes de production
restent à implémenter. La rétention de 24 mois reste un objectif de production, pas un réglage actif du POC.

## Contrat tenant et réutilisation d'Umami

| Élément SCF | Élément Umami / démo |
| --- | --- |
| `tenant.id` | `Team.id` UUID existant |
| propriété web | `Website.id`, avec `Website.teamId = tenant.id` |
| membre du tenant | `User` + `TeamUser`, rôle `team-owner` |
| opérateur SCF natif | utilisateur Umami `admin`, sans adhésion à chaque équipe |
| trafic web natif | `Session` + `WebsiteEvent`, `eventType=1` pour les pages vues |
| API | fixtures attribuées par `tenantId`, `service.name`, route, statut, histogramme |

Aucune migration ou table supplémentaire. Le graphique web réutilise `PageviewsChart` d'Umami.
Les fixtures sont déterministes pour un projet et un jour UTC, avec une visite par session.
Le total global est la somme des projets ; les périodes utilisent le même générateur.
Les « visiteurs » affichés sont des sessions synthétiques distinctes par jour, pas des personnes uniques
sur toute la période. Les latences sont des estimations par borne supérieure d'histogramme ;
les histogrammes sont fusionnés avant de calculer p50/p95 (pas de moyenne de percentiles).

## Dashboard Umami natif avec un PostgreSQL simple (facultatif)

La démo `/scf` fonctionne seule. Pour démontrer aussi les écrans Umami natifs :

1. Ajouter un unique PostgreSQL dans le projet Railway de POC.
2. Configurer `DATABASE_URL` avec sa référence Railway, `APP_SECRET` avec une valeur aléatoire,
   `SCF_DEMO_MODE=true`, `SCF_NATIVE_ENABLED=true`, `DISABLE_TELEMETRY=1` et `DISABLE_UPDATES=1`.
3. Depuis un poste ayant accès à la base (URL publique/proxy TCP si exécuté en local), lancer :

```sh
pnpm run db:migrate
# Définir SCF_SEED_PASSWORD dans l'environnement (au moins 12 caractères).
pnpm run seed:scf
```

Le script ajoute 3 équipes, 3 sites, 3 comptes tenants et un opérateur, avec 90 jours d'événements.
Il refuse de tourner sans `SCF_DEMO_MODE=true` ou sans mot de passe explicite.
Les insertions sont additives et répétables grâce à des identifiants déterministes : aucun nettoyage,
aucune suppression. Les comptes existants ne sont pas modifiés, y compris leurs mots de passe.

Logins : `scf-operator`, `tenant-3`, `tenant-7`, `tenant-11`. Mot de passe : celui fourni lors du premier seed.
Se connecter sur `/login`, puis ouvrir le lien du dashboard natif depuis Integration.
Le sélecteur de perspective SCF n'authentifie pas ces comptes : la connexion native est séparée.
Les règles d'accès natives Umami restent actives ; ce POC n'ajoute pas de politique RLS.
Les données natives utilisent les mêmes visites synthétiques ; le rendu par fuseau, les visiteurs sur
plusieurs jours et certaines définitions du dashboard natif peuvent différer des agrégats de démo.

Les migrations Umami créent aussi le compte initial `admin` / `umami` : changer son mot de passe
avant d'exposer la connexion native. Ne pas utiliser une base contenant des données réelles.
Les nouvelles inscriptions effectuées dans `/scf` ne sont pas incluses dans ce seed ni persistées.

## Railway

Le dépôt contient `Dockerfile.poc`. Dans les paramètres du service Railway, choisir ce Dockerfile
(ou définir `RAILWAY_DOCKERFILE_PATH=Dockerfile.poc`), le healthcheck `/api/scf/health`
et un timeout de 120 secondes. Utiliser une seule instance et router le domaine vers
le port injecté par Railway (`PORT=8080` sur ce déploiement).
Les paramètres sont configurés directement sur le service : les nouveaux services Railway
n’acceptent plus `railway.toml` / Config as Code.
Le conteneur active `SCF_DEMO_MODE=true`, avec une seule instance et sans besoin de base.
Son démarrage génère un secret éphémère si `APP_SECRET` est absent. Définir un secret stable pour les comptes natifs.
La construction génère Prisma et le tracker mais n'applique aucune migration et n'exécute aucun seed.
Le placeholder `DATABASE_URL` ne doit être remplacé que si le dashboard natif est utilisé.
Ne pas choisir le Dockerfile Umami original pour ce mode sans base : son démarrage vérifie PostgreSQL.
La santé vérifie uniquement l'application de démo, pas une base optionnelle, le collector ou la HA.

Le projet Railway dédié est `scf-umami-poc`, dans l’espace `farau’s Projects`.
Le code est envoyé depuis le poste avec `railway up` ; aucun autodeploy GitHub n’est configuré.
URL publique : https://scf-umami-poc-production.up.railway.app/scf
Console : https://railway.com/project/d967db78-142e-4416-9b9e-1df0bb801621

## Périmètre démontré et cible de production

| Démontré | Prévu pour la production, hors POC |
| --- | --- |
| UI web/API et perspectives SCF/tenant | autorisation SCF dédiée, isolation stricte et RLS |
| ajout de tenants à €0, simulé | inscription persistante, validation, retrait, approbation |
| mapping `tenant.id` / équipe Umami | collector OTLP, double export, authentification de l'ingestion |
| normalisation fixe des routes | ingestion et agrégats PostgreSQL conservés 24 mois |
| métriques synthétiques cohérentes et parcours d’effacement en session | détection de fraude/bots, conformité et effacement réel |
| déploiement Railway à une instance | HA, réplication, bascule, supervision et SLA |
| snippet Umami natif indicatif | tracker immuable versionné, SRI et durcissement de la collecte |

La gratuité désigne les frais facturés aux tenants ; les coûts d'hébergement restent à la charge de l'opérateur.
Le RFP évoque des cibles de 99,99 % pour l'ingestion et 99,90 % pour le dashboard ;
le PDF propose 99,9 %. Aucun de ces engagements n'est implémenté ou garanti ici.
Les clés API SCF globales / par tenant et leur gestion ne sont pas implémentées dans ce POC.

## Vérification

```sh
pnpm exec vitest run src/lib/scf/demo.test.ts
pnpm exec biome check src/app/scf src/lib/scf scripts/seed-scf-demo.ts src/app/api/scf src/app/page.tsx src/app/UmamiRootPage.tsx
```

Les tests couvrent la cohérence des agrégats, l’attribution tenant, la normalisation, les percentiles,
les effacements par flux/période, les confirmations, le retrait des projets et l’écosystème vide.

Validation effectuée sur cette implémentation : compilation de production Next.js 16.4.6,
vérification TypeScript, Biome, 15 tests de données et de gestion et parcours Chrome ordinateur/mobile
(sur serveur de développement et artefact de production sans base).
Les 27 migrations natives ont été appliquées sur un PostgreSQL 15 temporaire :
13 392 sessions / 39 446 événements, inchangés après un second seed.
L'API native autorise le site du tenant, refuse un autre tenant (401) et autorise l'opérateur.
La connexion et l'affichage du dashboard natif ont également été vérifiés dans Chrome.
Déploiement Railway validé : `19b14ccc-84d9-4004-95cd-716d52f1eac0`, statut `SUCCESS`.
Le dashboard répond HTTP 200 ; `/api/scf/health` confirme `synthetic-demo` et `highAvailability=false`.
Next.js a été mis à jour de 16.4.2 à 16.4.6 pour résoudre le blocage de sécurité de la compilation.
