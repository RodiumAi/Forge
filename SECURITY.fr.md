> 🇬🇧 [English version](SECURITY.md)

# Politique de sécurité

## Versions supportées

Seule la branche principale est supportée. Les correctifs de sécurité y arrivent en premier.

## Signaler une vulnérabilité

Signalez les vulnérabilités **en privé**. Choisissez le canal que vous pouvez utiliser :

1. **GitHub Security Advisory (à privilégier)** — [**Report a vulnerability**](https://github.com/RodiumAi/Forge/security/advisories/new) dans l'onglet *Security* du dépôt.
2. **E-mail** — **forge@rodiumai.io**, si vous ne pouvez pas utiliser GitHub.

Des contacts lisibles par machine sont aussi publiés sur
[`/.well-known/security.txt`](https://forge.rodiumai.io/.well-known/security.txt) (RFC 9116).

Merci de :

- Ne **pas** ouvrir d'issue publique pour un problème de sécurité.
- Ne pas divulguer la vulnérabilité publiquement avant la publication d'un correctif.
- Fournir assez de détails pour reproduire (version/commit concerné, étapes, impact, et une preuve de concept si possible).

### Périmètre & bonne foi

Testez sur **votre propre stack locale** (`docker compose up`) ou un site que vous avez
publié vous-même — **jamais** contre `rodiumai.io` ou ses sous-domaines sans autorisation
écrite préalable (à demander à forge@rodiumai.io). Aucun bug bounty n'est proposé. Les
tests intrusifs (DoS, brute force, ingénierie sociale) et l'accès à des données qui ne
sont pas les vôtres ne sont jamais dans le périmètre. Voir
[CONTRIBUTING.fr.md → Cybersécurité](CONTRIBUTING.fr.md#cybersécurité).

### À quoi s'attendre

- **Accusé de réception :** sous 5 jours ouvrés.
- Nous investiguons, préparons un correctif et coordonnons le calendrier de divulgation avec vous.
- Nous créditons les rapporteurs qui le souhaitent une fois le correctif publié (une
  recherche menée de bonne foi dans le périmètre ci-dessus n'entraînera aucune poursuite).
