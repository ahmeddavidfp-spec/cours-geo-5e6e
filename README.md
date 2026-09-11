# Cours de geographie 5e-6e

Site statique (aucune dependance, aucune etape de build) pour un cours de geographie
prive destine a un eleve en decrochage scolaire, home schooling. Suit le programme
officiel FESeC (reseau libre confessionnel), 3e degre, "Formation geographique"
(D/2018/7362/3/15).

## Structure

- `index.html` : module pilote 1 (5e annee, theme "ressources energetiques et
  matieres premieres"). Theorie, entrainement (flashcards, jeu de reperage sur
  carte, quiz), examen note (seuil 60%, essais illimites) avec deblocage du
  module suivant.
- `assets/maps/world.svg` : fond de carte du monde reel (projection
  equirectangulaire), domaine public (CC0), John Harvey / Wikimedia Commons.
- `assets/maps/belgium-regions.svg` : carte reelle des trois regions belges,
  CC BY 3.0, Ssolbergj / Wikimedia Commons.

## Progression de l'eleve

La progression (theorie lue, entrainement aborde, meilleur score d'examen)
est enregistree dans le `localStorage` du navigateur, associee a l'URL du
site. Elle persiste tant que l'eleve revient sur le meme lien avec le meme
navigateur. Pas de backend, pas de compte : c'est volontairement simple.

## A venir

- Module 2 : flux de marchandises et mondialisation.
- Module 3 : flux de population et migrations.
- Module 4 : amenagement du territoire, risques aggraves, developpement durable.
- Programme de 6e annee (amenagement du territoire) une fois la 5e terminee.
- Un module de synthese finale avant le CESS, une fois les 4 annees couvertes.

## Deploiement

Site statique pur : pas de commande de build, pas de dependance npm.
Prevu pour Cloudflare Pages relie a un depot GitHub (compte
`ahmeddavidfp-spec`) : chaque push sur `main` redeploie automatiquement.
Racine du projet = racine du site, aucune configuration de build necessaire
(build command : aucune, dossier de sortie : `/`).
