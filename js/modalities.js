// Catalogue pédagogique : modules → sections (onglets) → items.
// BUILTIN_MODULES est le contenu d'origine (88 items) : il sert tant que le serveur n'a pas envoyé de catalogue.
// L'équipe peut ensuite le modifier dans Carnet Réa (Admin → EchoLearn → Contenu) : le réglage « echoCatalogue » le remplace.
const BUILTIN_MODULES=[
  {id:'cardio',name:'Cardiaque',icon:'🫀',accent:'#6ee7f7',tabs:[
    {id:'coupes',label:'Coupes',items:[
      {id:'paxp',name:'Petit axe parasternale',desc:'Vue transversale VG, valve aortique, valve pulmonaire, piliers mitraux, DTDVG, SIVd et PPVG'},
      {id:'gaxp',name:'Grand axe parasternale',desc:'VG, VD, valve mitrale, aorte ascendante, SIV, sinus de Valsalva, aorte ascendante'},
      {id:'4c',name:'4 cavités apicale',desc:'4 chambres, septum inter-auriculaire et inter-ventriculaire, paroi antéro-latérale, paroi inféro-septale'},
      {id:'5c',name:'5 cavités apicale',desc:'4 cavités + voie d\'éjection aortique (LVOT)'},
      {id:'2c',name:'2 cavités apicale',desc:'VG et OG, valve mitrale, paroi inférieure et antérieure'},
      {id:'3c',name:'3 cavités apicale',desc:'VG, LVOT, aorte ascendante en apical, paroi antéro-septale, paroi inféro-latérale'},
      {id:'sc',name:'Sous-costale 4 cavités',desc:'Vue sous-xyphoïdienne, septum interauriculaire, VCI, péricarde'},
      {id:'vci_sc',name:'VCI sous-costale',desc:'Veine cave inférieure, variabilité respiratoire'},
      {id:'supra',name:'Suprasternale',desc:'Arche aortique, vaisseaux du médiastin supérieur'},
    ]},
    {id:'clinique',label:'Situations cliniques',items:[
      {id:'normal',name:'Cœur normal',desc:'Fonction systolique et diastolique conservée, FE > 55%'},
      {id:'cmd',name:'CMD — Cardiomyopathie dilatée',desc:'Dilatation VG, FE effondrée, hypokinésie globale'},
      {id:'cmh',name:'CMH — Cardiomyopathie hypertrophique',desc:'HVG asymétrique, obstruction LVOT, SAM mitral'},
      {id:'cdr',name:'Cœur droit dilaté',desc:'Dilatation VD, déviation septale, HTAP suspectée'},
      {id:'ep',name:'Épanchement péricardique',desc:'Lame liquidienne péricardique, tamponnade'},
      {id:'tamp',name:'Tamponnade',desc:'Collapsus VD/OD en diastole, signe du balancier'},
      {id:'isc',name:'Ischémie / Infarctus',desc:'Anomalie de cinétique segmentaire, hypokinésie, akinésie'},
      {id:'rao',name:'Rétrécissement aortique',desc:'Épaississement valvulaire, gradient élevé, réduction ouverture'},
      {id:'im',name:'Insuffisance mitrale',desc:'Régurgitation mitrale au Doppler couleur, jet excentrique'},
      {id:'dys',name:'Dysfonction diastolique',desc:'E/A inversé, E/e\' élevé, dilatation OG'},
    ]},
    {id:'mesures',label:'Mesures',items:[
      {id:'ea',name:'Ratio E/A',desc:'Rapport flux mitral E/A — fonction diastolique'},
      {id:'eep',name:'E/e\'',desc:'E mitral / e\' TDI anneau mitral — pression de remplissage'},
      {id:'itv',name:'ITV sous-aortique',desc:'Intégrale temps-vitesse LVOT — débit cardiaque'},
      {id:'fe',name:'Fraction d\'éjection (FE)',desc:'Simpson biplan ou visuelle — fonction systolique VG'},
      {id:'tapse',name:'TAPSE',desc:'Excursion systolique anneau tricuspide — fonction VD'},
      {id:'vci_d',name:'Diamètre VCI',desc:'VCI en sous-costal expiration — estimation pression OD'},
      {id:'vci_c',name:'Collapsibilité VCI',desc:'Variation inspiratoire VCI — estimation volémie'},
      {id:'dpap',name:'PAPs estimée',desc:'4V²(IT) + POD — pression artérielle pulmonaire systolique'},
      {id:'septum',name:'Épaisseur septum IV',desc:'Épaisseur diastolique septum inter-ventriculaire'},
      {id:'dtdvg',name:'DTD VG',desc:'Diamètre télédiastolique VG en parasternale grand axe'},
      {id:'ppvg',name:'Épaisseur VG (PPVG)',desc:'Épaisseur paroi postérieure du ventricule gauche en diastole'},
      {id:'ep_peri',name:'Épanchement péricardique',desc:'Épaisseur de l\'épanchement péricardique'},
      {id:'sp_vd',name:'Onde S\' VD',desc:'Vélocité systolique de l\'anneau tricuspide au TDI — fonction longitudinale VD'},
      {id:'ra_val',name:'Rétrécissement aortique',desc:'Surface aortique, gradient moyen, gradient max — sévérité du RAo'},
      {id:'dtdvg_m',name:'DTD VG',desc:'Diamètre télédiastolique VG en parasternale grand axe'},
      {id:'sivd',name:'Épaisseur septale (SIVd)',desc:'Épaisseur du septum inter-ventriculaire en diastole'},
    ]},
    {id:'expert',label:'Expert',items:[
      {id:'vegetation',name:'Végétation',desc:'Masse mobile hyperéchogène sur valve — endocardite infectieuse'},
      {id:'abces_trigone',name:'Abcès du trigone',desc:'Collection péri-annulaire — complication endocardite'},
      {id:'rupture_pilier',name:'Rupture de pilier',desc:'Insuffisance mitrale aiguë sévère — urgence chirurgicale'},
      {id:'fop',name:'FOP',desc:'Foramen ovale perméable — passage de bulles au Doppler couleur'},
      {id:'tako',name:'Tako Tsubo',desc:'Ballonnisation apicale VG, dysfonction systolique apicale réversible'},
      {id:'ia',name:'Insuffisance aortique',desc:'Régurgitation aortique — jet Doppler couleur, PHT, vena contracta'},
      {id:'dissection',name:'Dissection aortique',desc:'Flap intimal mobile — urgence chirurgicale, dilatation aortique'},
      {id:'thrombus_vg',name:'Thrombus intra-VG',desc:'Masse apicale hypoéchogène — complication IDM, CMD'},
      {id:'autres_expert',name:'Autres',desc:'Situations échographiques rares ou non classées'},
    ]}
  ]},
  {id:'pleuro',name:'Pleuro-pulmonaire',icon:'🫁',accent:'#a78bfa',tabs:[
    {id:'norm_pp',label:'Signes normaux',items:[
      {id:'bat',name:'Signe de la chauve-souris',desc:'Lignes pleurales entre 2 côtes, aspect normal'},
      {id:'glisse',name:'Glissement pleural',desc:'Mouvement en temps réel de la plèvre viscérale'},
      {id:'mer',name:'Signe du bord de mer (M-mode)',desc:'Aspect sableux sous-pleural, poumon aéré normal'},
      {id:'lineA',name:'Lignes A',desc:'Artéfacts horizontaux de répétition, signe d\'aération'},
      {id:'lineB',name:'Lignes B (comètes)',desc:'Artéfacts verticaux hyperéchogènes, œdème interstitiel'},
    ]},
    {id:'patho_pp',label:'Situations pathologiques',items:[
      {id:'pneumo',name:'Pneumothorax',desc:'Abolition glissement pleural, stratosphère M-mode, point pulmonaire'},
      {id:'pleur_ep',name:'Épanchement pleural',desc:'Image anéchogène entre feuillets, signe de la méduse'},
      {id:'conso',name:'Consolidation pulmonaire',desc:'Hépatisation, bronchogramme aérique dynamique'},
      {id:'oedem',name:'Œdème pulmonaire',desc:'Lignes B diffuses bilatérales, profil B'},
      {id:'sdr',name:'Syndrome interstitiel',desc:'Lignes B > 3 par espace intercostal'},
      {id:'abces',name:'Abcès / Masse',desc:'Image hétérogène intra-parenchymateuse'},
    ]}
  ]},
  {id:'abdo',name:'Abdominale',icon:'🫃',accent:'#f97316',tabs:[
    {id:'organes',label:'Organes & Structures',items:[
      {id:'foie',name:'Foie',desc:'Échogénicité, homogénéité, bords, segments de Couinaud'},
      {id:'vbil',name:'Vésicule biliaire',desc:'Paroi, lithiases, cône d\'ombre, Murphy écho'},
      {id:'rate',name:'Rate',desc:'Taille (< 12 cm), échogénicité, splénomégalie'},
      {id:'rein_d',name:'Rein droit',desc:'Taille, cortex, bassinet, dilatation pyélocalicielle'},
      {id:'rein_g',name:'Rein gauche',desc:'Taille, cortex, bassinet, dilatation pyélocalicielle'},
      {id:'aorte_ab',name:'Aorte abdominale',desc:'Diamètre (< 30 mm), anévrysme, dissection'},
      {id:'pancreas',name:'Pancréas',desc:'Tête, corps, queue, canal de Wirsung'},
      {id:'ascite',name:'Ascite / FAST',desc:'Morrison, Douglas, espaces péri-spléniques'},
    ]},
    {id:'patho_ab',label:'Situations pathologiques',items:[
      {id:'chol',name:'Cholécystite',desc:'Paroi > 3 mm, Murphy écho +, péri-cholécystite'},
      {id:'hydro',name:'Hydronéphrose',desc:'Dilatation calicielle, grade I à IV'},
      {id:'aaa',name:'Anévrysme aorte abdominale',desc:'Diamètre > 30 mm, calcifications, thrombus mural'},
      {id:'stea',name:'Stéatose hépatique',desc:'Hyperéchogénicité hépatique, gradient foie/rein'},
      {id:'fast',name:'Épanchement libre (FAST)',desc:'Protocole FAST, morrison, spléno-rénal, Douglas'},
      {id:'ileus',name:'Occlusion / Iléus',desc:'Anses dilatées > 25 mm, péristaltisme absent'},
    ]}
  ]},
  {id:'vascu',name:'Echo-Doppler vasculaire',icon:'🩸',accent:'#f43f5e',tabs:[
    {id:'arteres',label:'Artères',items:[
      {id:'caro',name:'Carotides (TSA)',desc:'IMT, plaques, sténose, Doppler couleur et pulsé'},
      {id:'aorte_v',name:'Aorte abdominale',desc:'Diamètre, vitesses, résistances'},
      {id:'fem',name:'Artère fémorale commune',desc:'Flux triphasique, sténose, pseudo-anévrysme'},
      {id:'popl',name:'Artère poplitée',desc:'Flux, compressions, pièges poplités'},
      {id:'ips',name:'Index de pression systolique',desc:'Rapport cheville/bras, AOMI'},
    ]},
    {id:'veines',label:'Veines',items:[
      {id:'tvp_prox',name:'TVP proximale',desc:'Fémorale commune, superficielle, poplitée — compressibilité'},
      {id:'tvp_dist',name:'TVP distale',desc:'Veines jambières, tibiales, fibulaires'},
      {id:'varic',name:'Varices / Insuffisance veineuse',desc:'Reflux saphénien, jonctions, points de fuite'},
      {id:'vci_v',name:'VCI',desc:'Perméabilité, filtre cave, extension thrombotique'},
    ]}
  ]},
  {id:'dtc',name:'Doppler transcrânien',icon:'🧠',accent:'#8b5cf6',tabs:[
    {id:'norm_dtc',label:'Situations normales',items:[
      {id:'dtc_norm',name:'DTC normal',desc:'Vélocités normales : ACM 55-80 cm/s, ACA 50-80 cm/s, ACP 40-60 cm/s'},
      {id:'acm',name:'ACM — artère cérébrale moyenne',desc:'Profondeur 50-60 mm, flux rapide vers la sonde'},
      {id:'aca',name:'ACA — artère cérébrale antérieure',desc:'Profondeur 60-75 mm, flux s\'éloignant de la sonde'},
      {id:'acp',name:'ACP — artère cérébrale postérieure',desc:'Profondeur 60-70 mm, P1 vers sonde, P2 s\'éloigne'},
      {id:'siphon',name:'Siphon carotidien',desc:'Profondeur 60-70 mm, flux bidirectionnel'},
      {id:'vb_dtc',name:'Système vertébro-basilaire',desc:'Fenêtre sous-occipitale, basilaire, vertébrales'},
    ]},
    {id:'patho_dtc',label:'Situations pathologiques',items:[
      {id:'vasospasme',name:'Vasospasme',desc:'ACM > 120 cm/s, index de Lindegaard > 3, post-HSA'},
      {id:'htic',name:'HTIC',desc:'PPC insuffisante / hypovolémie / hypocapnie — IP élevé > 1.4 et VTD < 25 cm/s'},
      {id:'mort_cereb',name:'Arrêt circulatoire cérébral',desc:'Flux oscillant, pic systolique isolé, silence'},
      {id:'autoregul',name:'Test d\'autorégulation',desc:'Réponse à la variation de PAM, index d\'autorégulation'},
    ]}
  ]}
];

export const BUILTIN = { v: 1, modules: BUILTIN_MODULES };

/** Ce que voient les internes : modules, sections et items non masqués (tableau « vivant » : son contenu est remplacé quand le catalogue change) */
export const MODALITIES = [];
/** Tous les modules, masqués compris : pour retrouver le nom d'un examen ancien ou valider une image d'un item masqué */
export const ALL_MODULES = [];

let lastSig = null;
/** Applique le catalogue reçu du serveur (ou le catalogue d'origine s'il est absent ou illisible). Renvoie vrai s'il a changé. */
export function applyCatalogue(cat) {
  const ok = cat && Array.isArray(cat.modules) && cat.modules.length;
  const c = ok ? cat : BUILTIN;
  const sig = JSON.stringify(c);
  if (sig === lastSig) return false;
  lastSig = sig;
  ALL_MODULES.length = 0; MODALITIES.length = 0;
  c.modules.forEach(m => {
    const tabs = (m.tabs || []).map(t => ({ id: t.id, label: t.label, hidden: !!t.hidden, items: (t.items || []).map(i => ({ id: i.id, name: i.name, desc: i.desc || '', hidden: !!i.hidden })) }));
    const mod = { id: m.id, name: m.name, icon: m.icon || '🩻', accent: m.accent || '#6ee7f7', hidden: !!m.hidden, oldNames: m.oldNames || [], tabs };
    ALL_MODULES.push(mod);
    if (mod.hidden) return;
    const vis = tabs.filter(t => !t.hidden).map(t => Object.assign({}, t, { items: t.items.filter(i => !i.hidden) })).filter(t => t.items.length);
    if (vis.length) MODALITIES.push(Object.assign({}, mod, { tabs: vis }));
  });
  return true;
}
applyCatalogue(null);
