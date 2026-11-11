# Trail de Venasque 2027 — Site Officiel

Site statique officiel du **Trail de Venasque** (Dimanche 7 Mars 2027), prévu pour `https://trail-de-venasque.runvaucluse.fr/`.

## Mise en ligne automatique (GitHub Actions → Hostinger FTP)

1. **Dans Hostinger (hPanel)** :
   - Créez le sous-domaine `trail-de-venasque` sous `runvaucluse.fr` (`Hébergement → Domaines → Sous-domaines`).
   - Récupérez vos identifiants dans **Fichiers → Comptes FTP** (ou créez un compte FTP pointant directement vers le dossier du sous-domaine).
2. **Sur GitHub (`seazeau/trail-venasque`)** :
   - Dans **Settings → Secrets and variables → Actions**, ajoutez ces 3 secrets :
     - `HOSTINGER_FTP_HOST` (ex. `ftp.runvaucluse.fr` ou l'IP FTP affichée dans hPanel, ex. `89.117.169.57`)
     - `HOSTINGER_FTP_USER` (ex. `u488549652` ou l'utilisateur FTP du sous-domaine)
     - `HOSTINGER_FTP_PASSWORD` (votre mot de passe FTP Hostinger)
   - Optionnel : `HOSTINGER_FTP_DIR` si vous utilisez un dossier personnalisé non standard.
3. **Pousser le code** :
   ```bash
   git push -u origin main
   ```

Chaque `git push` sur `main` déploiera automatiquement le site sur Hostinger.
