# Trail de Venasque 2027 — Site Officiel

Site statique officiel du **Trail de Venasque** (Dimanche 7 Mars 2027), prévu pour `https://trail-de-venasque.runvaucluse.fr/`.

## Mise en ligne automatique (GitHub Actions → Hostinger)

1. **Dans Hostinger (hPanel)** :
   - Créez le sous-domaine `trail-de-venasque` sous `runvaucluse.fr` (`Hébergement → Domaines → Sous-domaines`).
   - Dossier par défaut : `domains/runvaucluse.fr/public_html/trail-de-venasque` (ou renseignez un dossier personnalisé dans le secret `HOSTINGER_REMOTE_DIR`).
2. **Sur GitHub (`seazeau/trail-venasque`)** :
   - Créez le dépôt vide `trail-venasque` sur votre compte GitHub `seazeau`.
   - Dans **Settings → Secrets and variables → Actions**, ajoutez le secret `HOSTINGER_SSH_KEY` (le même que pour `runvaucluse`), et optionnellement `HOSTINGER_REMOTE_DIR` si vous avez choisi un dossier personnalisé hors de `public_html`.
3. **Pousser le code** :
   ```bash
   git push -u origin main
   ```

Chaque `git push` sur `main` déploiera automatiquement le site sur Hostinger.
