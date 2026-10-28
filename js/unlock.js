// Déverrouillage par le téléphone (Face ID, empreinte ou code de l'appareil) — fichier partagé avec EchoLearn.
// Principe : la connexion (identifiant + mot de passe) reste valable ; à chaque ouverture, le téléphone doit confirmer
// que c'est bien son propriétaire (WebAuthn, vérification utilisateur obligatoire). Les deux applications étant sur le
// même domaine, un seul réglage suffit et le déverrouillage vaut pour les deux pendant GRACE_MS.
// Ce verrou protège l'appli sur un téléphone prêté ou laissé déverrouillé ; il ne remplace pas le mot de passe.
const K_CRED = 'cr:unlock';
const K_AT = 'cr:unlockAt';
const K_ASKED = 'cr:unlockAsked';
export const GRACE_MS = 5 * 60 * 1000;

function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } }
function rm(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
function readCred() { try { return JSON.parse(get(K_CRED) || 'null'); } catch (e) { return null; } }
const rand = n => crypto.getRandomValues(new Uint8Array(n));
const toB64 = buf => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export function unlockSupported() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials && window.isSecureContext !== false;
}
export async function platformAvailable() {
  try { return unlockSupported() && await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch (e) { return false; }
}
export function unlockEnabled(uid) { const c = readCred(); return !!(c && c.uid === uid && c.id); }
export function needsUnlock(uid) { return unlockEnabled(uid) && Date.now() - Number(get(K_AT) || 0) > GRACE_MS; }
/** À appeler quand l'application passe en arrière-plan ou après un déverrouillage : repousse l'échéance. */
export function touchUnlock() { set(K_AT, String(Date.now())); }
export function disableUnlock() { rm(K_CRED); rm(K_AT); }
export function offerWanted(uid) { return get(K_ASKED) !== uid && !unlockEnabled(uid); }
export function markOffered(uid) { set(K_ASKED, uid); }

export async function enableUnlock(user, appName) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: rand(32),
      rp: { name: appName || 'Carnet Réa', id: location.hostname },
      user: { id: new TextEncoder().encode(user.id), name: user.username || user.id, displayName: ((user.prenom || '') + ' ' + (user.nom || '')).trim() || user.username || 'Utilisateur' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      attestation: 'none',
      timeout: 60000
    }
  });
  if (!cred) throw new Error('Activation annulée.');
  set(K_CRED, JSON.stringify({ uid: user.id, id: toB64(cred.rawId) }));
  touchUnlock();
  return true;
}
/** true si le propriétaire du téléphone est reconnu (visage, empreinte ou code). */
export async function verifyUnlock(uid) {
  const c = readCred();
  if (!c || c.uid !== uid) return false;
  try {
    const a = await navigator.credentials.get({
      publicKey: { challenge: rand(32), rpId: location.hostname, allowCredentials: [{ type: 'public-key', id: fromB64(c.id), transports: ['internal'] }], userVerification: 'required', timeout: 60000 }
    });
    if (!a) return false;
    touchUnlock();
    return true;
  } catch (e) { return false; }
}
