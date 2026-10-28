// Tutoriel interactif : guide de l'accueil, des modules et de l'espace formateur
import { S, lsSet } from './store.js';
import { registerActions, currentPage, makeLevel } from './ui.js';
import { openMod } from './module.js';
import { MODALITIES } from './modalities.js';
import { $ } from './util.js';

const TUTORIAL_ETUDIANT = [
  { title: 'Bienvenue sur EchoLearn ! 👋', content: 'Ce guide te fait découvrir l\'application. Appuie sur « Suiv. » pour avancer, sur ✕ pour quitter à tout moment.', target: null, tip: null },
  { title: 'Un seul compte pour les deux applications', content: 'Tu te connectes avec le même identifiant (prenom.nom) et le même mot de passe que dans Carnet Réa. Se connecter ou se déconnecter dans l\'une vaut pour l\'autre.', target: null, tip: '💡 Dans ⚙️, active le déverrouillage par Face ID, empreinte ou code du téléphone : un seul réglage pour les deux applications.' },
  { title: 'Ta progression globale', content: 'Cette barre résume ton avancement sur l\'ensemble des modules échographiques. Un item compte comme acquis dès qu\'il est « Fait » ou « Maîtrisé ».', target: '#globalBar', tip: null },
  { title: 'Tes statistiques', content: 'Total d\'examens réalisés, activité de la semaine et nombre d\'images validées par un formateur.', target: '#statsRow', tip: null },
  { title: 'Examens réalisés', content: 'Enregistre chaque examen que tu réalises : choisis le type et ajoute une note libre. La date est automatique. Les examens apparaissent aussi dans Carnet Réa (famille « Écho »).', target: '.exam-add', tip: '⚠️ Dans la note : jamais de nom, de date de naissance ni d\'identifiant de patient.' },
  { title: 'Voir tous tes examens', content: 'Appuie sur « Afficher tout » pour la liste complète, groupée par semaine et filtrable par modalité.', target: '#seeAllBtn', tip: null },
  { title: 'Les modules échographiques', content: 'Chaque tuile est un module échographique (cardiaque, pleuro-pulmonaire, abdominal…). L\'équipe peut en ajouter. Appuie sur une tuile pour y accéder.', target: '#modGrid', tip: '💡 La barre colorée indique ta progression dans chaque module.' },
  { title: 'Activité hebdomadaire', content: 'Le nombre d\'examens réalisés chaque semaine sur les 6 dernières semaines : un bon indicateur de ta régularité.', target: '#barChart', tip: null },
  { title: 'Progression cumulée', content: 'L\'évolution de ton total d\'examens dans le temps. Elle doit progresser régulièrement tout au long du stage.', target: '#lineChart', tip: null },
  { title: 'Ton classement', content: 'Tu te compares anonymement à ta promotion : examens des 7 derniers jours, total cumulé, items acquis. Le calcul est fait par le serveur et n\'apparaît qu\'à partir de 3 internes.', target: '#compareContent', tip: '🔒 Personne ne voit le détail des autres internes.' },
  { title: 'Tes images restent sur ton téléphone', content: 'Les images et vidéos ne sont jamais envoyées au serveur. Si tu changes de téléphone, elles ne suivent pas : le portfolio PDF (⚙️) permet d\'en garder une trace.', target: null, tip: '💡 Si ton téléphone est perdu, ton compte et tes statuts restent disponibles ; seules les images sont perdues.' },
  { title: 'Portfolio imprimable', content: 'Dans les paramètres (⚙️), génère un portfolio PDF avec tes images classées par module, leur validation et la liste de tes examens. Idéal pour la validation de fin de stage.', target: null, tip: null },
  { title: 'Tutoriel terminé ! 🎉', content: 'Pour le guide des modules (statuts, images, validation), ouvre un module et appuie sur « ? » en bas à droite.', target: null, tip: null }
];

const TUTORIAL_MODULE = [
  { title: 'Navigation par onglets', content: 'Chaque module contient plusieurs onglets (Coupes, Situations cliniques, Mesures…). Fais défiler horizontalement pour naviguer.', target: '#tabsContainer', tip: null },
  { title: 'Barre de progression du module', content: 'Elle indique ton avancement dans ce module, en comptant les items « Fait » ou « Maîtrisé ».', target: '.module-prog-bar', tip: null },
  { title: 'Les 4 statuts', content: 'Appuie sur le badge coloré pour faire évoluer ton statut : Non fait (gris) → Vu (bleu) → Fait (orange). « Maîtrisé » (vert) est attribué par un formateur après validation de tes images.', target: '.status-pill', tip: '💡 Mets ton statut à jour au fil de ton apprentissage.' },
  { title: 'Les 5 emplacements', content: 'Chaque item dispose de 5 emplacements pour tes images et vidéos. Appuie sur + pour ajouter un fichier. Il reste sur ton téléphone.', target: '.slots-row', tip: '⚠️ Les images doivent être strictement anonymes. Les vidéos ne sont pas masquées : n\'enregistre que des vidéos sans aucune donnée patient.' },
  { title: 'Masquer le bandeau', content: 'À l\'ajout d\'une image, un rectangle noir te permet de cacher la zone d\'identité de l\'écran de l\'échographe. Seule l\'image masquée est enregistrée ; ton réglage est mémorisé pour la suivante.', target: null, tip: '💡 Le bandeau se déplace au doigt et se redimensionne avec ses poignées.' },
  { title: 'Validation par un formateur, en personne', content: 'Appuie sur « QR » sur une vignette, ou sur « Faire valider cet item ». Un senior ou un membre de l\'équipe, connecté sur son propre téléphone, scanne le QR code avec l\'appareil photo, regarde tes images et valide.', target: '.slot-qr, .btn-mini', tip: '💡 Montre d\'abord tes images, puis affiche le QR code (valable 15 minutes).' },
  { title: 'Vignette validée ✓', content: 'Quand le formateur a validé, une coche verte apparaît sur la vignette à la prochaine synchronisation, quelques secondes après.', target: '.slot-check', tip: null },
  { title: 'Rappel d\'anonymisation', content: 'Ce rappel est affiché dans chaque module. C\'est ta responsabilité de vérifier l\'anonymisation avant chaque enregistrement.', target: '.anon-banner', tip: null }
];

const TUTORIAL_FORMATEUR = [
  { title: 'Tableau de bord formateur', content: 'Tu vois ici les internes de la promotion courante. Les données viennent du même serveur que Carnet Réa et se mettent à jour à chaque synchronisation.', target: '#globalFormStats', tip: null },
  { title: 'Activité de la promotion', content: 'Le graphique montre le nombre d\'échographies par semaine pour toute la promotion, et le total par modalité.', target: '#fmtChartsCard', tip: null },
  { title: 'Liste des internes', content: 'Chaque ligne affiche le nombre d\'actes, le pourcentage d\'items acquis et celui des images validées. Appuie sur un nom pour le détail.', target: '#studentGrid', tip: null },
  { title: 'Détail d\'un interne', content: 'Progression par module, items un par un, examens récents et validations enregistrées. Les images, elles, restent sur le téléphone de l\'interne.', target: null, tip: null },
  { title: 'Valider des images', content: 'La validation se fait toujours en présence de l\'interne : il affiche un QR code sur son téléphone, tu le scannes avec l\'appareil photo du tien, tu examines les images sur son écran puis tu valides.', target: null, tip: '💡 Connecte-toi d\'abord à EchoLearn sur ton téléphone (même compte que Carnet Réa) ; vérifie le nom et l\'item avant de valider.' },
  { title: 'Maîtrisé', content: 'Quand toutes les images d\'un item sont validées d\'un coup, l\'item passe en « Maîtrisé ». Tu peux retirer cette mention depuis le détail de l\'interne si besoin.', target: null, tip: null },
  { title: 'Actualiser', content: 'Appuie sur « ↻ Actualiser » pour forcer une synchronisation immédiate.', target: '#globalFormStats', tip: null }
];

let steps = [], cur = 0, hl = null;
const GUARDED = ['homePage', 'modulePage', 'formateurPage', 'allLogsPage'];

function startTutorial() {
  const page = currentPage();
  if (page === 'homePage') { showMenu(); return; }
  launch(page === 'modulePage' ? 'module' : page === 'formateurPage' ? 'formateur' : 'etudiant');
}
function showMenu() {
  document.getElementById('tutMenu')?.remove();
  const menu = document.createElement('div');
  menu.id = 'tutMenu';
  menu.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem';
  menu.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:20px;padding:1.75rem;width:300px;max-width:95vw;text-align:center">
    <div style="font-size:1.5rem;margin-bottom:.5rem">📖</div>
    <div style="font-size:1rem;font-weight:700;margin-bottom:.35rem">Tutoriel interactif</div>
    <div style="font-size:.78rem;color:var(--text2);margin-bottom:1.25rem">Quel guide veux-tu consulter ?</div>
    <button class="btn-primary" data-act="launchTuto" data-t="etudiant">🎓 Guide de l'accueil</button>
    <button class="btn-ghost" style="margin-bottom:.5rem" data-act="launchTuto" data-t="module">📚 Guide des modules</button>
    <button class="link-btn" data-act="tutMenuClose">Annuler</button></div>`;
  document.body.appendChild(menu);
  tutLevel.open();
}
async function launch(type) {
  document.getElementById('tutMenu')?.remove();
  if (type === 'module' && currentPage() !== 'modulePage') { if (MODALITIES[0]) openMod(MODALITIES[0].id); await new Promise(r => setTimeout(r, 250)); }
  steps = type === 'module' ? TUTORIAL_MODULE : type === 'formateur' ? TUTORIAL_FORMATEUR : TUTORIAL_ETUDIANT;
  cur = 0;
  GUARDED.forEach(id => document.getElementById(id)?.style.setProperty('pointer-events', 'none'));
  $('#tutorialOverlay').style.display = 'block';
  $('#tutorialBubble').style.display = 'block';
  tutLevel.open();
  showStep(0);
}
function showStep(i) {
  const s = steps[i]; if (!s) return;
  $('#tutStep').textContent = i + 1;
  $('#tutTitle').textContent = s.title;
  $('#tutContent').textContent = s.content;
  $('#tutProgress').textContent = (i + 1) + ' / ' + steps.length;
  const tip = $('#tutTip');
  if (s.tip) { tip.textContent = s.tip; tip.style.display = 'block'; } else tip.style.display = 'none';
  const prev = $('#tutPrevBtn'); prev.style.opacity = i === 0 ? '.3' : '1'; prev.disabled = i === 0;
  $('#tutNextBtn').textContent = i === steps.length - 1 ? 'Terminer ✓' : 'Suiv. →';
  removeHighlight();
  $('#tutorialOverlay').style.display = 'block';
  const el = s.target ? document.querySelector(s.target) : null;
  if (el && el.getClientRects().length) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => { highlight(el); position(el); }, 300);
  } else center();
}
function highlight(el) {
  hl = { el, pos: el.style.position, z: el.style.zIndex, sh: el.style.boxShadow, br: el.style.borderRadius };
  el.style.position = 'relative'; el.style.zIndex = '1002';
  el.style.boxShadow = '0 0 0 4px #6ee7f7,0 0 0 8px rgba(110,231,247,.25),0 0 0 9999px rgba(0,0,0,.82)';
  el.style.borderRadius = '10px'; el.style.transition = 'box-shadow .3s';
}
function removeHighlight() {
  if (!hl) return;
  hl.el.style.position = hl.pos || ''; hl.el.style.zIndex = hl.z || ''; hl.el.style.boxShadow = hl.sh || ''; hl.el.style.borderRadius = hl.br || ''; hl.el.style.transition = '';
  hl = null;
}
function position(el) {
  const b = $('#tutorialBubble'), r = el.getBoundingClientRect(), bw = 290, bh = 240, m = 16, arrow = $('#tutArrow');
  arrow.style.display = 'block';
  let top;
  const left = Math.min(Math.max(r.left, m), window.innerWidth - bw - m);
  if (r.bottom + bh + m < window.innerHeight) {
    top = r.bottom + m;
    arrow.style.cssText = 'position:absolute;top:-7px;left:20px;width:12px;height:12px;background:var(--bg2);border-left:1px solid #6ee7f7;border-top:1px solid #6ee7f7;transform:rotate(45deg)';
  } else {
    top = r.top - bh - m;
    arrow.style.cssText = 'position:absolute;bottom:-7px;left:20px;width:12px;height:12px;background:var(--bg2);border-right:1px solid #6ee7f7;border-bottom:1px solid #6ee7f7;transform:rotate(45deg)';
  }
  b.style.top = Math.max(m, top) + 'px'; b.style.left = left + 'px'; b.style.transform = 'none';
}
function center() {
  const b = $('#tutorialBubble');
  b.style.top = '50%'; b.style.left = '50%'; b.style.transform = 'translate(-50%,-50%)';
  $('#tutArrow').style.display = 'none';
}
const tutLevel = makeLevel('overlay', hideTutorial);
const endTutorial = () => tutLevel.close();
function hideTutorial() {
  document.getElementById('tutMenu')?.remove();
  GUARDED.forEach(id => document.getElementById(id)?.style.removeProperty('pointer-events'));
  removeHighlight();
  $('#tutorialOverlay').style.display = 'none';
  $('#tutorialBubble').style.display = 'none';
  if (S.me) lsSet('echo:tuto:' + S.me.id, '1');
}

registerActions({
  startTutorial, endTutorial, launchTuto: d => launch(d.t), tutMenuClose: endTutorial,
  tutNext: () => { if (cur >= steps.length - 1) { endTutorial(); return; } cur++; showStep(cur); },
  tutPrev: () => { if (cur > 0) { cur--; showStep(cur); } }
});
