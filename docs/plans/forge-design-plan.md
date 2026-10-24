# Forge Design : slides, codelabs, design system

Plan de transformation de Forge en atelier de création (inspiré de Claude Design), limité à quatre familles de livrables : site web, application mobile, présentation, codelab, plus le design system qui les habille. Pas de 3D ni de diagrammes pour l'instant.

Statut : proposition, rien n'est implémenté. Rédigé le 2026-10-24 à partir d'une lecture du code de `forge-web`, décisions produit du 2026-10-24 intégrées (section 12).

---

## 1. Principes

1. **Un livrable = un projet.** Une présentation, un codelab ou un design system compte comme un projet, comme un site. `max_projects` s'applique tel quel, sans nouveau compteur.
2. **Slides et codelabs sont des documents, pas du code généré.** Un site Forge est du React écrit par l'IA. Une présentation où l'utilisateur déplace un texte à la souris doit être une **donnée** (positions, tailles, styles) rendue par un lecteur Forge fixe. C'est la décision centrale du plan, elle rend possibles :
   - le déplacement et le redimensionnement libres, l'édition directe du texte ;
   - l'édition d'une seule slide par l'IA, garantie par construction (elle ne reçoit et ne renvoie que cette slide) ;
   - un export PPTX **modifiable** et fidèle (les positions sont connues, pas devinées) ;
   - les transitions, les animations, le mode présentateur, sans dépendre de ce que l'IA a codé.
3. **Pas de responsive pour les slides.** Canevas fixe mis à l'échelle de l'écran avec bandes si besoin. Trois formats : **16:9 par défaut** (1920 x 1080), 4:3 (1440 x 1080) et 1:1 réseaux sociaux (1080 x 1080). Plus de bascule bureau/tablette/téléphone pour ce type.
4. **Images gratuites par défaut, IA sur demande.** Banques d'images libres sans crédit ; génération IA au choix du modèle, facturée par la gateway RodiumAi (FRODI puis RODI), refus immédiat si le solde ne suffit pas.
5. **Le design system habille tout.** Le thème d'une présentation, d'un codelab ou d'un site est un design system ; on peut en rattacher un à n'importe quel projet.
6. **Tout derrière un drapeau par type**, livré par vagues sur `dev`, `main` = production.

---

## 2. Ce qui existe et ce qu'on réutilise

| Brique | Où | Réutilisation |
|---|---|---|
| Projets, quota, partage, historique git | `models.py:129`, `services/history.py` | Tel quel pour tous les types |
| Publication sur `{slug}.domaine`, domaines perso | `publish_esm.py`, Caddy | Un lecteur statique de slides ou de codelab se publie comme un site |
| Charte (`DESIGN.md`, couleurs, polices Google) | `brand_charter.py`, `design_colors.py` | Base du design system et des thèmes |
| Génération d'images (gpt-image-2, voies gateway, BYOK) | `orchestration/images.py:52` | Génération par élément |
| Contrôle de solde avant appel payant (402) | `capabilities.py:45` | Message "crédits insuffisants" immédiat |
| Playwright côté serveur | `prerender.py`, `url_capture.py` | Export PDF et PNG, vignettes |
| Node côté API (`runtime/cli.mjs`) | `runtime/` | Export PPTX avec pptxgenjs |
| SSE des runs, événements dans Valkey | `routers/chats.py`, `run_queue.py` | Génération de deck en flux |
| Galerie de kits | `TemplateGallery.tsx`, `services/templates.py` | Ajout des familles slides, codelab, design system |

## 3. Ce qui bloque aujourd'hui

1. Le type de projet est figé à `web|mobile` dans environ 15 endroits (`schemas.py:338,359,406`, `routers/projects.py:380`, `routers/templates.py:23`, `services/templates.py:36`, `scaffold.py:730`, `context.py:426`, `brand_charter.py:363`, `template_examples.py:24`, `PlatformToggle.tsx:7`, `create-project.ts:12`...).
2. Les pages sont devinées par regex (`types.ts:120`), aucune liste déclarée.
3. La sélection d'un élément n'est qu'un indice dans le prompt (`prompt-attachments.ts:289`), rien n'empêche l'IA d'écrire ailleurs.
4. Aucun outil PDF ni PPTX, aucun coloriage de code, aucune banque d'images.
5. Forge ne connaît pas le prix d'une image ; la gateway facture après coup.

---

## 4. Fondations communes (vague 0)

### 4.1 Registre de types

Un module unique `apps/api/app/kinds/` décrit chaque type ; tous les `in ("web","mobile")` lisent le registre. Côté web, `lib/kinds.ts` en miroir.

```python
@dataclass(frozen=True)
class ProjectKind:
    id: Literal["web", "mobile", "slides", "codelab", "design_system"]
    engine: Literal["react", "document"]   # react = code généré, document = données + lecteur Forge
    scaffold: Callable                       # squelette de départ
    prompt_rules: str                        # règles ajoutées au prompt système
    default_kit: str
    editor: Literal["builder", "deck", "codelab", "design_system"]
    exports: tuple[str, ...]                 # zip, pdf, pptx, html, png, md, tokens
    publish: Literal["site", "deck_player", "codelab_player", "design_system_site"]
```

`Project.platform` (`String(16)`) accepte déjà les nouvelles valeurs, aucun changement de schéma.

### 4.2 Identifiants stables et édition ciblée (sites et applis)

Pour les projets `engine=react` :
- un plugin Babel ajoute `data-forge-id="<fichier>:<ligne>:<colonne>"` à chaque élément JSX, en aperçu seulement (retiré à la publication) ;
- le message de chat transporte une **cible** : `{ route, forgeId?, filePath? }` (`SendMessageRequest`, `schemas.py:458`) ;
- le serveur restreint le contexte à ces fichiers (`focus_paths`) et **refuse toute écriture hors liste** dans `apply_validated_writes` ; si l'IA veut toucher autre chose, elle le dit et l'utilisateur élargit.

Pour les projets `engine=document`, l'édition ciblée est native (section 5.5).

### 4.3 Images : banques libres par défaut, IA au choix

Un panneau image unique, partagé par tous les éditeurs, avec trois onglets :

| Onglet | Source | Coût |
|---|---|---|
| **Libres** (par défaut) | Recherche serveur Pixabay (photos, illustrations, vecteurs), Openverse en secours | Gratuit |
| **Importer** | Upload, logo, assets du projet (existant) | Gratuit |
| **IA** | Modèle choisi dans une liste, prompt prérempli avec le style du design system, format déduit du cadre | Facturé par RodiumAi |

Règles :
- **Libres** : endpoint `GET /images/search?q=&orientation=&lang=` côté API, source **Pixabay** (API testée le 2026-10-24 : 200, recherche en français, images jusqu'à 5500 px, vidéos aussi). Clé dans la configuration serveur (`PIXABAY_API_KEY`), jamais dans le code ni le front. Conditions Pixabay respectées : résultats mis en cache 24 h côté serveur (limite 100 requêtes par minute), pas de lien direct permanent, l'image choisie est **téléchargée dans `public/images/` du projet** puis convertie en WebP ; mention "Images : Pixabay" dans le sélecteur, auteur enregistré dans `.forge/media.json`. Openverse en secours si besoin. Unsplash abandonné.
- L'IA de génération de deck ou de site utilise aussi la recherche libre pour remplir les visuels par défaut, au lieu des dégradés de remplacement.
- **IA** : liste des modèles d'image du catalogue (`ModelCatalog` filtré sur le type image). Aucun calcul de prix dans Forge : la gateway calcule et débite (FRODI d'abord, RODI ensuite). Avant l'appel, `require_rodi_for_paid_capability` refuse si les deux soldes sont à zéro ; si la gateway répond 402, l'interface affiche tout de suite "Crédits insuffisants" avec un lien de recharge. Clé BYOK : même chemin, facturée sur la clé.
- Endpoint `POST /projects/{id}/images/generate { model, prompt, aspect, target }` qui réutilise `request_image_bytes` puis `save_webp_with_variants`.

---

## 5. Présentations (type `slides`)

### 5.1 Format de document

Fichiers du projet :

```
deck.json            métadonnées, ordre des slides, thème, format
slides/<id>.json     une slide = liste d'éléments positionnés
notes/<id>.md        notes du présentateur
public/images/...    images (libres, importées, générées)
DESIGN.md            charte (thème)
```

`deck.json` :

```json
{
  "version": 1,
  "format": { "ratio": "16:9", "width": 1920, "height": 1080 },   // aussi "4:3" (1440 x 1080) et "1:1" (1080 x 1080)
  "theme": { "designSystem": "local", "tokens": "DESIGN.md" },
  "slides": [
    { "id": "s1", "layout": "title", "transition": { "type": "fade", "durationMs": 500 } },
    { "id": "s2", "layout": "two-columns", "transition": { "type": "push", "direction": "left" } }
  ]
}
```

`slides/s1.json` :

```json
{
  "id": "s1",
  "background": { "type": "color", "token": "--bg" },
  "elements": [
    {
      "id": "e1", "type": "text", "role": "title",
      "x": 160, "y": 380, "w": 1600, "h": 200, "rotation": 0, "z": 2,
      "content": [{ "type": "paragraph", "text": "Rapport annuel 2026" }],
      "style": { "font": "display", "size": 96, "weight": 700, "color": "--fg", "align": "left" },
      "animation": { "type": "rise", "trigger": "on-click", "delayMs": 0 }
    },
    {
      "id": "e2", "type": "image",
      "x": 1100, "y": 0, "w": 820, "h": 1080,
      "src": "public/images/hero.webp", "fit": "cover",
      "credit": { "source": "pexels", "author": "Jane Doe", "url": "..." }
    }
  ]
}
```

Types d'éléments : `text`, `image`, `shape` (rectangle, rond, ligne, flèche), `icon` (lucide), `table`, `chart` (barres, lignes, secteurs, données éditables), `video` (lien), `code` (pour les decks techniques), `group`. Pas de diagramme pour l'instant.

Validation stricte côté API (Pydantic) et côté web (Zod), schéma versionné. Les couleurs et polices référencent les jetons du thème : changer de thème restyle tout le deck.

### 5.2 Lecteur de présentation (partagé)

Un paquet `@forge/deck-player` (dans `apps/web/packages/` ou `apps/api/runtime/`), utilisé tel quel par l'éditeur, l'aperçu, la page publiée, l'export HTML et l'export PDF. Il :
- met le canevas 1920 x 1080 à l'échelle de la fenêtre (bandes noires si ratio différent), aucun responsive ;
- joue transitions et animations (framer-motion, déjà dans le manifeste) ;
- gère le plein écran, le clavier et les **télécommandes de présentation** (5.4) ;
- ouvre une **vue présentateur** dans une seconde fenêtre (notes, minuteur, slide suivante, aperçu) synchronisée avec l'écran du public par `BroadcastChannel` : aucun serveur nécessaire, ça marche aussi sur le lien publié ;
- sur téléphone, balayage gauche/droite.

### 5.3 Transitions et animations prêtes à l'emploi

Catalogue au choix dans un panneau avec aperçu au survol, comme Canva.

**Transitions de slide** : aucune, fondu, pousser (4 directions), glisser, balayer (wipe), zoom avant, zoom arrière, dissolution, rideau, cube léger, **"Morph"** (les éléments présents sur deux slides consécutives avec le même `matchKey` se déplacent et se redimensionnent d'une position à l'autre, équivalent de "Associer et déplacer" de Canva et de Morph dans PowerPoint). Bouton "Appliquer à toutes les slides".

**Animations d'élément** : apparition, montée, descente, glissement, pop, zoom, machine à écrire, révélation par masque, rebond, pulsation. Déclencheurs : à l'arrivée de la slide, au clic (étape), après le précédent. Ordre réglable.

**Préréglages de style** : "Sobre" (fondu partout), "Dynamique" (pousser + montée), "Élégant" (morph + révélation), appliqués en un clic.

### 5.4 Télécommandes (le "pointeur")

Une télécommande de présentation (Logitech Spotlight ou R400, Kensington, etc.) se présente comme un clavier. Le lecteur gère donc, en local comme sur le lien publié :

| Touche envoyée | Action |
|---|---|
| Flèche droite, flèche bas, Page suivante, Espace, Entrée, N | Étape ou slide suivante |
| Flèche gauche, flèche haut, Page précédente, Retour arrière, P | Étape ou slide précédente |
| Début, Fin | Première, dernière slide |
| F5, Maj+F5 | Lancer le diaporama (du début, de la slide courante) |
| Échap | Quitter le plein écran |
| B ou point | Écran noir (bouton "écran noir" des télécommandes) |
| W ou virgule | Écran blanc |
| Chiffres puis Entrée | Aller à la slide N |

Les animations "au clic" consomment l'appui avant de changer de slide, comme dans PowerPoint. La surbrillance "laser" logicielle des télécommandes est une superposition du système, elle fonctionne d'office. Test manuel prévu avec au moins une télécommande physique.

Option ultérieure (hors périmètre initial) : suivi à distance par le public sur son propre appareil, qui demanderait un service temps réel.

### 5.5 Éditeur de présentation

Nouvelle surface `app/projects/[id]` pour `editor=deck`, à la place du builder :

- **Colonne de gauche** : vignettes des slides, glisser-déposer pour réordonner, dupliquer, supprimer, ajouter (choix de mise en page).
- **Canevas central** : sélection, déplacement, redimensionnement, rotation (react-moveable + selecto, licence MIT), guides magnétiques et alignement, multi-sélection, grouper, premier plan / arrière-plan, copier-coller, annuler/rétablir.
- **Texte modifiable directement** : double-clic pour éditer (TipTap, licence MIT, marques limitées : gras, italique, souligné, lien, listes, couleur du thème), barre de mise en forme (police du thème, taille, alignement, interligne).
- **Panneau de droite** selon la sélection : style, transition de la slide, animation de l'élément, image (section 4.3), données d'un graphique.
- **Bas** : notes du présentateur.
- **Chat IA** à côté, avec la cible :
  - rien de sélectionné : l'IA travaille sur tout le deck ;
  - une slide sélectionnée : l'IA ne reçoit et ne renvoie que `slides/<id>.json` (garanti, pas un conseil) ;
  - un élément sélectionné : l'IA ne modifie que cet élément ;
  - actions rapides : "Raccourcir", "Plus percutant", "Changer la mise en page", "Ajouter un visuel", "Traduire la slide".
- Sauvegarde automatique (débounce) avec instantané git par lot, comme les sites.

### 5.6 Génération par l'IA

Flux en trois temps, plus fiable qu'une génération d'un bloc :
1. **Plan** : à partir du sujet, des fichiers joints (PDF, notes, URL) et du public visé, l'IA propose le plan (titres et idées par slide, nombre de slides). L'utilisateur valide ou modifie (réutilise `ClarifyCard` / `PlanPanel`).
2. **Rédaction et mise en page** : l'IA choisit une mise en page du kit pour chaque slide et remplit le contenu, en JSON validé par le schéma ; une slide invalide est réparée automatiquement (comme `verify_build`).
3. **Visuels** : recherche d'images libres par slide, génération IA seulement si l'utilisateur l'a demandé.

Les slides apparaissent une à une pendant la génération (SSE existant). Modèle : Sonnet pour le plan et la rédaction, Flash pour les retouches. Règles de prompt dédiées : une idée par slide, 6 lignes maximum, hiérarchie titre / contenu, chiffres mis en avant, pas de phrase longue, ton de la charte.

### 5.7 Exports et partage

| Format | Méthode | Notes |
|---|---|---|
| **Lien** | Publication du lecteur + JSON sur `{slug}.domaine` (ou domaine perso) | Options : autoriser le téléchargement PDF, masquer les notes, mot de passe plus tard |
| **PDF** | Playwright ouvre le lecteur en mode impression, une page 1920 x 1080 par slide, texte vectoriel | Option "une page par étape d'animation" |
| **PPTX** | pptxgenjs (Node, déjà présent) à partir du JSON | Zones de texte, images, formes, tableaux, **graphiques natifs** modifiables dans PowerPoint ; notes incluses ; transitions ajoutées par post-traitement du XML (`p:transition`, morph `p159:morph`) |
| **HTML** | Un fichier autonome (lecteur + JSON + images en base64) | Fonctionne hors ligne |
| **PNG** | Playwright, une image par slide, ZIP | Pour les réseaux sociaux |

Limite PPTX connue : les polices Google ne sont pas intégrées au fichier ; on propose la police de secours la plus proche et un avertissement listant les polices à installer. Effets non reproductibles (flou, dégradés complexes) : rendus en image dans le PPTX.

### 5.8 Modèles de présentation (36 au départ)

Un modèle = un thème (jetons de couleur, polices, fonds, style d'images) + 10 à 12 mises en page (titre, section, texte, deux colonnes, image et texte, citation, chiffres clés, graphique, tableau, équipe, chronologie, merci) + un contenu d'exemple de 8 à 12 slides.

Répartition proposée (36) :
- **Business** (8) : pitch deck startup, levée de fonds, revue trimestrielle, rapport annuel, proposition commerciale, plan stratégique, étude de marché, lancement produit.
- **Marketing** (6) : présentation de marque, campagne, études de cas, portfolio agence, kit média, roadmap produit.
- **Éducation** (6) : cours, soutenance, exposé scolaire, atelier, conférence scientifique, formation interne.
- **Tech** (6) : démo produit, architecture (sans diagramme : blocs et texte), revue de sprint, keynote dev, onboarding développeur, post-mortem.
- **Créatif et personnel** (6) : portfolio, CV visuel, mariage ou événement, voyage, moodboard, bilan personnel.
- **Minimal** (4) : clair, sombre, éditorial, monochrome.

Sources : **nous créons nos propres modèles**. Pas de récupération de Canva, Slidesgo ou équivalents (leurs licences interdisent la redistribution dans un autre produit). Inspiration et bases autorisées : thèmes open source sous licence MIT (Slidev, reveal.js, Marp) et modèles sous licence libre vérifiée un par un. Un agent de recherche produit une liste de sources avec licence, puis les agents de création produisent les 36 dans notre format JSON, avec images libres ou générées. Chaque modèle livré avec `template.json` (`kind: "slides"`), vignette, et test de validation du schéma.

---

## 6. Codelabs (type `codelab`)

### 6.1 Format

```
codelab.json        titre, résumé, durée totale, niveau, prérequis, ce que vous apprendrez, auteur, étapes
steps/<n>-<slug>.md une étape en Markdown étendu
files/...           fichiers téléchargeables (sources, starter, solution)
public/images/...
DESIGN.md
```

`codelab.json` :

```json
{
  "version": 1,
  "title": "Créer une API REST avec FastAPI",
  "summary": "...",
  "level": "beginner",
  "durationMinutes": 45,
  "prerequisites": ["Python 3.12", "Un terminal"],
  "learn": ["Créer des routes", "Valider les données"],
  "steps": [
    { "id": "intro", "file": "steps/01-intro.md", "minutes": 3 },
    { "id": "setup", "file": "steps/02-setup.md", "minutes": 7 }
  ],
  "downloads": [
    { "id": "starter", "label": "Projet de départ", "path": "files/starter", "zip": true },
    { "id": "solution", "label": "Solution finale", "path": "files/solution", "zip": true }
  ]
}
```

### 6.2 Afficher le code proprement

Blocs Markdown étendus, rendus par un lecteur Forge `@forge/codelab-player` :

- **Coloration Shiki** (grammaires VS Code, thèmes clair et sombre accordés au design system), langues chargées à la demande pour rester léger.
- En-tête de bloc : **nom du fichier**, langage, bouton **Copier** (avec retour "Copié"), bouton **Télécharger ce fichier**.
- **Numéros de ligne**, **lignes surlignées** (` ```py title="main.py" {3-5} `), **mode diff** (lignes `+` / `-` colorées, copie sans les signes).
- **Groupes d'onglets** : même étape en plusieurs langages ou plusieurs fichiers (`main.py` / `requirements.txt`), choix mémorisé.
- **Bloc terminal** : invite `$` non copiée, sortie grisée distincte de la commande.
- **Repli** des longs blocs (afficher plus).
- **Arborescence de fichiers** (bloc `tree`) pour montrer la structure du projet.
- **Encadrés** : info, astuce, attention, danger.
- Retour à la ligne désactivé avec défilement horizontal, police à chasse fixe du design system.

### 6.3 Fichiers à télécharger

- Les fichiers sont dans `files/` du projet (glisser-déposer dans l'éditeur, ou générés par l'IA).
- Bouton par fichier dans un bloc de code (`download="files/starter/main.py"`), et carte de téléchargement par étape ou globale.
- À la publication, le serveur crée les **ZIP** déclarés (`downloads[].zip`) et les publie à côté du site statique ; le lecteur affiche taille et nom.
- Lien "Ouvrir dans un dépôt" optionnel (URL GitHub saisie par l'auteur), pas d'exécution de code côté Forge.

### 6.4 Lecteur publié

- Menu latéral des étapes avec durée, barre de progression, étape courante dans l'URL (`#setup`) pour partager un lien direct.
- Boutons Précédent / Suivant, raccourcis clavier, progression gardée dans le navigateur (`localStorage`).
- Page d'accueil : résumé, durée, niveau, prérequis, ce que vous apprendrez ; page de fin : récapitulatif, téléchargements, lien de retour d'expérience.
- Recherche dans le codelab, mode impression / PDF.

### 6.5 Éditeur et IA

- Éditeur Markdown avec aperçu en direct côte à côte, insertion de blocs (code, terminal, onglets, encadré, image, téléchargement, arborescence), réordonnancement des étapes.
- IA : génère le plan des étapes, puis chaque étape ; édition ciblée sur une étape (garantie, comme les slides) ; "Vérifier la cohérence du code entre les étapes".
- Import du format Markdown des Google Codelabs (claat) ; export Markdown, PDF, ZIP des sources.
- Modèles : 8 au départ (tutoriel API, frontend, mobile, data, DevOps, atelier débutant, migration, intégration d'un SDK RodiumAi).

---

## 7. Design system (type `design_system`)

- Contenu : jetons (couleurs avec rôles et contrastes vérifiés, échelle typographique, espacements, rayons, ombres, durées d'animation), logo et règles d'usage, iconographie, style d'images, ton de voix, à faire / à éviter, vitrine de composants (boutons, champs, cartes, badges, alertes, tableaux).
- Création : depuis un brief, depuis un logo (vision, existant), ou **depuis un site existant** (capture Playwright existante, extraction des couleurs et polices).
- Stockage : `design-system.json` (jetons au format W3C Design Tokens) + `DESIGN.md` généré, et une ligne en base `design_systems` pour le **rattacher** à d'autres projets. Décidé : **les deux niveaux**, design systems personnels (`owner_user_id`) et design systems d'équipe (`team_id`, visibles par tous les membres, modifiables par les admins). Un design system par défaut peut être choisi par utilisateur et par équipe.
- Rattachement : au moment de créer un site, une présentation ou un codelab, choix "Utiliser mon design system". La mise à jour du design system se propage (proposition de resynchroniser, pas d'écrasement silencieux).
- Exports : `tokens.json` (W3C), variables CSS, configuration Tailwind, PDF de la charte, lien publié de la charte.

---

## 8. Plans et droits

Décidé : **le plan Free n'exporte rien.** On crée, on voit et on présente en direct, avec un badge "Made with Forge" en bas de la présentation, du codelab ou du site publié. Les exports se débloquent à partir de Starter, progressivement.

| Fonction | Free | Starter | Builder | Pro et plus |
|---|---|---|---|---|
| Créer slides, codelab, design system | Oui (quota projets) | Oui | Oui | Oui |
| Présenter en direct, lien publié | Oui, badge "Made with Forge" | Oui, badge retirable | Oui | Oui |
| Export PDF, PNG | Non | Oui | Oui | Oui |
| Export HTML autonome | Non | Non | Oui | Oui |
| Export PPTX | Non | Non | Oui | Oui |
| Export Markdown et ZIP du codelab | Non | Oui | Oui | Oui |
| Images libres | Oui | Oui | Oui | Oui |
| Images IA | Oui, facturées | Oui, facturées | Oui, facturées | Oui, facturées |
| Design system partagé avec l'équipe | Non | Non | Non | Oui (plans Team) |

Nouveaux droits dans `ForgeEntitlementCache` et la synchro Nest : `export_pdf`, `export_html`, `export_pptx`, `remove_badge`, `design_system_sharing`. Le badge est ajouté par le lecteur à la publication et dans l'aperçu partagé, retiré seulement si le droit `remove_badge` est vrai.

---|---|---|---|
| Créer slides, codelab, design system | Oui (quota projets) | Oui | Oui |
| Lien publié | Oui | Oui | Oui |
| Export PDF, PNG | Oui (filigrane) | Oui | Oui |
| Export PPTX, HTML | Non | Oui | Oui |
| Images libres | Oui | Oui | Oui |
| Images IA | Oui, facturées | Oui, facturées | Oui, facturées |
| Rattacher un design system à plusieurs projets | Non | Non | Oui |

Nouveaux droits dans `ForgeEntitlementCache` et la synchro Nest : `export_pptx`, `export_html`, `pdf_watermark`, `design_system_sharing`. Le reste suit les droits existants.

---

## 8 bis. Accueil et navigation "Forge Design"

Inspiré de Claude Design (captures du 2026-10-24) : une entrée unique où l'on décrit ce qu'on veut, plutôt qu'un tableau de bord de projets web.

### Page d'accueil (`/dashboard`, refondue)

1. **Titre** "Que créons-nous ?" et une grande zone de saisie : décrire, joindre un fichier (PDF, DOCX, PPTX, image, URL), coller un lien.
2. **Barre sous la saisie** :
   - `+` : joindre un fichier ou une capture de site ;
   - **sélecteur de design system** avec mini aperçu (couleurs, police titre / texte), "Aucun" possible ;
   - **sélecteur de modèle IA** (selon les droits du plan) ;
   - bouton Envoyer.
3. **"Choisir un type"**, grille de tuiles avec icône (dépliable, ouverte par défaut) :
   - Vierge (l'IA choisit le type d'après la demande)
   - Site web
   - Appli mobile
   - Présentation (Slides)
   - Codelab
   - Design system
   - Raccourcis vers des sous-types utiles, qui pré-remplissent le type et le format : Pitch deck, Carrousel réseaux sociaux (slides 1:1), Landing page, Tutoriel (codelab), Palette couleurs et polices (design system).
   Choisir une tuile ouvre la galerie de modèles filtrée par ce type, ou lance directement la génération si un texte est saisi.
4. **En bas, trois onglets** : **Projets**, **Design systems**, **Modèles**.
   - Recherche, favoris (étoile), bascule liste / grille.
   - Filtres : Tous, Les miens, Partagés avec moi ; par type.
   - **Liste** : vignette, nom, dernière ouverture, propriétaire, accès (crayon si modifiable), menu `...` (renommer, dupliquer, partager, déplacer dans l'équipe, supprimer), étoile.
   - **Grille** : cartes avec vignette en pile (effet "plusieurs slides" pour les decks), couleur de fond selon le type (orange présentation, violet design et design system, vert codelab, bleu site, sarcelle appli), icône du type, nom, "Ouvert il y a 8 h".
5. Bandeau d'annonce fermable pour présenter la nouveauté aux utilisateurs existants.

### Création

- Avec texte : le type est déduit (ou celui de la tuile choisie), puis l'IA pose ses questions (carte de clarification existante) : public, nombre de slides, ton, format.
- Sans texte : la galerie de modèles s'ouvre ; "Utiliser ce modèle" crée le projet.
- Le design system choisi est rattaché au projet dès la création.

### Composants

- `app/dashboard/page.tsx` réécrit en `components/home/` : `CreatePrompt`, `DesignSystemPicker`, `ModelPicker`, `KindGrid`, `HomeTabs`, `ProjectList`, `ProjectGrid`, `ProjectCard`.
- Thème sombre par défaut accordé à la charte RodiumAi, clair disponible.
- Vignettes : capture Playwright à la sauvegarde (première slide, première étape, page d'accueil du design system), comme les vignettes actuelles des sites.

---

## 9. Changements par zone

**API (`apps/api`)**
- `app/kinds/` (registre) et remplacement des listes `web|mobile`.
- Schémas Pydantic `deck`, `slide`, `codelab`, `design_system` ; validation et réparation.
- Routes : `/projects/{id}/deck`, `/slides/{sid}` (GET, PUT, PATCH par élément), `/codelab`, `/steps/{sid}`, `/design-system`, `/images/search`, `/images/generate`, `/exports/{format}`.
- Orchestration : prompts et flux de génération pour `slides` et `codelab` (plan, rédaction, visuels), édition ciblée par cible.
- Exports : `services/export_pdf.py` (Playwright), `runtime/pptx.mjs` (pptxgenjs + post-traitement XML), export HTML autonome, ZIP de téléchargements du codelab.
- Publication : mode `deck_player` et `codelab_player` dans `publish_esm.py`.
- Banque d'images : client Pixabay (cache 24 h, téléchargement dans le projet), clé `PIXABAY_API_KEY` en configuration.
- Droits : colonnes, `ALTER` dans `db.py`, mapping `upsert_entitlements`.

**Web (`apps/web`)**
- `lib/kinds.ts`, galerie et création étendues (`PlatformToggle`, `TemplateGallery`, `create-project.ts`), filtres par type dans le tableau de bord.
- Éditeur de deck (section 5.5), éditeur de codelab (6.5), éditeur de design system (7).
- Paquets `deck-player` et `codelab-player` partagés avec la publication.
- Panneau image unifié (4.3).

**Runtime (`apps/api/runtime`)**
- Plugin Babel `data-forge-id` (4.2).
- Ajouts au manifeste si le lecteur tourne dans l'aperçu : Shiki (web bundle), TipTap côté éditeur seulement.

**Données (`data/templates`)**
- 36 modèles slides, 8 codelabs, 6 design systems de départ ; `EXPECTED_IDS` et tests mis à jour.

**Nest (`rodiumai_nestjs`)**
- Nouveaux droits dans les plans Forge et dans la synchro vers Forge.

**Gateway (`rodiumai_fastapi`)**
- Rien d'obligatoire. Vérifier que les modèles d'image exposés et le 402 en cas de solde insuffisant sont clairs.

---

## 10. Découpage en vagues et agents

Chaque agent travaille dans un worktree à partir de `dev`, avec ce document comme brief commun et les contrats de la vague 0 comme référence. Intégration sur une branche `feat/forge-design`, puis `dev`, puis `main`.

**Vague 0 : contrats et fondations (1 agent, séquentiel, 1 semaine)**
- Registre de types, schémas `deck` / `slide` / `codelab` / `design_system` (Pydantic + Zod générés depuis un JSON Schema unique), drapeaux par type, routes CRUD de base, panneau image unifié (libres + IA), endpoint de recherche d'images.
- Sortie : contrats figés, que toutes les vagues suivantes respectent.

**Vague 1 : en parallèle (5 agents, 2 à 3 semaines)**

| Agent | Périmètre | Dépend de |
|---|---|---|
| A. Lecteur de deck | `deck-player` : rendu, transitions, animations, morph, télécommandes, vue présentateur | Contrat deck |
| B. Éditeur de deck | Canevas, vignettes, texte modifiable, panneaux, notes, chat ciblé (UI) | Contrat deck, A pour le rendu |
| C. IA slides | Prompts, flux plan / rédaction / visuels, réparation, édition ciblée côté API | Contrat deck |
| D. Exports | PDF, PNG, PPTX (pptxgenjs + transitions), HTML autonome, publication lecteur | Contrat deck, A |
| E. Recherche de modèles | Liste de sources et licences, guide de style des 36 modèles, 6 premiers modèles de référence | Contrat deck |
| J. Accueil Forge Design | Page d'accueil (section 8 bis) : saisie, sélecteurs, grille des types, onglets Projets / Design systems / Modèles, liste et grille | Registre de types |

**Vague 2 : en parallèle (4 agents, 2 semaines)**

| Agent | Périmètre |
|---|---|
| F. Modèles slides | Les 30 modèles restants, vignettes, tests (2 agents de 15 si besoin) |
| G. Codelabs | Format, lecteur (Shiki, onglets, diff, terminal, téléchargements, ZIP), éditeur, IA, 8 modèles |
| H. Design system | Type, éditeur, import depuis un site, exports, rattachement, table en base |
| I. Édition ciblée sites | Plugin `data-forge-id`, cible dans le message, liste d'écriture autorisée |

**Vague 3 : intégration (1 à 2 agents, 1 semaine)**
- Droits Nest et Forge, tableau de bord par type, documentation, tests de bout en bout (Playwright) par type, test manuel avec une télécommande, revue de sécurité (upload de fichiers téléchargeables, recherche d'images, liens publiés).

Points de contrôle utilisateur : fin de vague 0 (contrats), démonstration du deck en fin de vague 1, démonstration codelab et design system en fin de vague 2, avant tout merge sur `main`.

---

## 11. Risques

| Risque | Parade |
|---|---|
| Fidélité PPTX (polices, effets) | Positions exactes grâce au format document ; polices de secours et avertissement ; effets rendus en image |
| Qualité des decks générés | Flux en trois temps, mises en page imposées par le kit, validation et réparation, modèle Sonnet pour la rédaction |
| Licences d'images et de modèles | Banques avec API et conditions respectées, crédits enregistrés, modèles créés par nous |
| Poids du lecteur et de Shiki | Chargement des langues à la demande, lecteur séparé de l'éditeur |
| Builder actuel monolithique (`page.tsx`, 3136 lignes) | Nouveaux éditeurs dans leurs propres routes et composants, pas dans `page.tsx` |
| Un seul worker API | Exports PDF / PPTX dans un processus enfant avec budget de temps, comme `prerender.py` |
| Production au merge sur `main` | Drapeaux par type, intégration sur `dev` |

## 12. Décisions

Prises le 2026-10-24 :
1. **Plans** : Free sans aucun export, présentation en direct avec badge "Made with Forge" ; exports débloqués progressivement à partir de Starter (section 8).
2. **Images libres** : Pixabay (clé fournie, testée), clé dans la configuration serveur.
3. **Formats de slides** : 16:9 par défaut, plus 4:3 et 1:1.
4. **Design system** : personnel et d'équipe.
5. **Interface** : accueil inspiré de Claude Design (section 8 bis).

6. **Exports** : PDF, PNG, Markdown et ZIP de codelab dès Starter ; HTML et PPTX dès Builder (tableau section 8).
7. **Formats** : 16:9 par défaut, 4:3 et 1:1.

Encore ouverte :
- Ordre de priorité si on doit couper : slides, puis codelabs, puis design system, puis édition ciblée des sites.
