# Liberati

Une boîte privée de souvenirs — des photos, des voix, des phrases — qu'on
ouvre quand quelqu'un nous manque et qu'on ne peut pas l'appeler.

**Le nom** : *Liberati*, le nom de jeune fille d'une mère. Ce n'est pas un
titre, c'est une signature.

---

## L'idée

Quand l'appel est impossible — décalage horaire, réseau, l'autre qui
travaille — il ne reste que la galerie photo : on fait défiler, on regarde,
on referme. Le souvenir est là, mais il ne se *touche* pas.

Liberati part d'un principe unique : **toucher, pas consulter.**

## Les gestes

| Geste | Le souvenir | Ce qui se passe |
|---|---|---|
| La caresse | Photo | Le doigt reste posé, la photo s'éveille — un souffle, une lumière chaude |
| La pression | Vocal | On presse, la voix parle ; on relâche, ça s'arrête au milieu d'un mot |
| La révélation | Phrase | Les mots apparaissent un à un, au rythme de la lenteur de la main |
| Le seuil | L'arrivée | Aucun menu. Un écran sombre, une ligne : *« Tu es là. »* |
| Le souffle | La pause | Le doigt reste posé sans rien choisir : l'app reste avec vous |
| L'empreinte | Le dépôt | On fait entrer le souvenir dans la boîte — un poids, une résistance |

## La règle derrière les gestes

Toute décision d'interface se tranche contre cette liste :

1. **Rien ne compte.** Aucun compteur, aucun badge.
2. **Rien ne va vite.** Aucune animation qui file.
3. **Rien ne quitte l'écran brusquement.**
4. **Rien ne pose de question.**
5. **Rien n'entre dans la boîte sans la main.**

## Ce prototype

C'est le prototype des gestes : un écran, une boîte, trois souvenirs. Il
sert à vérifier une seule chose — que le geste donne ce qu'on imaginait.

- **Les données sont inventées.** `app.js` contient un jeu de démonstration.
- **Rien n'est encore chiffré, ni serveur.** Ce prototype fonctionne en local.
- **Il ne quitte pas le navigateur.** Aucune donnée n'est envoyée nulle part.

### Le voir tourner

Ouvrir `index.html` dans un navigateur. Ou, publié sur GitHub Pages :
**Settings → Pages → Deploy from a branch → `main` / `root`**.

Appuyez sur `r` pour voir la forme du reçu de dépôt (*« C'est gardé. »*).

## ⚠️ Le code est public. Les souvenirs ne le sont jamais.

C'est la règle du projet, et elle est écrite dans `.gitignore`.

- **Aucun fichier réel dans ce dépôt** — ni photo de famille, ni vocal, ni
  texte personnel. Seulement des données de démonstration.
- **Un fichier poussé une fois reste dans l'historique Git**, même après
  suppression. Ce n'est pas réparable.
- **Les captures d'écran aussi** : uniquement avec des données inventées.

Que le code soit ouvert est une force : n'importe qui peut vérifier qu'il
n'y a pas de mouchard. Ce que ça ne dit pas, c'est quoi que ce soit sur les
souvenirs de qui que ce soit.

## Et ensuite

1. Chiffrer, côté client, avant tout envoi.
2. Un serveur qui ne voit que du chiffrement — jamais le contenu.
3. L'export `.zip` chiffré : le filet de sécurité, pas un confort.
4. Le partage système vers `index.html`, avec le reçu de deux secondes.

## Licence

MIT — voir [LICENSE](LICENSE).
