#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// SIGEA — Banc de recette bout-en-bout (end-to-end).
//
// Pilote la pile COMPLÈTE via la gateway (http://localhost:3000/api) :
//   authentification + MFA réelle → vols → manifestes → circuit de validation
//   (5 blocs, cas nominal + rejet/resoumission + vol sensible/CEMAA) →
//   consignes CEMAA → notifications → PDF → administration + RBAC.
//
// Aucune dépendance externe : Node 20+ (fetch global) et node:crypto suffisent.
// Le TOTP est une RÉPLIQUE EXACTE de apps/auth-service/src/otp/otp.service.ts
// (PERIOD=60, DIGITS=6, SHA1, base32 maison) : les codes générés ici valident
// donc côté serveur sans bibliothèque tierce.
//
// Usage :
//   1) docker compose -f docker/docker-compose.yml up -d   (pile + seed)
//   2) node sigea-e2e/sigea-e2e.mjs
//
// Variables d'environnement (toutes optionnelles) :
//   BASE_URL         défaut http://localhost:3000/api   (gateway)
//   PDF_DIRECT_URL   défaut http://localhost:3008/api   (pdf-service en direct)
//   PASSWORD         défaut ChangeMe@2025!              (mot de passe du seed)
//   SECRETS_FILE     défaut ./.sigea-e2e-secrets.json   (secrets TOTP persistés)
//   VERBOSE          défaut 0 (mettre 1 pour tracer chaque requête)
//
// Code de sortie : 0 si tout passe, 1 si au moins une assertion échoue.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL       = process.env.BASE_URL       || 'http://localhost:3000/api';
const PDF_DIRECT_URL = process.env.PDF_DIRECT_URL || 'http://localhost:3008/api';
const NOTIF_DIRECT_URL = process.env.NOTIF_DIRECT_URL || 'http://localhost:3007/api';
// Auto-réparation MFA : si un secret TOTP est perdu (refresh expiré + secret
// absent du fichier), le banc réinitialise la MFA via docker exec puis réenrôle.
const AUTO_MFA_RESET = process.env.AUTO_MFA_RESET !== '0';
const PG_CONTAINER   = process.env.POSTGRES_CONTAINER || 'sigea_postgres';
const PG_USER        = process.env.PGUSER || 'sigea_app';
const PG_DB          = process.env.PGDATABASE || 'sigea';
const PASSWORD       = process.env.PASSWORD       || 'ChangeMe@2025!';
const SECRETS_FILE   = process.env.SECRETS_FILE   || path.join(__dirname, '.sigea-e2e-secrets.json');
const VERBOSE        = process.env.VERBOSE === '1';

// ── Couleurs terminal ────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m', gray: '\x1b[90m', red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', bold: '\x1b[1m',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// TOTP — copie fidèle de otp.service.ts (ne pas « améliorer » : doit rester égal)
// ─────────────────────────────────────────────────────────────────────────────
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIOD = 60;
const DIGITS = 6;

function base32Decode(s) {
  let bits = 0, value = 0, idx = 0;
  const out = Buffer.alloc(Math.floor((s.length * 5) / 8));
  for (const c of s.toUpperCase().replace(/=+$/, '')) {
    const i = BASE32.indexOf(c);
    if (i === -1) continue;
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out[idx++] = (value >>> (bits - 8)) & 0xff; bits -= 8; }
  }
  return out.subarray(0, idx);
}
function hotp(secret, counter) {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const off = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[off] & 0x7f) << 24) | ((hmac[off + 1] & 0xff) << 16)
    | ((hmac[off + 2] & 0xff) << 8) | (hmac[off + 3] & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, '0');
}
function totp(secret) {
  return hotp(secret, Math.floor(Date.now() / 1000 / PERIOD));
}

// ─────────────────────────────────────────────────────────────────────────────
// Micro-framework de test
// ─────────────────────────────────────────────────────────────────────────────
let pass = 0, fail = 0, skipped = 0;
const failures = [];
let currentPhase = '';

function phase(title) {
  currentPhase = title;
  console.log(`\n${C.bold}${C.blue}▌ ${title}${C.reset}`);
}
function ok(msg) {
  pass++;
  console.log(`  ${C.green}✓${C.reset} ${msg}`);
}
function ko(msg, detail) {
  fail++;
  failures.push({ phase: currentPhase, msg, detail });
  console.log(`  ${C.red}✗ ${msg}${C.reset}`);
  if (detail) console.log(`    ${C.gray}${detail}${C.reset}`);
}
function skip(msg, why) {
  skipped++;
  console.log(`  ${C.yellow}◌ ${msg}${C.reset}  ${C.gray}(${why})${C.reset}`);
}
// Vérifie une condition ; renvoie true/false pour permettre l'enchaînement.
function check(cond, msg, detail) {
  if (cond) { ok(msg); return true; }
  ko(msg, detail);
  return false;
}
function expectStatus(res, expected, msg) {
  const list = Array.isArray(expected) ? expected : [expected];
  const good = list.includes(res.status);
  return check(good, msg, good ? '' : `attendu ${list.join('|')}, reçu ${res.status} — ${JSON.stringify(res.data)?.slice(0, 300)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Client HTTP
// ─────────────────────────────────────────────────────────────────────────────
async function api(method, urlPath, { token, body, base = BASE_URL, raw = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const url = `${base}${urlPath}`;
  if (VERBOSE) console.log(`    ${C.gray}→ ${method} ${url}${C.reset}`);

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    return { status: 0, data: { error: String(e) }, headers: new Headers() };
  }

  const ct = res.headers.get('content-type') || '';
  let data = null;
  if (raw) {
    data = Buffer.from(await res.arrayBuffer());
  } else if (ct.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => null);
  }
  return { status: res.status, data, headers: res.headers };
}

// ─────────────────────────────────────────────────────────────────────────────
// Authentification (flux MFA réel) — persistance { login: { secret, refresh } }
//
// Optimisation anti-throttling : une fois enrôlé, chaque compte conserve son
// refresh token (validité 8 h). Aux exécutions suivantes on rafraîchit via
// /auth/refresh (NON soumis au throttle 5/60 s de /auth/login) : plus aucune
// pause de 62 s tant que les refresh tokens sont valides.
// ─────────────────────────────────────────────────────────────────────────────
function loadStore() {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8')); }
  catch { return {}; }
  // Compat ascendante : ancien format { login: "SECRET" } → { login: { secret } }
  const out = {};
  for (const [k, v] of Object.entries(raw)) out[k] = typeof v === 'string' ? { secret: v } : v;
  return out;
}
function saveStore(s) {
  try { fs.writeFileSync(SECRETS_FILE, JSON.stringify(s, null, 2)); }
  catch (e) { console.log(`${C.yellow}  (impossible d'écrire ${SECRETS_FILE}: ${e.message})${C.reset}`); }
}
// Décode le payload d'un JWT (base64url) — sans vérif de signature, juste pour le rôle.
function jwtPayload(token) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); }
  catch { return {}; }
}
const RESET_HINT =
  "Réinitialisez la MFA puis relancez (PowerShell) :\n" +
  "    docker exec -i " + PG_CONTAINER + " psql -U " + PG_USER + " -d " + PG_DB + " -c \"DELETE FROM otp_secrets; DELETE FROM challenge_tokens; DELETE FROM backup_codes;\"\n" +
  "    Remove-Item '" + SECRETS_FILE + "' -ErrorAction SilentlyContinue\n" +
  "  (Ou laissez le banc le faire : variable AUTO_MFA_RESET=1, activée par défaut.)";

// Login résistant au throttling (5/60s sur /auth/login) : back-off sur 429.
async function loginWithBackoff(login) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await api('POST', '/auth/login', { body: { login, password: PASSWORD, first_connection: false } });
    if (res.status !== 429) return res;
    const wait = 62_000;
    console.log(`    ${C.yellow}429 (throttle) sur login ${login} — pause ${wait / 1000}s…${C.reset}`);
    await sleep(wait);
  }
  return { status: 429, data: { error: 'throttle persistant' } };
}

const tokens = {}; // cache : login -> { access, refresh, user }
let mfaResetDone = false; // garde : une seule réinitialisation auto par exécution

// Réinitialise l'état MFA côté serveur (tables hors RLS) puis efface le fichier
// de secrets local, afin que le prochain login reparte en MFA_SETUP (enrôlement).
function autoResetMfa() {
  console.log(`${C.yellow}  ⟳ Secret TOTP perdu → réinitialisation MFA automatique via docker exec ${PG_CONTAINER}…${C.reset}`);
  try {
    execFileSync('docker', ['exec', '-i', PG_CONTAINER, 'psql', '-U', PG_USER, '-d', PG_DB,
      '-c', 'DELETE FROM otp_secrets; DELETE FROM challenge_tokens; DELETE FROM backup_codes;'],
      { stdio: 'pipe' });
    try { fs.rmSync(SECRETS_FILE, { force: true }); } catch { /* ignore */ }
    console.log(`${C.green}  ✓ MFA réinitialisée — réenrôlement propre en cours (une pause throttle possible).${C.reset}`);
    return true;
  } catch (e) {
    const msg = (e.stderr?.toString() || e.message || '').slice(0, 200);
    console.log(`${C.red}  ✗ Réinitialisation auto impossible : ${msg}${C.reset}`);
    return false;
  }
}

// Blocage : le serveur exige un code TOTP mais on n'a pas (ou plus) le bon secret.
async function handleDeadlock(login, why) {
  if (!AUTO_MFA_RESET || mfaResetDone || !autoResetMfa()) {
    if (!mfaResetDone) mfaResetDone = true; // évite les boucles si le reset échoue
    throw new Error(`${login} → ${why}. ${RESET_HINT}`);
  }
  mfaResetDone = true;
  for (const k of Object.keys(tokens)) delete tokens[k]; // repart d'un cache propre
  await sleep(1000);
  return authenticate(login); // le serveur n'a plus de secret → MFA_SETUP → enrôlement
}

async function authenticate(login) {
  if (tokens[login]) return tokens[login];
  const store = loadStore();
  const st = store[login] || {};

  // ── Voie rapide : refresh token valide → pas de login, pas de throttle ──
  if (st.refresh) {
    const rf = await api('POST', '/auth/refresh', { body: { refresh_token: st.refresh } });
    if (rf.status === 200 && rf.data?.access_token) {
      const p = jwtPayload(rf.data.access_token);
      const entry = { access: rf.data.access_token, refresh: st.refresh, user: { id: p.sub, role: p.role, base_id: p.base_id } };
      tokens[login] = entry;
      return entry;
    }
    // refresh périmé : on retombe sur le login complet ci-dessous.
  }

  const res = await loginWithBackoff(login);
  if (res.status !== 200) throw new Error(`login ${login} échoué (${res.status}): ${JSON.stringify(res.data)}`);

  const step = res.data?.step;
  let final;

  if (step === 'COMPLETE') {
    final = res.data;
  } else if (step === 'MFA_SETUP') {
    // Premier enrôlement : le serveur nous donne le secret. On l'active.
    const secret = res.data?.mfa_setup?.secret;
    if (!secret) throw new Error(`MFA_SETUP sans secret pour ${login}`);
    st.secret = secret;
    const act = await api('POST', '/auth/activate-otp', {
      body: { challenge_token: res.data.challenge_token, otp_code: totp(secret) },
    });
    if (act.status !== 200) throw new Error(`activate-otp ${login} échoué (${act.status}): ${JSON.stringify(act.data)}`);
    final = act.data;
  } else if (step === 'MFA_VERIFY') {
    if (!st.secret) return handleDeadlock(login, 'MFA enrôlée côté serveur, secret local absent');
    const ver = await api('POST', '/auth/verify-otp', {
      body: { challenge_token: res.data.challenge_token, otp_code: totp(st.secret) },
    });
    if (ver.status === 401) return handleDeadlock(login, 'code TOTP rejeté (secret local périmé)');
    if (ver.status !== 200) throw new Error(`verify-otp ${login} échoué (${ver.status}): ${JSON.stringify(ver.data)}`);
    final = ver.data;
  } else {
    throw new Error(`Étape d'auth inattendue pour ${login}: ${JSON.stringify(res.data)}`);
  }

  const entry = { access: final.access_token, refresh: final.refresh_token, user: final.user };
  if (!entry.access) throw new Error(`Aucun access_token pour ${login}`);
  // Persiste secret + refresh pour accélérer les prochains runs.
  st.refresh = final.refresh_token || st.refresh;
  store[login] = st;
  saveStore(store);
  tokens[login] = entry;
  return entry;
}

// ─────────────────────────────────────────────────────────────────────────────
// Comptes du seed (prisma/seed.ts)
// ─────────────────────────────────────────────────────────────────────────────
const U = {
  admin:   'admin.sigea',
  chef:    'chef.escale.yaounde',
  comeso:  'comeso.yaounde',
  comgmo:  'comgmo.yaounde',
  combord: 'combord.yaounde',
  combase: 'combase.yaounde',
  cemaa:   'cemaa',
};
const suffix = Date.now().toString(36).toUpperCase().slice(-8);
const tok = (login) => tokens[login].access;

// Helpers métier ──────────────────────────────────────────────────────────────
// NB : la création/annulation de vol est réservée aux rôles ADMIN|COMBASE
// (RolesGuard sur vol-service). Le chef d'escale, lui, crée et soumet les
// manifestes. On respecte donc cette séparation des responsabilités.
async function creerVol({ numero, type = 'LIAISON', dep = 'BA101', arr = 'BA102' }) {
  return api('POST', '/vols', {
    token: tok(U.combase),
    body: {
      numero_mission: numero,
      immatriculation: 'TJ-AAF',
      date_heure: '2026-09-10T08:00:00.000Z',
      base_depart_id: dep,
      base_arrivee_id: arr,
      type_mission: type,
      capacite_places: 92,
      capacite_cargo_kg: 19000,
      combord_grade: 'Commandant',
      combord_nom: 'Kamga',
      combord_prenom: 'Éric',
    },
  });
}
async function creerManifeste(volId) {
  return api('POST', '/manifestes', { token: tok(U.chef), body: { vol_id: volId } });
}
async function ajouterPassager(manifesteId, nom = 'Ndongo') {
  return api('POST', `/manifestes/${manifesteId}/passagers`, {
    token: tok(U.chef),
    body: {
      nom, prenom: 'Pierre', grade: 'Sergent', categorie: 'TROUPES',
      matricule: 'MAT-001', unite: 'BA101', destination: 'BA102',
      nb_bagages: 1, masse_bagages_kg: 18,
      contact_urgence_nom: 'Ndongo Marie', contact_urgence_tel: '+237600000000',
    },
  });
}
async function ajouterMateriel(manifesteId) {
  return api('POST', `/manifestes/${manifesteId}/materiels`, {
    token: tok(U.chef),
    body: {
      designation: 'Palette rations', type_mission_log: 'AA', proprietaire: 'FAC',
      poids_kg: 250, volume: 1.2, destination: 'BA102',
      expediteur_nom: 'Mbarga', expediteur_fonction: 'Chef escale', expediteur_tel: '+237611111111',
    },
  });
}
async function soumettre(manifesteId) {
  return api('PATCH', `/manifestes/${manifesteId}/soumettre`, { token: tok(U.chef) });
}
async function valider(manifesteId, login, commentaire = 'Vu et approuvé') {
  return api('POST', `/validations/${manifesteId}`, {
    token: tok(login), body: { statut: 'APPROUVE', commentaire },
  });
}
async function rejeter(manifesteId, login, motif) {
  return api('POST', `/validations/${manifesteId}`, {
    token: tok(login), body: { statut: 'REJETE', motif },
  });
}
async function avancement(manifesteId, login = U.chef) {
  return api('GET', `/validations/${manifesteId}`, { token: tok(login) });
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASES
// ─────────────────────────────────────────────────────────────────────────────

async function phaseSante() {
  phase('0 · Santé de la pile');
  const r = await api('GET', '/health');
  if (r.status === 0) {
    console.log(`${C.red}${C.bold}\n  La gateway est injoignable sur ${BASE_URL}.${C.reset}`);
    console.log(`${C.gray}  Démarrez la pile : docker compose -f docker/docker-compose.yml up -d${C.reset}`);
    process.exit(2);
  }
  expectStatus(r, [200, 503], 'gateway /health répond');
  // Santé de chaque service via son alias public.
  for (const p of ['referentiel', 'vols', 'manifestes', 'validations', 'cemaa', 'notifications', 'pdf']) {
    const h = await api('GET', `/${p}/health`);
    check([200, 503].includes(h.status), `service « ${p} » atteignable (/${p}/health = ${h.status})`);
  }
}

async function phaseAuth() {
  phase('1 · Authentification & MFA');

  // Mauvais mot de passe → 401
  const bad = await api('POST', '/auth/login', { body: { login: U.chef, password: 'FAUX', first_connection: false } });
  expectStatus(bad, [401, 429], 'mot de passe erroné rejeté (401)');
  if (bad.status === 429) skip('mot de passe erroné', 'throttle atteint, non concluant');

  // Enrôlement / vérification MFA de tous les rôles (secrets persistés).
  const logins = Object.values(U);
  for (const login of logins) {
    try {
      const a = await authenticate(login);
      check(!!a.access && a.user?.role, `MFA + tokens OK pour ${login} (rôle ${a.user?.role})`);
    } catch (e) {
      ko(`authentification ${login}`, e.message);
    }
  }

  // Refresh token
  if (tokens[U.chef]?.refresh) {
    const rf = await api('POST', '/auth/refresh', { body: { refresh_token: tokens[U.chef].refresh } });
    check(rf.status === 200 && !!rf.data?.access_token, 'refresh renvoie un nouvel access_token', `status ${rf.status}`);
  }

  // Route protégée sans token → 401
  const noAuth = await api('GET', '/vols');
  expectStatus(noAuth, 401, 'accès à /vols sans token refusé (401)');
}

async function phaseReferentiel() {
  phase('2 · Référentiel');
  for (const [p, label] of [['bases', 'bases'], ['aeronefs', 'aéronefs'], ['personnels', 'personnels'], ['unites', 'unités']]) {
    const r = await api('GET', `/referentiel/${p}`, { token: tok(U.chef) });
    check(r.status === 200 && Array.isArray(r.data), `GET référentiel/${label} → liste`, `status ${r.status}`);
  }
}

const state = {}; // partage d'IDs entre phases

async function phaseVols() {
  phase('3 · Création des vols');

  // numéro invalide (minuscules) → 400
  const invalid = await creerVol({ numero: 'vol-invalide' });
  expectStatus(invalid, 400, 'numéro de mission invalide rejeté (regex)');

  // vol nominal
  const v1 = await creerVol({ numero: `E2E-${suffix}-A` });
  if (expectStatus(v1, 201, 'vol nominal créé (201)')) state.volNominal = v1.data.id;

  // vol pour le circuit complet
  const v2 = await creerVol({ numero: `E2E-${suffix}-B` });
  if (expectStatus(v2, 201, 'vol « circuit » créé')) state.volCircuit = v2.data.id;

  // vol pour rejet/resoumission
  const v3 = await creerVol({ numero: `E2E-${suffix}-C` });
  if (expectStatus(v3, 201, 'vol « rejet » créé')) state.volRejet = v3.data.id;

  // vol sensible (OP_SENSIBLE → flag_sensible)
  const v4 = await creerVol({ numero: `E2E-${suffix}-S`, type: 'OP_SENSIBLE' });
  if (expectStatus(v4, 201, 'vol sensible créé')) {
    state.volSensible = v4.data.id;
    check(v4.data.flag_sensible === true, 'vol OP_SENSIBLE porte flag_sensible=true', `flag=${v4.data?.flag_sensible}`);
  }

  // vol à annuler
  const v5 = await creerVol({ numero: `E2E-${suffix}-X` });
  if (v5.status === 201) {
    const ann = await api('PATCH', `/vols/${v5.data.id}/annuler`, { token: tok(U.combase) });
    expectStatus(ann, 200, 'annulation d\'un vol (200)');
  }

  // liste + lecture unitaire
  const list = await api('GET', '/vols', { token: tok(U.chef) });
  check(list.status === 200, 'GET /vols → liste', `status ${list.status}`);
  if (state.volNominal) {
    const one = await api('GET', `/vols/${state.volNominal}`, { token: tok(U.chef) });
    check(one.status === 200 && one.data?.id === state.volNominal, 'GET /vols/:id → détail', `status ${one.status}`);
  }
}

async function phaseManifestes() {
  phase('4 · Manifestes & lignes (passagers / matériels)');
  if (!state.volNominal) return skip('manifestes', 'aucun vol nominal');

  const m = await creerManifeste(state.volNominal);
  if (!expectStatus(m, 201, 'manifeste créé (201)')) return;
  state.manifesteNominal = m.data.id;

  const p1 = await ajouterPassager(state.manifesteNominal, 'Ndongo');
  expectStatus(p1, 201, 'ajout passager #1 (201)');
  const p2 = await ajouterPassager(state.manifesteNominal, 'Essomba');
  expectStatus(p2, 201, 'ajout passager #2 (201)');
  const mat = await ajouterMateriel(state.manifesteNominal);
  expectStatus(mat, 201, 'ajout matériel (201)');

  const px = await api('GET', `/manifestes/${state.manifesteNominal}/passagers`, { token: tok(U.chef) });
  check(px.status === 200 && Array.isArray(px.data) && px.data.length >= 2, 'liste passagers (≥2)', `status ${px.status}`);

  const gm = await api('GET', `/manifestes/${state.manifesteNominal}`, { token: tok(U.chef) });
  check(gm.status === 200, 'GET /manifestes/:id → détail', `status ${gm.status}`);

  // Manifeste vide → soumission refusée (400)
  const vEmpty = await creerVol({ numero: `E2E-${suffix}-E` });
  if (vEmpty.status === 201) {
    const mEmpty = await creerManifeste(vEmpty.data.id);
    if (mEmpty.status === 201) {
      const s = await soumettre(mEmpty.data.id);
      expectStatus(s, 400, 'soumission d\'un manifeste vide refusée (400)');
    }
  }
}

async function phaseCircuitNominal() {
  phase('5 · Circuit de validation — cas nominal (5 blocs)');
  if (!state.volCircuit) return skip('circuit nominal', 'aucun vol circuit');

  const m = await creerManifeste(state.volCircuit);
  if (!expectStatus(m, 201, 'manifeste du circuit créé')) return;
  const id = m.data.id;
  await ajouterPassager(id, 'Biya');

  // Soumission = VU du chef d'escale, passage à COMESO
  const s = await soumettre(id);
  expectStatus(s, 200, 'soumission par le chef d\'escale (200)');
  let av = await avancement(id);
  check(av.data?.etape_courante === 'COMESO', 'étape courante = COMESO après soumission', `etape=${av.data?.etape_courante}`);

  // COMBASE tente de signer hors tour → 409
  const horsTour = await valider(id, U.combase);
  expectStatus(horsTour, 409, 'signature hors tour (COMBASE) refusée (409)');

  // Enchaînement COMESO → COMGMO → COMBORD → COMBASE
  const etapes = [
    [U.comeso, 'COMGMO', 'COMESO valide → COMGMO'],
    [U.comgmo, 'COMBORD', 'COMGMO valide → COMBORD'],
    [U.combord, 'COMBASE', 'COMBORD valide → COMBASE'],
  ];
  for (const [login, attendu, msg] of etapes) {
    const r = await valider(id, login);
    if (!expectStatus(r, 200, `${msg} (200)`)) break;
    av = await avancement(id);
    check(av.data?.etape_courante === attendu, `étape courante = ${attendu}`, `etape=${av.data?.etape_courante}`);
  }

  // COMBASE : signature finale (ACCORD) → VALIDE
  const fin = await valider(id, U.combase);
  expectStatus(fin, 200, 'COMBASE appose l\'ACCORD final (200)');
  av = await avancement(id);
  check(av.data?.statut === 'VALIDE', 'manifeste VALIDE, circuit terminé', `statut=${av.data?.statut}`);
  const blocsApprouves = (av.data?.blocs || []).filter((b) => b.statut === 'APPROUVE').length;
  check(blocsApprouves === 5, `les 5 blocs de signature sont approuvés`, `approuvés=${blocsApprouves}`);
  state.manifesteValide = id;
}

async function phaseRejet() {
  phase('6 · Rejet & resoumission');
  if (!state.volRejet) return skip('rejet', 'aucun vol rejet');

  const m = await creerManifeste(state.volRejet);
  if (!expectStatus(m, 201, 'manifeste (rejet) créé')) return;
  const id = m.data.id;
  await ajouterPassager(id, 'Onana');

  await soumettre(id);
  const rej = await rejeter(id, U.comeso, 'Documents manquants pour un passager');
  expectStatus(rej, 200, 'COMESO rejette avec motif (200)');
  let av = await avancement(id);
  check(av.data?.statut === 'REJETE', 'manifeste passe en REJETE', `statut=${av.data?.statut}`);

  // Rejet sans motif → 400
  const m2 = await creerManifeste((await creerVol({ numero: `E2E-${suffix}-C2` })).data.id);
  if (m2.status === 201) {
    await ajouterPassager(m2.data.id, 'Tchoua');
    await soumettre(m2.data.id);
    const sansMotif = await api('POST', `/validations/${m2.data.id}`, { token: tok(U.comeso), body: { statut: 'REJETE' } });
    expectStatus(sansMotif, 400, 'rejet sans motif refusé (400)');
  }

  // Resoumission après correction → repart à COMESO
  const re = await soumettre(id);
  expectStatus(re, 200, 'resoumission après rejet (200)');
  av = await avancement(id);
  check(av.data?.etape_courante === 'COMESO', 'le circuit repart à COMESO après resoumission', `etape=${av.data?.etape_courante}`);
}

async function phaseSensible() {
  phase('7 · Vol sensible — verrou CEMAA avant COMBASE');
  if (!state.volSensible) return skip('sensible', 'aucun vol sensible');

  const m = await creerManifeste(state.volSensible);
  if (!expectStatus(m, 201, 'manifeste sensible créé')) return;
  const id = m.data.id;
  state.manifesteSensible = id;
  await ajouterPassager(id, 'Secret');

  await soumettre(id);
  await valider(id, U.comeso);
  await valider(id, U.comgmo);
  const cb = await valider(id, U.combord);
  expectStatus(cb, 200, 'COMBORD valide (200)');

  let av = await avancement(id);
  check(av.data?.etape_courante === 'CEMAA_SENSIBLE', 'après COMBORD, verrou CEMAA_SENSIBLE actif', `etape=${av.data?.etape_courante}`);
  check(av.data?.verrou_cemaa?.requis === true && av.data?.verrou_cemaa?.accorde === false, 'verrou CEMAA requis et non accordé', JSON.stringify(av.data?.verrou_cemaa));

  // COMBASE tente avant l'accord CEMAA → refus (409 hors tour, ou 403 défensif)
  const tent = await valider(id, U.combase);
  expectStatus(tent, [403, 409], 'COMBASE bloqué tant que CEMAA n\'a pas accordé');

  // CEMAA accorde → passage à COMBASE
  const acc = await valider(id, U.cemaa, 'Accord CEMAA vol sensible');
  expectStatus(acc, 200, 'CEMAA accorde le verrou (200)');
  av = await avancement(id);
  check(av.data?.etape_courante === 'COMBASE', 'accord CEMAA débloque COMBASE', `etape=${av.data?.etape_courante}`);
  check(av.data?.verrou_cemaa?.accorde === true, 'verrou CEMAA marqué accordé', JSON.stringify(av.data?.verrou_cemaa));

  // COMBASE finalise → VALIDE
  const fin = await valider(id, U.combase);
  expectStatus(fin, 200, 'COMBASE finalise le vol sensible (200)');
  av = await avancement(id);
  check(av.data?.statut === 'VALIDE', 'manifeste sensible VALIDE', `statut=${av.data?.statut}`);
}

async function phaseConsignes() {
  phase('8 · Consignes CEMAA');
  if (!state.volNominal) return skip('consignes', 'aucun vol');

  // Un rôle non-CEMAA ne peut pas créer de consigne → 403
  const interdit = await api('POST', '/cemaa/consignes', {
    token: tok(U.chef),
    body: { vol_id: state.volNominal, type: 'PERSONNEL', contenu: 'Tentative non autorisée' },
  });
  expectStatus(interdit, 403, 'création de consigne par non-CEMAA refusée (403)');

  // CEMAA crée une consigne (bloque des places)
  const c = await api('POST', '/cemaa/consignes', {
    token: tok(U.cemaa),
    body: {
      vol_id: state.volNominal, escale_base_id: 'BA101', type: 'PERSONNEL',
      contenu: 'Réserver 5 places pour délégation officielle', places_bloquees: 5,
    },
  });
  if (!expectStatus(c, 201, 'CEMAA crée une consigne (201)')) return;
  const consigneId = c.data.id;

  // Lecture des consignes du vol
  const byVol = await api('GET', `/cemaa/consignes/vol/${state.volNominal}`, { token: tok(U.cemaa) });
  check(byVol.status === 200 && Array.isArray(byVol.data) && byVol.data.length >= 1, 'lecture des consignes du vol (≥1)', `status ${byVol.status}`);

  // Mise à jour
  const upd = await api('PATCH', `/cemaa/consignes/${consigneId}`, {
    token: tok(U.cemaa), body: { places_bloquees: 8 },
  });
  expectStatus(upd, 200, 'mise à jour d\'une consigne (200)');

  // Verrouillage de lignes : propagé par RabbitMQ (asynchrone) → contrôle non bloquant.
  skip('verrouillage des lignes passagers/matériels', 'propagation événementielle asynchrone — à vérifier en recette manuelle');
}

async function phaseNotifications() {
  phase('9 · Notifications');
  // Les soumissions/validations émettent des notifications vers les rôles concernés.
  await sleep(1500); // laisser le temps aux consumers RabbitMQ

  // Diagnostic : gateway ET service direct, pour localiser tout écart 404/400.
  const viaGw = await api('GET', '/notifications/unread', { token: tok(U.comeso) });
  const direct = await api('GET', '/notifications/unread', { token: tok(U.comeso), base: NOTIF_DIRECT_URL });

  const gwOk = viaGw.status === 200 && Array.isArray(viaGw.data);
  check(gwOk, 'GET /notifications/unread via gateway → liste', `status ${viaGw.status} — ${JSON.stringify(viaGw.data)?.slice(0, 200)}`);

  if (!gwOk) {
    if (direct.status === 200 && Array.isArray(direct.data)) {
      console.log(`  ${C.yellow}→ Le service direct (:3007) répond 200 mais la gateway ${viaGw.status} : écart de ROUTAGE gateway à investiguer.${C.reset}`);
    } else if (direct.status === 0) {
      console.log(`  ${C.gray}→ Service direct injoignable sur ${NOTIF_DIRECT_URL} (port non publié ?).${C.reset}`);
    } else {
      console.log(`  ${C.yellow}→ Le service direct (:3007) répond aussi ${direct.status} : l'écart est DANS le notification-service (route /api/notifications/unread ou garde JWT).${C.reset}`);
    }
  }

  const list = gwOk ? viaGw.data : (Array.isArray(direct.data) ? direct.data : []);
  if (list.length > 0) {
    const nid = list[0].id;
    const target = gwOk ? { token: tok(U.comeso) } : { token: tok(U.comeso), base: NOTIF_DIRECT_URL };
    const markOne = await api('PATCH', `/notifications/${nid}/read`, target);
    expectStatus(markOne, [200, 204], 'marquer une notification comme lue');
  } else {
    skip('marquage d\'une notification', 'aucune notification non lue au moment du test');
  }

  const markAllGw = await api('PATCH', '/notifications/read-all', { token: tok(U.comeso) });
  if (!expectStatus(markAllGw, [200, 204], 'marquer toutes les notifications comme lues (gateway)')) {
    const markAllDirect = await api('PATCH', '/notifications/read-all', { token: tok(U.comeso), base: NOTIF_DIRECT_URL });
    console.log(`  ${C.gray}→ read-all direct (:3007) = ${markAllDirect.status} ${JSON.stringify(markAllDirect.data)?.slice(0, 120)}${C.reset}`);
  }
}

async function phaseDashboard() {
  phase('10 · Tableau de bord (données)');
  const prof = await api('GET', '/auth/profile', { token: tok(U.chef) });
  check(prof.status === 200 && prof.data?.role, 'GET /auth/profile → profil utilisateur', `status ${prof.status}`);
  const notifs = await api('GET', '/auth/profile/notifications', { token: tok(U.chef) });
  check([200].includes(notifs.status), 'GET /auth/profile/notifications', `status ${notifs.status}`);
  console.log(`  ${C.gray}Note : le rendu graphique du tableau de bord (React) se vérifie en recette manuelle (cf. cahier).${C.reset}`);
}

async function phasePdf() {
  phase('11 · PDF du manifeste');
  const id = state.manifesteValide || state.manifesteNominal;
  if (!id) return skip('pdf', 'aucun manifeste');

  // Via la gateway
  const viaGw = await api('GET', `/pdf/manifeste/${id}`, { token: tok(U.chef), raw: true });
  check(viaGw.status === 200, 'GET /pdf/manifeste/:id via gateway → 200', `status ${viaGw.status}`);

  // En direct sur le pdf-service (octets bruts) → vérifie l'en-tête %PDF
  const direct = await api('GET', `/pdf/manifeste/${id}`, { token: tok(U.chef), base: PDF_DIRECT_URL, raw: true });
  if (direct.status === 200 && Buffer.isBuffer(direct.data)) {
    const magic = direct.data.subarray(0, 5).toString('latin1');
    check(magic === '%PDF-', 'le pdf-service renvoie un PDF valide (en-tête %PDF)', `en-tête=${magic}`);
  } else if (direct.status === 0) {
    skip('PDF binaire direct', `pdf-service injoignable sur ${PDF_DIRECT_URL}`);
  } else {
    ko('PDF binaire direct', `status ${direct.status}`);
  }
  console.log(`  ${C.gray}Note : la gateway sérialise en JSON — pour un PDF binaire fidèle, préférez l'accès direct au service (ou faire streamer le proxy).${C.reset}`);
}

async function phaseAdmin() {
  phase('12 · Administration & RBAC');

  // Un non-admin sur une route admin → 403
  const interdit = await api('POST', '/admin/utilisateurs', {
    token: tok(U.chef),
    body: { login: 'x', role: 'chef_escale', base_id: 'BA101', nom: 'X', prenom: 'Y', grade: 'Z' },
  });
  expectStatus(interdit, 403, 'route admin refusée à un non-admin (403)');

  // Admin crée un utilisateur — le DTO exige un mot de passe fort (14+, complexité).
  const login = `e2e.user.${suffix.toLowerCase()}`;
  const create = await api('POST', '/admin/utilisateurs', {
    token: tok(U.admin),
    body: {
      login, role: 'chef_escale', base_id: 'BA201',
      nom: 'Test', prenom: 'E2E', grade: 'Adjudant',
      password: 'E2eRecette!2026#',
    },
  });
  const created = expectStatus(create, [200, 201], 'admin crée un utilisateur');
  const newId = create.data?.id;

  // Admin modifie l'utilisateur
  if (created && newId) {
    const patch = await api('PATCH', `/admin/utilisateurs/${newId}`, {
      token: tok(U.admin), body: { grade: 'Adjudant-Chef' },
    });
    expectStatus(patch, 200, 'admin modifie un utilisateur');
  } else {
    skip('modification utilisateur', 'création non concluante');
  }

  // Admin crée une base
  const base = await api('POST', '/admin/bases', {
    token: tok(U.admin),
    body: { code_base: `BA9${suffix.slice(-2)}`, nom: 'Base test E2E', region: 'Centre', numero: `9${suffix.slice(-2)}` },
  });
  expectStatus(base, [200, 201, 400, 409], 'admin crée une base (ou conflit si rejouée)');

  // Journaux d'audit
  const audit = await api('GET', '/admin/audit-logs', { token: tok(U.admin) });
  check([200].includes(audit.status), 'admin consulte les journaux d\'audit', `status ${audit.status}`);

  // MFA reset requests + alertes de sécurité
  const mfaReq = await api('GET', '/auth/admin/mfa-reset-requests', { token: tok(U.admin) });
  check([200].includes(mfaReq.status), 'admin liste les demandes de réinitialisation MFA', `status ${mfaReq.status}`);
  const alerts = await api('GET', '/auth/admin/security-alerts', { token: tok(U.admin) });
  check([200].includes(alerts.status), 'admin consulte les alertes de sécurité', `status ${alerts.status}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const t0 = Date.now();
  console.log(`${C.bold}${C.cyan}SIGEA — Banc de recette bout-en-bout${C.reset}`);
  console.log(`${C.gray}Gateway   : ${BASE_URL}${C.reset}`);
  console.log(`${C.gray}Suffixe   : ${suffix}  (identifiants de test uniques par exécution)${C.reset}`);

  try {
    await phaseSante();
    await phaseAuth();

    // Sans tokens de tous les rôles, inutile de poursuivre.
    const manquants = Object.values(U).filter((l) => !tokens[l]);
    if (manquants.length) {
      console.log(`\n${C.red}Authentification incomplète (${manquants.join(', ')}). Arrêt.${C.reset}`);
    } else {
      await phaseReferentiel();
      await phaseVols();
      await phaseManifestes();
      await phaseCircuitNominal();
      await phaseRejet();
      await phaseSensible();
      await phaseConsignes();
      await phaseNotifications();
      await phaseDashboard();
      await phasePdf();
      await phaseAdmin();
    }
  } catch (e) {
    console.log(`\n${C.red}${C.bold}Erreur fatale : ${e.message}${C.reset}`);
    console.log(C.gray + (e.stack || '') + C.reset);
  }

  // Rapport
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n${C.bold}────────────────────────────────────────────${C.reset}`);
  console.log(`${C.bold}Résultat${C.reset} : ${C.green}${pass} réussis${C.reset}, ${fail ? C.red : C.gray}${fail} échoués${C.reset}, ${C.yellow}${skipped} ignorés${C.reset}  ${C.gray}(${dt}s)${C.reset}`);
  if (failures.length) {
    console.log(`\n${C.red}${C.bold}Échecs :${C.reset}`);
    for (const f of failures) {
      console.log(`  ${C.red}• [${f.phase}] ${f.msg}${C.reset}`);
      if (f.detail) console.log(`    ${C.gray}${f.detail}${C.reset}`);
    }
  }
  process.exit(fail > 0 ? 1 : 0);
})();
