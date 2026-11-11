import ftp from "basic-ftp";
import fs from "fs";
import path from "path";

const DEPLOY_DIR = path.resolve("_deploy");

function parseBool(val, defaultVal = false) {
  if (val === undefined || val === "") return defaultVal;
  return String(val).toLowerCase() === "true";
}

async function connectFtp(client, host, port, user, password, secure) {
  await client.access({
    host,
    port,
    user,
    password,
    secure,
    secureOptions: { rejectUnauthorized: false },
  });
}

async function resolveTargetDir(client, explicitDir) {
  if (explicitDir && explicitDir.trim() !== "") {
    const cleanDir = explicitDir.trim();
    console.log(`📁 Dossier cible explicite : ${cleanDir}`);
    await client.ensureDir(cleanDir);
    return;
  }

  const rootItems = await client.list();
  const names = rootItems.map((i) => i.name);
  console.log("📁 Contenu initial à la racine FTP :", names.join(", ") || "(vide)");

  if (names.includes("domains")) {
    const target = "domains/runvaucluse.fr/public_html/trail-de-venasque";
    console.log(`🎯 Compte principal détecté → ciblage automatique : ${target}`);
    await client.ensureDir(target);
    return;
  }

  if (names.includes("_next") || names.includes("itineraires")) {
    const target = "trail-de-venasque";
    console.log(`🎯 Racine runvaucluse.fr détectée → ciblage du sous-dossier : ${target}`);
    await client.ensureDir(target);
    return;
  }

  if (
    names.length === 0 ||
    names.every((n) => n === "." || n === ".." || n.toLowerCase() === "default.php" || n.toLowerCase() === ".htaccess") ||
    names.includes("VENASQUE_2027_24K.gpx")
  ) {
    console.log("🎯 Dossier dédié du sous-domaine détecté (racine FTP directe).");
    if (names.some((n) => n.toLowerCase() === "default.php")) {
      try {
        await client.remove("default.php");
        console.log("🗑️ Ancien default.php supprimé.");
      } catch {}
    }
    return;
  }

  throw new Error(
    `Sécurité : racine FTP non vide et non reconnue (${names.join(", ")}). ` +
      "Définissez le secret HOSTINGER_FTP_DIR pour indiquer le dossier exact du sous-domaine."
  );
}

async function main() {
  const host = (process.env.HOSTINGER_FTP_HOST || "").replace(/^ftps?:\/\//i, "").replace(/\/.*$/, "").trim();
  const user = (process.env.HOSTINGER_FTP_USER || "").trim();
  const password = (process.env.HOSTINGER_FTP_PASSWORD || "").trim();
  const port = parseInt(process.env.HOSTINGER_FTP_PORT || "21", 10);
  const explicitDir = process.env.HOSTINGER_FTP_DIR || "";
  const preferSecure = parseBool(process.env.HOSTINGER_FTP_SECURE, false);

  if (!host || !user || !password) {
    throw new Error(
      "Identifiants FTP manquants : configurez HOSTINGER_FTP_HOST, HOSTINGER_FTP_USER et HOSTINGER_FTP_PASSWORD dans les secrets GitHub."
    );
  }
  if (!fs.existsSync(DEPLOY_DIR)) {
    throw new Error(`Dossier introuvable : ${DEPLOY_DIR}`);
  }

  const client = new ftp.Client(30000);
  client.ftp.verbose = true;

  try {
    console.log(`🚀 Connexion FTP à ${host}:${port}...`);
    try {
      await connectFtp(client, host, port, user, password, preferSecure);
    } catch (err) {
      console.warn(`⚠️ Connexion (secure=${preferSecure}) échouée (${err.message}), nouvel essai avec secure=${!preferSecure}...`);
      await connectFtp(client, host, port, user, password, !preferSecure);
    }

    await resolveTargetDir(client, explicitDir);
    console.log("📤 Envoi des fichiers du site Trail de Venasque 2027...");
    await client.uploadFromDir(DEPLOY_DIR);
    console.log("✅ Déploiement FTP réussi sur https://trail-de-venasque.runvaucluse.fr/ !");
  } finally {
    client.close();
  }
}

main().catch((err) => {
  console.error("❌ Échec du déploiement FTP :", err.message);
  process.exit(1);
});
