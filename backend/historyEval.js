'use strict';

/**
 * Evaluations Histoire : banques par cycle, pas de doublon dans la session,
 * pas deux fois la meme question d'affilee. Texte oral + explication.
 */

function shuffle(arr, randomInt) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

function tierMatch(raw, tier) {
  const lo = raw.minTier ?? 1;
  const hi = raw.maxTier ?? 3;
  return tier >= lo && tier <= hi;
}

function normalizeBand(band) {
  if (['cycle2', 'cycle3', 'cycle4', 'lycee'].includes(band)) return band;
  return 'cycle2';
}

/** @typedef {{ key: string; prompt: string; expected: string; explanation: string; readAloud?: string; minTier?: number; maxTier?: number }} HistRaw */

/** @type {Record<string, HistRaw[]>} */
const POOLS = {
  cycle2: [
    { key: 'h2-01', prompt: 'Combien de jours compte une semaine ?', expected: '7', explanation: 'Il y a toujours sept jours dans une semaine.', readAloud: 'Combien de jours compte une semaine ?', minTier: 1, maxTier: 3 },
    { key: 'h2-02', prompt: 'Quel mois vient juste apres janvier ?', expected: 'fevrier', explanation: "L'ordre des mois commence par janvier, puis fevrier.", readAloud: 'Quel mois vient juste apres janvier ?', minTier: 1, maxTier: 3 },
    { key: 'h2-03', prompt: 'Combien de mois y a-t-il dans une annee ?', expected: '12', explanation: 'Le calendrier comporte douze mois.', readAloud: 'Combien de mois y a-t-il dans une annee ?', minTier: 1, maxTier: 3 },
    { key: 'h2-04', prompt: 'Quelle saison suit le printemps ?', expected: 'ete', explanation: 'Les quatre saisons sont printemps, ete, automne, hiver.', readAloud: 'Quelle saison suit le printemps ?', minTier: 1, maxTier: 3 },
    { key: 'h2-05', prompt: 'Combien de temps dure environ une journee ?', expected: '24 heures', explanation: 'Une journee complete fait vingt-quatre heures.', readAloud: 'Combien de temps dure environ une journee ? Reponds par exemple vingt-quatre heures.', minTier: 2, maxTier: 3 },
    { key: 'h2-06', prompt: 'Quel jour suit souvent le week-end pour reprendre l\'ecole ?', expected: 'lundi', explanation: 'Apres samedi et dimanche, le lundi ouvre souvent la semaine scolaire.', readAloud: 'Quel jour suit souvent le week-end pour reprendre l\'ecole ?', minTier: 1, maxTier: 3 },
    { key: 'h2-07', prompt: 'Un fuseau horaire sert surtout a definir quoi ?', expected: 'heure', explanation: "Il permet d'aligner l'heure locale avec la position sur la Terre.", readAloud: 'Un fuseau horaire sert surtout a definir quoi ? Un mot.', minTier: 2, maxTier: 3 },
    { key: 'h2-08', prompt: 'Quelle partie du jour suit le matin ?', expected: 'apres-midi', explanation: "Apres la matinee vient l'apres-midi.", readAloud: 'Quelle partie du jour suit le matin ?', minTier: 1, maxTier: 3 },
    { key: 'h2-09', prompt: 'Les quatre directions principales sont nord, sud, est et ?', expected: 'ouest', explanation: 'Les quatre points cardinaux sont nord, sud, est, ouest.', readAloud: 'Les quatre directions principales sont nord, sud, est et ? Donne le dernier mot.', minTier: 2, maxTier: 3 },
    { key: 'h2-10', prompt: 'Quelle couleur du drapeau francais est au centre ?', expected: 'blanc', explanation: 'Le drapeau francais est bleu, blanc, rouge.', readAloud: 'Quelle couleur du drapeau francais est au centre ?', minTier: 2, maxTier: 3 },
    { key: 'h2-11', prompt: 'La capitale de la France est ?', expected: 'paris', explanation: 'Paris est la capitale politique du pays.', readAloud: 'La capitale de la France est ?', minTier: 1, maxTier: 3 },
    { key: 'h2-12', prompt: 'Combien de continents habitables sont souvent retenus dans les programmes ?', expected: '5', explanation: 'On retient souvent cinq continents habituellement habites.', readAloud: 'Combien de continents sont souvent retenus dans les programmes ? Un chiffre.', minTier: 3, maxTier: 3 },
  ],
  cycle3: [
    { key: 'h3-01', prompt: 'En quelle annee a commence la Revolution francaise ?', expected: '1789', explanation: 'La Revolution debute en mille sept cent quatre-vingt-neuf.', readAloud: 'En quelle annee a commence la Revolution francaise ? Quatre chiffres.', minTier: 1, maxTier: 3 },
    { key: 'h3-02', prompt: 'Comment s\'appelait le premier empereur francais du debut du XIXe siecle ?', expected: 'napoleon', explanation: 'Napoleon Bonaparte devient empereur.', readAloud: 'Comment s\'appelait le premier empereur francais du debut du XIXe siecle ? Le nom usuel.', minTier: 1, maxTier: 3 },
    { key: 'h3-03', prompt: 'Quel fleuve traverse Paris ?', expected: 'seine', explanation: 'La Seine traverse la capitale.', readAloud: 'Quel fleuve traverse Paris ?', minTier: 1, maxTier: 3 },
    { key: 'h3-04', prompt: 'Quel roi fut guillotine en mille sept cent quatre-vingt-trois ?', expected: 'louis xvi', explanation: 'Louis XVI fut execute durant la Revolution.', readAloud: 'Quel roi fut guillotine en mille sept cent quatre-vingt-trois ? Prenom et chiffres romains.', minTier: 2, maxTier: 3 },
    { key: 'h3-05', prompt: 'Quelle cite antique fut rivale de Rome dans les guerres puniques ?', expected: 'carthage', explanation: 'Carthage fut une grande puissance rivale de Rome.', readAloud: 'Quelle cite antique fut rivale de Rome dans les guerres puniques ?', minTier: 2, maxTier: 3 },
    { key: 'h3-06', prompt: 'Quel traite met fin a la Premiere Guerre mondiale en mille neuf cent dix-neuf ?', expected: 'versailles', explanation: 'Le traite de Versailles est signe avec l\'Allemagne vaincue.', readAloud: 'Quel traite met fin a la Premiere Guerre mondiale en mille neuf cent dix-neuf ? Nom de ville.', minTier: 2, maxTier: 3 },
    { key: 'h3-07', prompt: 'Quelle guerre mondiale commence en mille neuf cent quatorze ?', expected: 'premiere', explanation: 'La Premiere Guerre mondiale debute en mille neuf cent quatorze.', readAloud: 'Quelle guerre mondiale commence en mille neuf cent quatorze ? Un mot : premiere ou seconde.', minTier: 1, maxTier: 3 },
    { key: 'h3-08', prompt: 'Quel empire est associe a Charlemagne ?', expected: 'carolingien', explanation: 'Le monde carolingien marque une grande reunification territoriale.', readAloud: 'Quel empire est associe a Charlemagne ? Adjectif : carolingien.', minTier: 3, maxTier: 3 },
    { key: 'h3-09', prompt: 'Quelle assemblee vote les lois avec le Senat en France aujourd\'hui ?', expected: 'assemblee nationale', explanation: 'Le Parlement comprend l\'Assemblee nationale et le Senat.', readAloud: 'Quelle assemblee vote les lois avec le Senat ? Deux mots.', minTier: 2, maxTier: 3 },
    { key: 'h3-10', prompt: 'Quelle declaration de mille sept cent quatre-vingt-neuf affirme des droits fondamentaux ?', expected: 'droits de l\'homme', explanation: 'La Declaration des droits de l\'homme et du citoyen est votee en mille sept cent quatre-vingt-neuf.', readAloud: 'Quelle declaration de mille sept cent quatre-vingt-neuf affirme des droits fondamentaux ? Trois derniers mots.', minTier: 2, maxTier: 3 },
    { key: 'h3-11', prompt: 'Quel ocean borde l\'ouest de la France metropolitaine ?', expected: 'atlantique', explanation: 'L\'ocean Atlantique borde le littoral ouest.', readAloud: 'Quel ocean borde l\'ouest de la France metropolitaine ?', minTier: 1, maxTier: 3 },
    { key: 'h3-12', prompt: 'Quelle mer borde le sud de la France sur la facade mediterraneenne ?', expected: 'mediterranee', explanation: 'La mer Mediterranee longe le Sud.', readAloud: 'Quelle mer borde le sud de la France sur la facade mediterraneenne ?', minTier: 1, maxTier: 3 },
  ],
  cycle4: [
    { key: 'h4-01', prompt: 'En quelle annee debute la Premiere Guerre mondiale ?', expected: '1914', explanation: 'Les hostilites generales commencent en mille neuf cent quatorze.', readAloud: 'En quelle annee debute la Premiere Guerre mondiale ?', minTier: 1, maxTier: 3 },
    { key: 'h4-02', prompt: 'En quelle annee se termine la guerre en Europe en mille neuf cent quarante-cinq ?', expected: '1945', explanation: 'La capitulation allemande intervient en mai mille neuf cent quarante-cinq.', readAloud: 'En quelle annee se termine la guerre en Europe en mille neuf cent quarante-cinq ?', minTier: 1, maxTier: 3 },
    { key: 'h4-03', prompt: 'Quelle conference de mille huit cent quatre-vingt-cinq organise le partage coloniale de l\'Afrique ?', expected: 'berlin', explanation: 'La conference de Berlin organise le partage colonial.', readAloud: 'Quelle ville donne son nom a la conference qui organise le partage de l\'Afrique en mille huit cent quatre-vingt-cinq ?', minTier: 2, maxTier: 3 },
    { key: 'h4-04', prompt: 'Quel mur tombe en mille neuf cent quatre-vingt-neuf ?', expected: 'berlin', explanation: 'La chute du mur de Berlin symbolise une grande transformation europeenne.', readAloud: 'Quel mur tombe en mille neuf cent quatre-vingt-neuf ? Nom de ville.', minTier: 1, maxTier: 3 },
    { key: 'h4-05', prompt: 'Quel traite de mille neuf cent cinquante et un cree la CECA ?', expected: 'paris', explanation: 'Le traite de Paris pose les bases de la cooperation europeenne.', readAloud: 'Quel traite de mille neuf cent cinquante et un cree la CECA ? Nom de ville.', minTier: 2, maxTier: 3 },
    { key: 'h4-06', prompt: 'Quelle premiere republique francaise suit la monarchie apres la Revolution ?', expected: 'premiere republique', explanation: 'La Premiere Republique s\'etablit en mille sept cent quatre-vingt-deux.', readAloud: 'Quelle premiere republique francaise suit la monarchie apres la Revolution ? Deux mots.', minTier: 2, maxTier: 3 },
    { key: 'h4-07', prompt: 'Quel ensemble colonial francais regroupe l\'Afrique de l\'Ouest au XXe siecle ?', expected: 'aof', explanation: 'L\'Afrique occidentale francaise regroupe plusieurs colonies.', readAloud: 'Quel sigle designe l\'Afrique occidentale francaise ? Trois lettres.', minTier: 3, maxTier: 3 },
    { key: 'h4-08', prompt: 'Quelle bataille navale de mille huit cent cinq est liee au cap Trafalgar ?', expected: 'trafalgar', explanation: 'La bataille de Trafalgar est une victoire majeure britannique.', readAloud: 'Quelle bataille navale de mille huit cent cinq est liee au cap Trafalgar ? Un nom.', minTier: 2, maxTier: 3 },
    { key: 'h4-09', prompt: 'Quel regime politique precede la IIIe Republique en France ?', expected: 'second empire', explanation: 'Le Second Empire precede la IIIe Republique.', readAloud: 'Quel regime precede la Troisieme Republique ? Deux mots.', minTier: 3, maxTier: 3 },
    { key: 'h4-10', prompt: 'Quelle revolution industrielle utilise massivement la machine a vapeur ?', expected: 'premiere', explanation: 'La premiere revolution industrielle transforme production et transports.', readAloud: 'Quelle revolution industrielle utilise massivement la machine a vapeur ? Un mot : premiere ou seconde.', minTier: 2, maxTier: 3 },
    { key: 'h4-11', prompt: 'Quelle declaration abolit l\'esclavage en mille huit cent quarante-huit en France ?', expected: 'abolition', explanation: 'La IIe Republique abolit l\'esclavage dans les colonies.', readAloud: 'Quelle reforme de mille huit cent quarante-huit abolit l\'esclavage ? Un mot.', minTier: 3, maxTier: 3 },
    { key: 'h4-12', prompt: 'Quel continent voit fortement la rivalite coloniale avant mille neuf cent quatorze ?', expected: 'afrique', explanation: 'Les tensions coloniales concernent surtout l\'Afrique et les Balkans.', readAloud: 'Quel continent voit fortement la rivalite coloniale avant mille neuf cent quatorze ?', minTier: 2, maxTier: 3 },
  ],
  lycee: [
    { key: 'hl-01', prompt: 'En quelle annee le traite de Maastricht fonde l\'Union europeenne ?', expected: '1992', explanation: 'Le traite est signe en mille neuf cent quatre-vingt-douze.', readAloud: 'En quelle annee le traite de Maastricht fonde l\'Union europeenne ?', minTier: 1, maxTier: 3 },
    { key: 'hl-02', prompt: 'Dans quelle ville a lieu l\'attentat qui precipite la crise de juillet mille neuf cent quatorze ?', expected: 'sarajevo', explanation: "L'attentat de Sarajevo declenche l'engrenage diplomatique.", readAloud: 'Dans quelle ville a lieu l\'attentat qui precipite la crise de juillet mille neuf cent quatorze ?', minTier: 2, maxTier: 3 },
    { key: 'hl-03', prompt: 'Quel plan americain aide l\'Europe apres la Seconde Guerre mondiale ?', expected: 'marshall', explanation: 'Le plan Marshall finance la reconstruction.', readAloud: 'Quel plan americain aide l\'Europe apres la Seconde Guerre mondiale ? Nom de famille.', minTier: 1, maxTier: 3 },
    { key: 'hl-04', prompt: 'Quelle conference de mille neuf cent quarante-cinq partage l\'Europe en zones d\'influence ?', expected: 'yalta', explanation: 'La conference de Yalta prepare l\'apres-guerre.', readAloud: 'Quelle conference de mille neuf cent quarante-cinq partage l\'Europe ? Nom de ville.', minTier: 2, maxTier: 3 },
    { key: 'hl-05', prompt: 'Quel accord commercial precede largement l\'OMC ?', expected: 'gatt', explanation: 'Le GATT encadre le commerce avant l\'OMC.', readAloud: 'Quel accord commercial precede largement l\'OMC ? Sigle.', minTier: 3, maxTier: 3 },
    { key: 'hl-06', prompt: 'Quelle revolution commence en Grande-Bretagne au XVIIIe siecle ?', expected: 'industrielle', explanation: 'La revolution industrielle commence outre-Manche.', readAloud: 'Quelle revolution commence en Grande-Bretagne au XVIIIe siecle ? Un adjectif.', minTier: 1, maxTier: 3 },
    { key: 'hl-07', prompt: 'Quel roi convoque les Etats generaux en mille sept cent quatre-vingt-neuf ?', expected: 'louis xvi', explanation: 'Louis XVI veut reformer les finances du royaume.', readAloud: 'Quel roi convoque les Etats generaux en mille sept cent quatre-vingt-neuf ?', minTier: 1, maxTier: 3 },
    { key: 'hl-08', prompt: 'En quelle annee la Constitution de la Ve Republique est-elle adoptee par referendum ?', expected: '1958', explanation: 'La Ve Republique est fondee en mille neuf cent cinquante-huit.', readAloud: 'En quelle annee la Constitution de la Ve Republique est-elle adoptee ? Quatre chiffres.', minTier: 1, maxTier: 3 },
    { key: 'hl-09', prompt: 'Quel traite de mille neuf cent cinquante-sept fonde la CEE ?', expected: 'rome', explanation: 'Les traites de Rome fondent la Communaute economique europeenne.', readAloud: 'Quel traite de mille neuf cent cinquante-sept fonde la CEE ? Nom de ville.', minTier: 2, maxTier: 3 },
    { key: 'hl-10', prompt: 'En quelle annee l\'Algerie accede-t-elle a l\'independance ?', expected: '1962', explanation: "L'independance est proclamee en mille neuf cent soixante-deux.", readAloud: 'En quelle annee l\'Algerie accede-t-elle a l\'independance ?', minTier: 1, maxTier: 3 },
    { key: 'hl-11', prompt: 'Quel concept de Montesquieu veille a equilibrer les pouvoirs ?', expected: 'separation des pouvoirs', explanation: 'Les pouvoirs legislatif, executif et judiciaire se contrarient.', readAloud: 'Quel concept de Montesquieu veille a equilibrer les pouvoirs ? Trois mots.', minTier: 3, maxTier: 3 },
    { key: 'hl-12', prompt: 'Qui elit directement le president de la Republique en France aujourd\'hui ?', expected: 'les citoyens', explanation: 'Le president est elu au suffrage universel direct.', readAloud: 'Qui elit directement le president de la Republique en France aujourd\'hui ? Deux mots.', minTier: 1, maxTier: 3 },
  ],
};

function filterByTier(pool, tier) {
  const m = pool.filter((r) => tierMatch(r, tier));
  return m.length ? m : pool;
}

function pickEightNoDupConsecutive(pool, randomInt) {
  const shuffled = shuffle([...pool], randomInt);
  const out = [];
  let prevKey = null;
  for (const raw of shuffled) {
    if (out.length >= 8) break;
    if (raw.key === prevKey) continue;
    out.push(raw);
    prevKey = raw.key;
  }
  let guard = 0;
  while (out.length < 8 && guard < 40) {
    guard += 1;
    const raw = pool[randomInt(0, pool.length - 1)];
    const last = out[out.length - 1];
    if (last && last.key === raw.key) continue;
    out.push(raw);
  }
  return out.slice(0, 8);
}

function buildHistoryEvaluationQuestions(child, deps) {
  const { gradeBand, randomInt, mergeChildSubjectState, getSubjectTier } = deps;
  const band = normalizeBand(gradeBand(child.grade));
  const tier = getSubjectTier(mergeChildSubjectState(child).levels, 'Histoire');
  let pool = POOLS[band] || POOLS.cycle2;
  pool = filterByTier(pool, tier);
  if (pool.length < 4) pool = POOLS.cycle2;
  const picked = pickEightNoDupConsecutive(pool, randomInt);
  return picked.map(toApi);
}

function toApi(raw) {
  return {
    type: 'history',
    skill: 'histoire',
    prompt: raw.prompt,
    expected: raw.expected,
    readAloudText: raw.readAloud || raw.prompt,
    explanation: raw.explanation,
    contentKey: raw.key,
  };
}

module.exports = {
  buildHistoryEvaluationQuestions,
  POOLS,
};
