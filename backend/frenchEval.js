'use strict';

/**
 * Banques d'exercices pour les evaluations Francais : melange dictee, grammaire,
 * orthographe, lecture, calibre par cycle (classe) puis par niveau E/M/A de l'enfant.
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

/** @typedef {{ key: string, minTier?: number, maxTier?: number, expected: string, readAloud?: string, prompt?: string }} FrenchEvalRaw */

/** @type {Record<string, Record<string, FrenchEvalRaw[]>>} */
const POOLS = {
  cycle2: {
    dictee: [
      { key: 'c2-d-01', minTier: 1, maxTier: 3, expected: "Les oiseaux chantent dans l'arbre.", readAloud: "Les oiseaux chantent dans l'arbre." },
      { key: 'c2-d-02', minTier: 1, maxTier: 3, expected: 'Le chat dort sur le tapis.', readAloud: 'Le chat dort sur le tapis.' },
      { key: 'c2-d-03', minTier: 1, maxTier: 3, expected: "Nous allons a l'ecole ce matin.", readAloud: "Nous allons a l'ecole ce matin." },
      { key: 'c2-d-04', minTier: 1, maxTier: 2, expected: 'La maitresse lit une histoire aux enfants.', readAloud: 'La maitresse lit une histoire aux enfants.' },
      { key: 'c2-d-05', minTier: 2, maxTier: 3, expected: 'Les eleves observent les nuages avant la recreation.', readAloud: 'Les eleves observent les nuages avant la recreation.' },
      { key: 'c2-d-06', minTier: 2, maxTier: 3, expected: 'Mon frere range ses crayons dans la trousse.', readAloud: 'Mon frere range ses crayons dans la trousse.' },
      { key: 'c2-d-07', minTier: 1, maxTier: 3, expected: 'Papa prepare un gateau au chocolat.', readAloud: 'Papa prepare un gateau au chocolat.' },
      { key: 'c2-d-08', minTier: 2, maxTier: 3, expected: 'Les hirondelles reviennent quand le printemps arrive.', readAloud: 'Les hirondelles reviennent quand le printemps arrive.' },
    ],
    grammaire: [
      {
        key: 'c2-g-01',
        minTier: 1,
        maxTier: 3,
        prompt: 'Complete avec le bon pronom : ___ prepare le gouter. (parle de Lisa, fille)\nReponds par un seul mot.',
        expected: 'elle',
        readAloud: '',
      },
      {
        key: 'c2-g-02',
        minTier: 1,
        maxTier: 2,
        prompt: 'Complete avec un ou des : Lisa mange ___ pomme.',
        expected: 'une',
        readAloud: '',
      },
      {
        key: 'c2-g-03',
        minTier: 2,
        maxTier: 3,
        prompt: 'Accorde : Les chats ___ dans le jardin. (dormir, present)\nReponds avec deux mots.',
        expected: 'dorment',
        readAloud: '',
      },
      {
        key: 'c2-g-04',
        minTier: 1,
        maxTier: 3,
        prompt: 'Choisis le bon mot : Ce sont ___ crayons. (mes / mon / ma)',
        expected: 'mes',
        readAloud: '',
      },
      {
        key: 'c2-g-05',
        minTier: 2,
        maxTier: 3,
        prompt: 'Met au pluriel : Le chat noir dort.\nCommence par : Les ...',
        expected: 'Les chats noirs dorment.',
        readAloud: '',
      },
      {
        key: 'c2-g-06',
        minTier: 1,
        maxTier: 2,
        prompt: 'Choisis : ___ vu la lune ce soir ? (Tu as / Tu es)',
        expected: 'tu as',
        readAloud: '',
      },
      {
        key: 'c2-g-07',
        minTier: 2,
        maxTier: 3,
        prompt: 'Complete : Si nous ___ sage, nous jouons dehors. (etre, nous)',
        expected: 'sommes',
        readAloud: '',
      },
      {
        key: 'c2-g-08',
        minTier: 1,
        maxTier: 3,
        prompt: 'Choisis : Voici ___ voisin qui aide les enfants. (le / la)',
        expected: 'le',
        readAloud: '',
      },
    ],
    orthographe: [
      {
        key: 'c2-o-01',
        minTier: 1,
        maxTier: 3,
        prompt: 'Ecris le mot avec la bonne terminaison : La maison est tres cha___ (brulant).',
        expected: 'aude',
        readAloud: '',
      },
      {
        key: 'c2-o-02',
        minTier: 1,
        maxTier: 2,
        prompt: 'Ecris le mot complet : un pap___ vol dans le ciel (animal)',
        expected: 'illon',
        readAloud: '',
      },
      {
        key: 'c2-o-03',
        minTier: 2,
        maxTier: 3,
        prompt: 'Sans erreur : La bibliothe___ du village est fermee le dimanche. (mot entier)',
        expected: 'bibliotheque',
        readAloud: '',
      },
      {
        key: 'c2-o-04',
        minTier: 1,
        maxTier: 3,
        prompt: 'Choisis et ecris le bon homophone : Il ___ gentil avec sa petite soeur. (est / et)',
        expected: 'est',
        readAloud: '',
      },
      {
        key: 'c2-o-05',
        minTier: 2,
        maxTier: 3,
        prompt: 'Complete avec ou ou où : Dis-moi ___ tu as cache le livre.',
        expected: 'ou',
        readAloud: '',
      },
      {
        key: 'c2-o-06',
        minTier: 1,
        maxTier: 2,
        prompt: 'Accord du participe avec avoir : Elle a ___ son sac. (finir)',
        expected: 'fini',
        readAloud: '',
      },
      {
        key: 'c2-o-07',
        minTier: 2,
        maxTier: 3,
        prompt: 'Sans faute : une histoire inte________.',
        expected: 'ressante',
        readAloud: '',
      },
      {
        key: 'c2-o-08',
        minTier: 1,
        maxTier: 3,
        prompt: 'Ecris la phrase correcte : les enfants ___ dans la cour (saute / sautent). Un seul mot.',
        expected: 'sautent',
        readAloud: '',
      },
    ],
    lecture: [
      {
        key: 'c2-l-01',
        minTier: 1,
        maxTier: 3,
        prompt:
          'Texte :\nLe chat dort sur le tapis. Lisa lui donne un peu de lait.\n\nQuestion : Ou dort le chat ? (une courte reponse)',
        expected: 'sur le tapis',
        readAloud: 'Le chat dort sur le tapis. Lisa lui donne un peu de lait.',
      },
      {
        key: 'c2-l-02',
        minTier: 1,
        maxTier: 3,
        prompt:
          'Texte :\nLes fruits sont rouges sur l\'arbre. Papa cueille trois pommes.\n\nQuestion : De quelle couleur sont les fruits sur l\'arbre ?',
        expected: 'rouges',
        readAloud: 'Les fruits sont rouges sur l\'arbre. Papa cueille trois pommes.',
      },
      {
        key: 'c2-l-03',
        minTier: 2,
        maxTier: 3,
        prompt:
          'Texte :\nLes eleves lisent calmement pendant dix minutes. Ensuite ils rangent leurs livres.\n\nQuestion : Combien de minutes lisent-ils ?',
        expected: 'dix',
        readAloud: 'Les eleves lisent calmement pendant dix minutes. Ensuite ils rangent leurs livres.',
      },
      {
        key: 'c2-l-04',
        minTier: 2,
        maxTier: 3,
        prompt:
          'Texte :\nLe vent souffle fort sur la colline. Les arbres se balancent sans casser leurs branches.\n\nQuestion : Ou souffle le vent dans ce texte ?',
        expected: 'sur la colline',
        readAloud: 'Le vent souffle fort sur la colline. Les arbres se balancent sans casser leurs branches.',
      },
      {
        key: 'c2-l-05',
        minTier: 1,
        maxTier: 2,
        prompt:
          'Texte :\nMa grand-mere plante des tulipes au printemps. Elle arrose les fleurs le matin.\n\nQuestion : Quand plante-t-elle les tulipes ?',
        expected: 'au printemps',
        readAloud: 'Ma grand-mere plante des tulipes au printemps. Elle arrose les fleurs le matin.',
      },
      {
        key: 'c2-l-06',
        minTier: 2,
        maxTier: 3,
        prompt:
          'Texte :\nLes hirondelles quittent le nid avant l\'hiver. Elles reviennent quand il fait plus chaud.\n\nQuestion : Que font les hirondelles avant l\'hiver ?',
        expected: 'quittent le nid',
        readAloud: 'Les hirondelles quittent le nid avant l\'hiver. Elles reviennent quand il fait plus chaud.',
      },
      {
        key: 'c2-l-07',
        minTier: 1,
        maxTier: 3,
        prompt:
          'Texte :\nTom ouvre son cartable et sort son dictionnaire pour corriger une faute.\n\nQuestion : Pourquoi sort-il le dictionnaire ?',
        expected: 'pour corriger une faute',
        readAloud: 'Tom ouvre son cartable et sort son dictionnaire pour corriger une faute.',
      },
      {
        key: 'c2-l-08',
        minTier: 2,
        maxTier: 3,
        prompt:
          'Texte :\nLes enfants ecoutent une histoire avant la sieste. La maitresse lit lentement.\n\nQuestion : Qui lit l\'histoire ?',
        expected: 'la maitresse',
        readAloud: 'Les enfants ecoutent une histoire avant la sieste. La maitresse lit lentement.',
      },
    ],
  },
  cycle3: {
    dictee: [
      {
        key: 'c3-d-01',
        minTier: 1,
        maxTier: 3,
        expected: 'Les eleves relisent attentivement la lecon de grammaire.',
        readAloud: 'Les eleves relisent attentivement la lecon de grammaire.',
      },
      {
        key: 'c3-d-02',
        minTier: 1,
        maxTier: 3,
        expected: 'Mon frere a termine ses devoirs avant le diner.',
        readAloud: 'Mon frere a termine ses devoirs avant le diner.',
      },
      {
        key: 'c3-d-03',
        minTier: 2,
        maxTier: 3,
        expected: 'La maitresse explique calmement la consigne du projet.',
        readAloud: 'La maitresse explique calmement la consigne du projet.',
      },
      {
        key: 'c3-d-04',
        minTier: 2,
        maxTier: 3,
        expected: 'Les scientifiques mesurent la temperature avec precision.',
        readAloud: 'Les scientifiques mesurent la temperature avec precision.',
      },
      {
        key: 'c3-d-05',
        minTier: 1,
        maxTier: 2,
        expected: 'Nous avons visite le musee avec la classe entiere.',
        readAloud: 'Nous avons visite le musee avec la classe entiere.',
      },
      {
        key: 'c3-d-06',
        minTier: 2,
        maxTier: 3,
        expected: 'Une encyclopedie raconte des civilisations anciennes.',
        readAloud: 'Une encyclopedie raconte des civilisations anciennes.',
      },
      {
        key: 'c3-d-07',
        minTier: 1,
        maxTier: 3,
        expected: 'Le conseiller pedagogique propose une aide aux parents.',
        readAloud: 'Le conseiller pedagogique propose une aide aux parents.',
      },
      {
        key: 'c3-d-08',
        minTier: 2,
        maxTier: 3,
        expected: 'Les ecrivains publient souvent leurs textes sur internet.',
        readAloud: 'Les ecrivains publient souvent leurs textes sur internet.',
      },
    ],
    grammaire: [
      {
        key: 'c3-g-01',
        minTier: 1,
        maxTier: 3,
        prompt: 'Complete avec bien ou bon : Ce roman est tres ___ ecrit.',
        expected: 'bien',
        readAloud: '',
      },
      {
        key: 'c3-g-02',
        minTier: 2,
        maxTier: 3,
        prompt: 'Choisis : Les eleves ___ leur expose demain. (present finir, ils)',
        expected: 'finissent',
        readAloud: '',
      },
      {
        key: 'c3-g-03',
        minTier: 1,
        maxTier: 3,
        prompt: 'Nature du groupe nominal : Dans "la phrase courte", quel est le GN sujet ? Reponds avec trois mots.',
        expected: 'la phrase courte',
        readAloud: '',
      },
      {
        key: 'c3-g-04',
        minTier: 2,
        maxTier: 3,
        prompt: 'Coherence : Remplace le pronom : Emma lit un roman. ___ sourit en tournant la page.',
        expected: 'elle',
        readAloud: '',
      },
      {
        key: 'c3-g-05',
        minTier: 1,
        maxTier: 2,
        prompt: 'Accorde : Les documents ___ sur le bureau. (etre)',
        expected: 'sont',
        readAloud: '',
      },
      {
        key: 'c3-g-06',
        minTier: 2,
        maxTier: 3,
        prompt: 'Temps du verbe : "Quand j\'etais petit, je ___ tous les matins." (courir, imparfait, je)',
        expected: 'courais',
        readAloud: '',
      },
      {
        key: 'c3-g-07',
        minTier: 2,
        maxTier: 3,
        prompt: 'Negation : Transforme : Je comprends toujours la consigne.\nCommence par : Je',
        expected: 'Je ne comprends pas toujours la consigne.',
        readAloud: '',
      },
      {
        key: 'c3-g-08',
        minTier: 1,
        maxTier: 3,
        prompt: 'Determine la classe du mot souligne logiquement : Dans "rapidement", quel type de mot ? (un mot)',
        expected: 'adverbe',
        readAloud: '',
      },
    ],
    orthographe: [
      {
        key: 'c3-o-01',
        minTier: 1,
        maxTier: 3,
        prompt: 'Ecris sans faute : la langue fran_____.',
        expected: 'caise',
        readAloud: '',
      },
      {
        key: 'c3-o-02',
        minTier: 2,
        maxTier: 3,
        prompt: 'Complete : une activite physi___ au gymnase.',
        expected: 'que',
        readAloud: '',
      },
      {
        key: 'c3-o-03',
        minTier: 1,
        maxTier: 3,
        prompt: 'Choisis : Ce probleme est ___ difficile que le precedent. (plus / autant)',
        expected: 'plus',
        readAloud: '',
      },
      {
        key: 'c3-o-04',
        minTier: 2,
        maxTier: 3,
        prompt: 'Ecris la bonne forme : ils se sont ___ au parc. (promener)',
        expected: 'promenes',
        readAloud: '',
      },
      {
        key: 'c3-o-05',
        minTier: 1,
        maxTier: 2,
        prompt: 'accents : une regle gen___ pour tous.',
        expected: 'erale',
        readAloud: '',
      },
      {
        key: 'c3-o-06',
        minTier: 2,
        maxTier: 3,
        prompt: 'Ecris en lettres : Le roi Henri ___ regne au XVIe siecle. (chiffre romain quatre)',
        expected: 'iv',
        readAloud: '',
      },
      {
        key: 'c3-o-07',
        minTier: 1,
        maxTier: 3,
        prompt: 'Homophone : Les eleves ___ en groupe dans la cour. (etre)',
        expected: 'sont',
        readAloud: '',
      },
      {
        key: 'c3-o-08',
        minTier: 2,
        maxTier: 3,
        prompt: 'Mot compose sans erreur : porte ___ document.',
        expected: 'documents',
        readAloud: '',
      },
    ],
    lecture: [
      {
        key: 'c3-l-01',
        minTier: 1,
        maxTier: 3,
        prompt:
          'Texte :\nLucas revise ses tables de multiplication avant le controle. Il pose ses calculs sur une feuille quadrillee.\n\nQuestion : Pourquoi Lucas revise-t-il ?',
        expected: 'avant le controle',
        readAloud: 'Lucas revise ses tables de multiplication avant le controle. Il pose ses calculs sur une feuille quadrillee.',
      },
      {
        key: 'c3-l-02',
        minTier: 2,
        maxTier: 3,
        prompt:
          'Texte :\nLes bibliothecaires classent les livres par genres. Les romans policiers ont une etiquette bleue.\n\nQuestion : Quelle etiquette ont les romans policiers ?',
        expected: 'bleue',
        readAloud: 'Les bibliothecaires classent les livres par genres. Les romans policiers ont une etiquette bleue.',
      },
      {
        key: 'c3-l-03',
        minTier: 1,
        maxTier: 3,
        prompt:
          'Texte :\nLa classe observe une maquette du systeme solaire. Saturne possede de nombreux anneaux.\n\nQuestion : Quelle planete a des anneaux dans ce texte ?',
        expected: 'saturne',
        readAloud: 'La classe observe une maquette du systeme solaire. Saturne possede de nombreux anneaux.',
      },
      {
        key: 'c3-l-04',
        minTier: 2,
        maxTier: 3,
        prompt:
          'Texte :\nUne correspondante italienne ecrit une lettre sur le carnaval de Venise. Elle decrit les costumes colores.\n\nQuestion : D\'ou vient la correspondante ?',
        expected: 'italie',
        readAloud: 'Une correspondante italienne ecrit une lettre sur le carnaval de Venise. Elle decrit les costumes colores.',
      },
      {
        key: 'c3-l-05',
        minTier: 2,
        maxTier: 3,
        prompt:
          'Texte :\nLes journalistes verifient leurs sources avant de publier un article. La rapidite ne doit pas nuire a la verite.\n\nQuestion : Que verifient les journalistes avant publication ?',
        expected: 'leurs sources',
        readAloud: 'Les journalistes verifient leurs sources avant de publier un article. La rapidite ne doit pas nuire a la verite.',
      },
      {
        key: 'c3-l-06',
        minTier: 1,
        maxTier: 2,
        prompt:
          'Texte :\nLa recreation commence a dix heures dix. Les eleves doivent ranger avant la sonnerie.\n\nQuestion : A quelle heure commence la recreation ?',
        expected: 'dix heures dix',
        readAloud: 'La recreation commence a dix heures dix. Les eleves doivent ranger avant la sonnerie.',
      },
      {
        key: 'c3-l-07',
        minTier: 2,
        maxTier: 3,
        prompt:
          'Texte :\nLes guides du musee expliquent la Revolution francaise avec des cartes anciennes.\n\nQuestion : Quel evenement historique est cite ?',
        expected: 'revolution francaise',
        readAloud: 'Les guides du musee expliquent la Revolution francaise avec des cartes anciennes.',
      },
      {
        key: 'c3-l-08',
        minTier: 1,
        maxTier: 3,
        prompt:
          'Texte :\nLes animaux du lac capturent des insectes au lever du jour. Le paysage est silencieux puis anime.\n\nQuestion : Quand capturent-ils des insectes ?',
        expected: 'au lever du jour',
        readAloud: 'Les animaux du lac capturent des insectes au lever du jour. Le paysage est silencieux puis anime.',
      },
    ],
  },
  cycle4: {
    dictee: [
      {
        key: 'c4-d-01',
        minTier: 1,
        maxTier: 3,
        expected: "Pendant les vacances, nous avons visite un musee d'histoire naturelle.",
        readAloud: "Pendant les vacances, nous avons visite un musee d'histoire naturelle.",
      },
      {
        key: 'c4-d-02',
        minTier: 2,
        maxTier: 3,
        expected: 'Les scientifiques publient leurs observations dans une revue specialisee.',
        readAloud: 'Les scientifiques publient leurs observations dans une revue specialisee.',
      },
      {
        key: 'c4-d-03',
        minTier: 2,
        maxTier: 3,
        expected: 'La bibliotheque municipale organise un debat sur la litterature contemporaine.',
        readAloud: 'La bibliotheque municipale organise un debat sur la litterature contemporaine.',
      },
      {
        key: 'c4-d-04',
        minTier: 1,
        maxTier: 3,
        expected: 'Les citoyens debattent calmement malgre leurs desaccords.',
        readAloud: 'Les citoyens debattent calmement malgre leurs desaccords.',
      },
      {
        key: 'c4-d-05',
        minTier: 2,
        maxTier: 3,
        expected: 'Une analyse rigoureuse evite les conclusions hatives.',
        readAloud: 'Une analyse rigoureuse evite les conclusions hatives.',
      },
      {
        key: 'c4-d-06',
        minTier: 1,
        maxTier: 3,
        expected: 'Le professeur demande une argumentation etayee par des exemples.',
        readAloud: 'Le professeur demande une argumentation etayee par des exemples.',
      },
      {
        key: 'c4-d-07',
        minTier: 2,
        maxTier: 3,
        expected: 'Les eleves comparent deux articles sur le meme evenement.',
        readAloud: 'Les eleves comparent deux articles sur le meme evenement.',
      },
      {
        key: 'c4-d-08',
        minTier: 2,
        maxTier: 3,
        expected: 'La transmission des savoirs accompagne les mutations numeriques.',
        readAloud: 'La transmission des savoirs accompagne les mutations numeriques.',
      },
    ],
    grammaire: [
      {
        key: 'c4-g-01',
        minTier: 2,
        maxTier: 3,
        prompt: 'Mode : Bien qu\'il ___ fatigue, il termine son expose. (etre, subjonctif present, il)',
        expected: 'soit',
        readAloud: '',
      },
      {
        key: 'c4-g-02',
        minTier: 1,
        maxTier: 3,
        prompt: 'Accord du participe passe avec etre : Elles sont ___ hier soir. (partir)',
        expected: 'parties',
        readAloud: '',
      },
      {
        key: 'c4-g-03',
        minTier: 2,
        maxTier: 3,
        prompt: 'Proposition relative : La femme ___ parle est guidee par la curiosite. (qui / dont / ou)',
        expected: 'qui',
        readAloud: '',
      },
      {
        key: 'c4-g-04',
        minTier: 1,
        maxTier: 3,
        prompt: 'Voix : "Les devoirs ont ete rendus a temps." Quelle voix ? (active ou passive — un mot)',
        expected: 'passive',
        readAloud: '',
      },
      {
        key: 'c4-g-05',
        minTier: 2,
        maxTier: 3,
        prompt: 'Coordination : Remplace la repetition par un pronom : Leo lit un essai et Leo resume ses idees.',
        expected: 'il resume ses idees',
        readAloud: '',
      },
      {
        key: 'c4-g-06',
        minTier: 2,
        maxTier: 3,
        prompt: 'Temps et valeur : "Je lisais ce roman." Quelle valeur temporelle principale ? (un mot : passe / futur / habituel)',
        expected: 'habituel',
        readAloud: '',
      },
      {
        key: 'c4-g-07',
        minTier: 1,
        maxTier: 3,
        prompt: 'Comparaison : Ce texte est ___ long que l\'autre. (aussi / plus / moins)',
        expected: 'aussi',
        readAloud: '',
      },
      {
        key: 'c4-g-08',
        minTier: 2,
        maxTier: 3,
        prompt: 'Registre : "Tu bosses trop vite." Quel registre ? (familier / soutenu — un mot)',
        expected: 'familier',
        readAloud: '',
      },
    ],
    orthographe: [
      {
        key: 'c4-o-01',
        minTier: 1,
        maxTier: 3,
        prompt: 'Ecris correctement : une hyp______ indispensable.',
        expected: 'othese',
        readAloud: '',
      },
      {
        key: 'c4-o-02',
        minTier: 2,
        maxTier: 3,
        prompt: 'orthographe lexicale : une demarche meth______.',
        expected: 'odique',
        readAloud: '',
      },
      {
        key: 'c4-o-03',
        minTier: 1,
        maxTier: 3,
        prompt: 'Double consonne ? inte______ sant.',
        expected: 'ressante',
        readAloud: '',
      },
      {
        key: 'c4-o-04',
        minTier: 2,
        maxTier: 3,
        prompt: 'Pluriel correct des noms composes : des arcs-en___.',
        expected: 'ciel',
        readAloud: '',
      },
      {
        key: 'c4-o-05',
        minTier: 2,
        maxTier: 3,
        prompt: 'Choisis : Son expose est ____ coherent. (pleinement / pleinement memes — un seul mot attendu)',
        expected: 'pleinement',
        readAloud: '',
      },
      {
        key: 'c4-o-06',
        minTier: 1,
        maxTier: 3,
        prompt: 'Accent ou pas : il precede ___ exemple pertinent. (un)',
        expected: 'un',
        readAloud: '',
      },
      {
        key: 'c4-o-07',
        minTier: 2,
        maxTier: 3,
        prompt: 'Suffixe : une analyse syst_____.',
        expected: 'ematique',
        readAloud: '',
      },
      {
        key: 'c4-o-08',
        minTier: 2,
        maxTier: 3,
        prompt: 'Figure de style : "La ville dort." Quelle figure ? (une parole)',
        expected: 'personnification',
        readAloud: '',
      },
    ],
    lecture: [
      {
        key: 'c4-l-01',
        minTier: 2,
        maxTier: 3,
        prompt:
          'Texte :\nLe journaliste interviewe trois citoyens sur la reforme du lycee. Les opinions divergent mais restent respectueuses.\n\nQuestion : Sur quel sujet portent les interviews ?',
        expected: 'reforme du lycee',
        readAloud:
          'Le journaliste interviewe trois citoyens sur la reforme du lycee. Les opinions divergent mais restent respectueuses.',
      },
      {
        key: 'c4-l-02',
        minTier: 1,
        maxTier: 3,
        prompt:
          'Texte :\nLe narrateur evoque une enfance en banlieue puis un depart pour la capitale. La temporalite alterne passe et present.\n\nQuestion : Vers quelle ville le narrateur part-il selon le texte ?',
        expected: 'capitale',
        readAloud:
          'Le narrateur evoque une enfance en banlieue puis un depart pour la capitale. La temporalite alterne passe et present.',
      },
      {
        key: 'c4-l-03',
        minTier: 2,
        maxTier: 3,
        prompt:
          'Texte :\nL\'essayiste defend la lecture lente face aux flux numeriques. Elle valorise la concentration prolongee.\n\nQuestion : Que defend l\'essayiste face aux flux numeriques ?',
        expected: 'lecture lente',
        readAloud:
          'L\'essayiste defend la lecture lente face aux flux numeriques. Elle valorise la concentration prolongee.',
      },
      {
        key: 'c4-l-04',
        minTier: 2,
        maxTier: 3,
        prompt:
          'Texte :\nLe poeme utilise des images maritimes pour exprimer l\'incertitude. Les metaphores se repetent comme des vagues.\n\nQuestion : Quel champ lexical domine dans ce poeme ?',
        expected: 'maritime',
        readAloud:
          'Le poeme utilise des images maritimes pour exprimer l\'incertitude. Les metaphores se repetent comme des vagues.',
      },
      {
        key: 'c4-l-05',
        minTier: 1,
        maxTier: 3,
        prompt:
          'Texte :\nLa comedie ridiculise les prejuges sociaux sans caricaturer individuellement les personnages.\n\nQuestion : Que ridiculise la comedie selon le texte ?',
        expected: 'prejuges sociaux',
        readAloud:
          'La comedie ridiculise les prejuges sociaux sans caricaturer individuellement les personnages.',
      },
      {
        key: 'c4-l-06',
        minTier: 2,
        maxTier: 3,
        prompt:
          'Texte :\nLe rapport scientifique distingue correlation et causalite pour eviter les erreurs d\'interpretation.\n\nQuestion : Que distingue le rapport pour eviter les erreurs ?',
        expected: 'correlation et causalite',
        readAloud:
          'Le rapport scientifique distingue correlation et causalite pour eviter les erreurs d\'interpretation.',
      },
      {
        key: 'c4-l-07',
        minTier: 2,
        maxTier: 3,
        prompt:
          'Texte :\nLes critiques analysent la coherence narrative du roman policier et soulignent un rebondissement tardif.\n\nQuestion : Quel genre de roman est evoque ?',
        expected: 'policier',
        readAloud:
          'Les critiques analysent la coherence narrative du roman policier et soulignent un rebondissement tardif.',
      },
      {
        key: 'c4-l-08',
        minTier: 1,
        maxTier: 3,
        prompt:
          'Texte :\nLa petition demande plus de cours de soutien en francais pour les eleves en difficulte.\n\nQuestion : Quelle matiere concerne la petition ?',
        expected: 'francais',
        readAloud:
          'La petition demande plus de cours de soutien en francais pour les eleves en difficulte.',
      },
    ],
  },
  lycee: {
    dictee: [
      {
        key: 'ly-d-01',
        minTier: 1,
        maxTier: 3,
        expected: 'La proposition relative peut introduire une determination indispensable au sens.',
        readAloud: 'La proposition relative peut introduire une determination indispensable au sens.',
      },
      {
        key: 'ly-d-02',
        minTier: 2,
        maxTier: 3,
        expected: 'Les philosophes interrogent les conditions de possibilite de la connaissance.',
        readAloud: 'Les philosophes interrogent les conditions de possibilite de la connaissance.',
      },
      {
        key: 'ly-d-03',
        minTier: 2,
        maxTier: 3,
        expected: 'Une dissertation exige une problematique claire et une progression argumentative.',
        readAloud: 'Une dissertation exige une problematique claire et une progression argumentative.',
      },
      {
        key: 'ly-d-04',
        minTier: 1,
        maxTier: 3,
        expected: 'Le lycee encourage l\'autonomie dans la gestion du travail personnel.',
        readAloud: 'Le lycee encourage l\'autonomie dans la gestion du travail personnel.',
      },
      {
        key: 'ly-d-05',
        minTier: 2,
        maxTier: 3,
        expected: 'Les mutations climatiques impliquent des arbitrages politiques complexes.',
        readAloud: 'Les mutations climatiques impliquent des arbitrages politiques complexes.',
      },
      {
        key: 'ly-d-06',
        minTier: 2,
        maxTier: 3,
        expected: 'L\'ironie stylistique peut nuancer une critique sans la durcir explicitement.',
        readAloud: 'L\'ironie stylistique peut nuancer une critique sans la durcir explicitement.',
      },
      {
        key: 'ly-d-07',
        minTier: 1,
        maxTier: 3,
        expected: 'Les corpus numeriques facilitent l\'etude des variations linguistiques.',
        readAloud: 'Les corpus numeriques facilitent l\'etude des variations linguistiques.',
      },
      {
        key: 'ly-d-08',
        minTier: 2,
        maxTier: 3,
        expected: 'La citation doit etre interpretee et non seulement juxtaposee au developpement.',
        readAloud: 'La citation doit etre interpretee et non seulement juxtaposee au developpement.',
      },
    ],
    grammaire: [
      {
        key: 'ly-g-01',
        minTier: 2,
        maxTier: 3,
        prompt: 'Mode : Pour que la these ___ convaincante, il manque des exemples. (etre, subjonctif)',
        expected: 'soit',
        readAloud: '',
      },
      {
        key: 'ly-g-02',
        minTier: 1,
        maxTier: 3,
        prompt: 'Figures : "Des fleurs dans les mains du temps." Quelle figure majeure ? (une parole)',
        expected: 'metaphore',
        readAloud: '',
      },
      {
        key: 'ly-g-03',
        minTier: 2,
        maxTier: 3,
        prompt: 'Analyse : Dans "il arrive souvent que les idees evoluent", quel mode pour "evoluent" ?',
        expected: 'subjonctif',
        readAloud: '',
      },
      {
        key: 'ly-g-04',
        minTier: 2,
        maxTier: 3,
        prompt: 'Coordination vs juxtaposition : "Il lit; il ecoute." Quelle construction domine ?',
        expected: 'juxtaposition',
        readAloud: '',
      },
      {
        key: 'ly-g-05',
        minTier: 1,
        maxTier: 3,
        prompt: 'Registre : "Il fut convenu que..." Quel registre ? (soutenu / familier)',
        expected: 'soutenu',
        readAloud: '',
      },
      {
        key: 'ly-g-06',
        minTier: 2,
        maxTier: 3,
        prompt: 'Point de vue : "On pretend que..." Quel effet sur le locuteur ? (distance / implication — un mot)',
        expected: 'distance',
        readAloud: '',
      },
      {
        key: 'ly-g-07',
        minTier: 2,
        maxTier: 3,
        prompt: 'Transformation : Style indirect — Direct : "Je viendrai demain." Commence par : Elle a dit que',
        expected: 'elle viendrait demain',
        readAloud: '',
      },
      {
        key: 'ly-g-08',
        minTier: 1,
        maxTier: 3,
        prompt: 'Nature : Dans "malgre la pluie", groupe de nature ?',
        expected: 'prepositionnel',
        readAloud: '',
      },
    ],
    orthographe: [
      {
        key: 'ly-o-01',
        minTier: 2,
        maxTier: 3,
        prompt: 'Lexique soutenu : une demos______ publique.',
        expected: 'tration',
        readAloud: '',
      },
      {
        key: 'ly-o-02',
        minTier: 1,
        maxTier: 3,
        prompt: 'Graphie : para______ economique.',
        expected: 'digme',
        readAloud: '',
      },
      {
        key: 'ly-o-03',
        minTier: 2,
        maxTier: 3,
        prompt: 'Etymologie courante : ambi______ (qui peut prendre deux sens).',
        expected: 'gu',
        readAloud: '',
      },
      {
        key: 'ly-o-04',
        minTier: 2,
        maxTier: 3,
        prompt: 'Neologisme transparent : cyber______ (lie a la securite numerique).',
        expected: 'securite',
        readAloud: '',
      },
      {
        key: 'ly-o-05',
        minTier: 2,
        maxTier: 3,
        prompt: 'Locution : en ______ temps (sans accent dans ce jeu).',
        expected: 'meme',
        readAloud: '',
      },
      {
        key: 'ly-o-06',
        minTier: 1,
        maxTier: 3,
        prompt: 'Orthographe : une heir______ royale.',
        expected: 'archie',
        readAloud: '',
      },
      {
        key: 'ly-o-07',
        minTier: 2,
        maxTier: 3,
        prompt: 'Compose savant : micro______ electronique.',
        expected: 'scope',
        readAloud: '',
      },
      {
        key: 'ly-o-08',
        minTier: 2,
        maxTier: 3,
        prompt: 'Suffixe savant : une retro______ du XXe siecle.',
        expected: 'spective',
        readAloud: '',
      },
    ],
    lecture: [
      {
        key: 'ly-l-01',
        minTier: 2,
        maxTier: 3,
        prompt:
          'Texte :\nLe fragment oppose deux interpretations du meme poeme : l\'une historiciste, l\'autre formaliste.\n\nQuestion : Combien d\'interpretations oppose-t-on ?',
        expected: 'deux',
        readAloud:
          'Le fragment oppose deux interpretations du meme poeme : l\'une historiciste, l\'autre formaliste.',
      },
      {
        key: 'ly-l-02',
        minTier: 2,
        maxTier: 3,
        prompt:
          'Texte :\nL\'article scientifique insiste sur la reproductibilite des experiences avant toute generalisation.\n\nQuestion : Sur quel critere scientifique insiste-t-on avant la generalisation ?',
        expected: 'reproductibilite',
        readAloud:
          'L\'article scientifique insiste sur la reproductibilite des experiences avant toute generalisation.',
      },
      {
        key: 'ly-l-03',
        minTier: 1,
        maxTier: 3,
        prompt:
          'Texte :\nLe narrateur a premiere personne affiche une mémoire selective qui reorganise les evenements.\n\nQuestion : Quelle personne grammaticale utilise le narrateur ?',
        expected: 'premiere',
        readAloud:
          'Le narrateur a premiere personne affiche une mémoire selective qui reorganise les evenements.',
      },
      {
        key: 'ly-l-04',
        minTier: 2,
        maxTier: 3,
        prompt:
          'Texte :\nLa nouvelle explore la solitude urbaine via des silences pesants entre les dialogues.\n\nQuestion : Quel theme urbain est explore ?',
        expected: 'solitude urbaine',
        readAloud:
          'La nouvelle explore la solitude urbaine via des silences pesants entre les dialogues.',
      },
      {
        key: 'ly-l-05',
        minTier: 2,
        maxTier: 3,
        prompt:
          'Texte :\nLe pamphlet denonce la corruption institutionnelle avec une ironie mordante.\n\nQuestion : Quelle faute institutionnelle est denoncee ?',
        expected: 'corruption',
        readAloud:
          'Le pamphlet denonce la corruption institutionnelle avec une ironie mordante.',
      },
      {
        key: 'ly-l-06',
        minTier: 1,
        maxTier: 3,
        prompt:
          'Texte :\nLa tragedie place un heros confronte a un destin apparemment ineluctable.\n\nQuestion : A quoi le heros est-il confronte selon le texte ?',
        expected: 'destin',
        readAloud:
          'La tragedie place un heros confronte a un destin apparemment ineluctable.',
      },
      {
        key: 'ly-l-07',
        minTier: 2,
        maxTier: 3,
        prompt:
          'Texte :\nLe rapport sociologique croise donnees quantitatives et entretiens pour nuancer les stereotypes.\n\nQuestion : Que croise le rapport pour nuancer les stereotypes ?',
        expected: 'donnees quantitatives et entretiens',
        readAloud:
          'Le rapport sociologique croise donnees quantitatives et entretiens pour nuancer les stereotypes.',
      },
      {
        key: 'ly-l-08',
        minTier: 2,
        maxTier: 3,
        prompt:
          'Texte :\nLa critique compare deux adaptations cinematiques du meme roman du XIXe siecle.\n\nQuestion : Quel siecle pour le roman evoque ?',
        expected: 'xixe',
        readAloud:
          'La critique compare deux adaptations cinematiques du meme roman du XIXe siecle.',
      },
    ],
  },
};

function normalizeBand(band) {
  return POOLS[band] ? band : 'cycle2';
}

function tierMatch(raw, tier) {
  const lo = raw.minTier ?? 1;
  const hi = raw.maxTier ?? 3;
  return tier >= lo && tier <= hi;
}

function filterByTier(pool, tier) {
  const matched = pool.filter((r) => tierMatch(r, tier));
  return matched.length ? matched : pool;
}

function pickRaw(skill, band, tier, usedKeys, prevKey, randomInt) {
  const b = POOLS[normalizeBand(band)];
  const pool = b[skill];
  if (!pool || !pool.length) return null;
  let candidates = filterByTier(pool, tier).filter((r) => r.key !== prevKey && !usedKeys.has(r.key));
  if (!candidates.length) {
    candidates = pool.filter((r) => r.key !== prevKey && !usedKeys.has(r.key));
  }
  if (!candidates.length) {
    candidates = pool.filter((r) => r.key !== prevKey);
  }
  if (!candidates.length) {
    candidates = [...pool];
  }
  const idx = randomInt(0, candidates.length - 1);
  return candidates[idx];
}

function toApiQuestion(skill, raw) {
  if (skill === 'dictee') {
    const phrase = raw.expected;
    return {
      type: 'french-dictation',
      skill: 'dictee',
      prompt: 'Ecris la phrase dictee (elle est lue a voix haute).',
      expected: phrase,
      readAloudText: raw.readAloud || phrase,
      contentKey: raw.key,
    };
  }
  if (skill === 'lecture') {
    return {
      type: 'french-reading',
      skill: 'lecture',
      prompt: raw.prompt,
      expected: raw.expected,
      readAloudText: raw.readAloud || '',
      contentKey: raw.key,
    };
  }
  if (skill === 'grammaire') {
    return {
      type: 'french-grammar',
      skill: 'grammaire',
      prompt: raw.prompt,
      expected: raw.expected,
      readAloudText: raw.readAloud || raw.prompt || '',
      contentKey: raw.key,
    };
  }
  return {
    type: 'french-spelling',
    skill: 'orthographe',
    prompt: raw.prompt,
    expected: raw.expected,
    readAloudText: raw.readAloud || raw.prompt || '',
    contentKey: raw.key,
  };
}

/**
 * @param {object} child row SQLite children
 * @param {{ gradeBand: (g:string)=>string, randomInt: (min:number,max:number)=>number, mergeChildSubjectState: (c:any)=>any, getSubjectTier: (levels:any, sub:string)=>number }} deps
 */
function buildFrenchEvaluationQuestions(child, deps) {
  const { gradeBand, randomInt, mergeChildSubjectState, getSubjectTier } = deps;
  const band = gradeBand(child.grade);
  const tier = getSubjectTier(mergeChildSubjectState(child).levels, 'Francais');

  const skillsBase = ['dictee', 'grammaire', 'orthographe', 'lecture'];
  const skillSlots = shuffle([...skillsBase, ...skillsBase], randomInt);

  const usedKeys = new Set();
  let prevKey = null;
  const out = [];

  for (const skill of skillSlots) {
    const raw = pickRaw(skill, band, tier, usedKeys, prevKey, randomInt);
    if (!raw) continue;
    usedKeys.add(raw.key);
    prevKey = raw.key;
    out.push(toApiQuestion(skill, raw));
  }

  while (out.length < 8) {
    const fillerSkill = skillsBase[randomInt(0, skillsBase.length - 1)];
    const raw = pickRaw(fillerSkill, band, tier, usedKeys, prevKey, randomInt);
    if (!raw) break;
    usedKeys.add(raw.key);
    prevKey = raw.key;
    out.push(toApiQuestion(fillerSkill, raw));
  }

  return out.slice(0, 8);
}

module.exports = {
  buildFrenchEvaluationQuestions,
  POOLS,
};
