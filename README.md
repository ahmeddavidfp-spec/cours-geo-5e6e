# Cours de geographie 5e-6e - Ines Cabossart

Site statique (aucune dependance, aucune etape de build) pour un cours de geographie
prive destine a une eleve en decrochage scolaire, home schooling. Suit le programme
officiel FESeC (reseau libre confessionnel), 3e degre, "Formation geographique"
(D/2018/7362/3/15).

Site en ligne : https://cours-geo-5e6e.pages.dev

## Structure

- `index.html` : page d'accueil / sommaire des 8 modules (4 pour la 5e, 4 pour la
  6e), avec deblocage sequentiel : un module n'est cliquable que si le precedent
  a ete reussi a 60% ou plus.
- `module-1.html` a `module-8.html` : un module par fichier. Chaque module suit
  le meme format : theorie (avec de vraies cartes), entrainement (flashcards,
  jeu de reperage sur carte, quiz sans note), examen note (seuil 60%, essais
  illimites) qui debloque le module suivant.
- `shared/engine.js` et `shared/engine.css` : moteur commun a tous les modules
  (navigation, cartes, moteur de questions, gestion de la progression). Un
  fichier module-N.html ne contient que son propre contenu (theorie, banques
  de questions) et appelle `GeoEngine.initModule({...})`.
- `assets/maps/world.svg` : fond de carte du monde reel (projection
  equirectangulaire), domaine public (CC0), John Harvey / Wikimedia Commons.
- `assets/maps/belgium-regions.svg` : carte reelle des trois regions belges,
  CC BY 3.0, Ssolbergj / Wikimedia Commons.

## Modules

### 5e annee : inegale repartition des populations et des ressources
1. Les ressources energetiques et matieres premieres (atouts/contraintes)
2. Les flux de marchandises et la mondialisation
3. Les flux de population et les migrations
4. Amenagements, risques et developpement durable

### 6e annee : amenagement du territoire
5. La ville, ses fonctions et ses modeles spatiaux
6. Justifier un amenagement du territoire (cas belges)
7. Conflits d'usage, developpement durable
8. Reperes belges et europeens, synthese finale avant le CESS

## Progression de l'eleve

La progression de chaque module (theorie lue, entrainement aborde, meilleur
score d'examen) est enregistree dans le `localStorage` du navigateur. Un
registre global (`geo_5e6e_registry`) retient quels modules sont reussis, ce
qui permet a la page d'accueil de debloquer les modules dans l'ordre. Tout
persiste tant que l'eleve revient sur le meme lien avec le meme navigateur.
Pas de backend, pas de compte : c'est volontairement simple.

## Statut

Les 8 modules (5e et 6e annees completes) sont construits, testes et en ligne.
Le module 8 termine sur une synthese qui reprend des questions de l'ensemble
du parcours, en preparation du CESS.

## Deploiement

Site statique pur : pas de commande de build, pas de dependance npm.
Deploye sur Cloudflare Pages, relie au depot GitHub
`ahmeddavidfp-spec/cours-geo-5e6e` : chaque push sur `main` redeploie
automatiquement en une trentaine de secondes. Racine du projet = racine du
site, aucune configuration de build necessaire (build command : aucune,
dossier de sortie : `/`).
