import ftp from "basic-ftp";
import fs from "fs";
import path from "path";

const DEPLOY_DIR = path.resolve("_deploy");
const RUNVAUCLUSE_MARKERS = new Set(["_next", "itineraires", "explorer", "race", "resultats"]);
const SKIP_DIRS = new Set(["_next", "itineraires", "explorer", "race", "resultats", "images", "home", ".", ".."]);

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

async function listSafe(client, remotePath) {
  try {
    await client.cd(remotePath);
    return await client.list();
  } catch {
    return null;
  }
}

function summarize(items) {
  return items.map((i) => (i.isDirectory ? `${i.name}/` : i.name)).join(", ");
}

async function resolveTargetDir(client, explicitDir) {
  const rootItems = (await listSafe(client, "/")) || [];
  const rootNames = rootItems.map((i) => i.name);
  console.log("📁 Racine FTP (/) :", summarize(rootItems) || "(vide)");

  const isRunvaucluseRoot = rootNames.some((n) => RUNVAUCLUSE_MARKERS.has(n));
  const hasDomainsRoot = rootNames.includes("domains");

  // 1. Si le compte FTP est directement chrooté sur le dossier du sous-domaine (présence de default.php ou de nos fichiers 2027 à /)
  if (!isRunvaucluseRoot && !hasDomainsRoot) {
    if (rootNames.includes("default.php") || rootNames.includes("VENASQUE_2027_24K.gpx") || rootNames.length === 0) {
      console.log("🎯 Racine FTP dédiée détectée (/) — déploiement direct à la racine.");
      await client.cd("/");
      if (rootNames.includes("default.php")) {
        try {
          await client.remove("default.php");
          console.log("🗑️ Ancien default.php supprimé.");
        } catch {}
      }
      return;
    }
  }

  // 2. Construire la liste des dossiers candidats existants (sans jamais créer /home/...)
  const candidates = new Set([
    "/trail-de-venasque",
    "/trail-de-venasque.runvaucluse.fr",
    "/public_html",
    "/public_html/trail-de-venasque",
    "/domains/trail-de-venasque.runvaucluse.fr/public_html",
    "/domains/runvaucluse.fr/public_html/trail-de-venasque",
    "/domains/runvaucluse.fr/trail-de-venasque",
  ]);

  if (explicitDir && explicitDir.trim() !== "") {
    const cleaned = explicitDir
      .trim()
      .replace(/^\/+/, "")
      .replace(/^home\/[^/]+\//, "")
      .replace(/^domains\/runvaucluse\.fr\/public_html\//, "");
    if (cleaned && !cleaned.startsWith("home/")) {
      candidates.add("/" + cleaned);
    }
    const afterDomains = explicitDir.trim().replace(/^\/+/, "").replace(/^home\/[^/]+\//, "");
    if (afterDomains && !afterDomains.startsWith("home/")) {
      candidates.add("/" + afterDomains);
    }
  }

  // Explorer les sous-dossiers non-Next.js à /, /domains, /domains/runvaucluse.fr, /domains/runvaucluse.fr/public_html
  for (const base of ["/", "/domains", "/domains/runvaucluse.fr", "/domains/runvaucluse.fr/public_html"]) {
    const items = await listSafe(client, base);
    if (!items) continue;
    if (base !== "/") {
      console.log(`📁 ${base} :`, summarize(items) || "(vide)");
    }
    for (const item of items) {
      if (item.isDirectory && !SKIP_DIRS.has(item.name)) {
        const full = base === "/" ? `/${item.name}` : `${base}/${item.name}`;
        candidates.add(full);
        if (item.name.toLowerCase().includes("venasqu") || item.name === "domains" || item.name === "runvaucluse.fr" || item.name === "public_html") {
          const sub = await listSafe(client, full);
          if (sub) {
            console.log(`📁 ${full} :`, summarize(sub) || "(vide)");
            for (const s of sub) {
              if (s.isDirectory && !SKIP_DIRS.has(s.name)) {
                candidates.add(`${full}/${s.name}`);
              }
            }
          }
        }
      }
    }
  }

  let fallbackExisting = null;
  for (const dir of candidates) {
    const items = await listSafe(client, dir);
    if (!items) continue;
    const names = items.map((i) => i.name);
    if (names.some((n) => RUNVAUCLUSE_MARKERS.has(n))) continue;

    if (names.includes("default.php") || names.includes("VENASQUE_2027_24K.gpx")) {
      console.log(`🎯 Dossier du sous-domaine identifié : ${dir}`);
      if (names.includes("default.php")) {
        try {
          await client.remove("default.php");
          console.log("🗑️ Ancien default.php supprimé.");
        } catch {}
      }
      return;
    }

    if (!fallbackExisting && dir.toLowerCase().includes("venasqu") && !dir.startsWith("/home")) {
      fallbackExisting = dir;
    }
  }

  if (fallbackExisting) {
    console.log(`🎯 Dossier du sous-domaine trouvé : ${fallbackExisting}`);
    await client.cd(fallbackExisting);
    return;
  }

  throw new Error(
    "Impossible de localiser le dossier du sous-domaine trail-de-venasque sur le serveur FTP. Vérifiez les dossiers affichés ci-dessus dans le log."
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
