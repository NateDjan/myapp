'use strict';

const fs = require('node:fs');
const path = require('node:path');

let catalogCache = null;

function loadCatalog() {
  if (!catalogCache) {
    catalogCache = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'content', 'interestCatalog.fr.json'), 'utf8')
    );
  }
  return catalogCache;
}

function validateAndPackTheme(categoryId, favoriteId) {
  const catalog = loadCatalog();
  const cat = catalog.categories.find((c) => c.id === categoryId);
  if (!cat) return { ok: false, error: 'Categorie inconnue' };
  const opt = cat.options.find((o) => o.id === favoriteId);
  if (!opt) return { ok: false, error: 'Choix inconnu' };
  return {
    ok: true,
    theme: {
      categoryId,
      favoriteId,
      categoryLabel: cat.label,
      favoriteLabel: opt.label,
      blurb: opt.blurb || '',
    },
  };
}

/** @param {{ interest_theme_json?: string }} child */
function parseInterest(child) {
  if (!child?.interest_theme_json) return null;
  try {
    const t = JSON.parse(child.interest_theme_json);
    if (!t?.favoriteLabel) return null;
    return t;
  } catch {
    return null;
  }
}

/**
 * Enrichit une question avec le theme eleve (decor pedagogique).
 * Ne modifie jamais `expected` pour garder la correction valide.
 * @param {object} q
 * @param {{ interest_theme_json?: string }} child
 */
function applyInterestToQuestion(q, child) {
  const theme = parseInterest(child);
  if (!theme) return q;
  const label = theme.favoriteLabel;
  const blurb = theme.blurb ? ` — ${theme.blurb}` : '';
  const header = `[Univers ${label}${blurb}]\n\n`;

  const out = { ...q };

  if (out.type === 'math') {
    let intro;
    if (theme.categoryId === 'gaming') intro = `Dans l'univers de ${label}`;
    else if (theme.categoryId === 'sport') intro = `Dans le monde du ${label}`;
    else if (theme.categoryId === 'music') intro = `Sur le theme ${label}`;
    else if (theme.categoryId === 'cinema') intro = `Comme au cinema avec ${label}`;
    else if (theme.categoryId === 'creativity') intro = `En creation autour de ${label}`;
    else intro = `Theme ${label}`;
    const p = String(out.prompt || '');
    out.prompt = `${intro}, ${p.charAt(0).toLowerCase()}${p.slice(1)}`;
    return out;
  }

  if (out.type === 'french-dictation') {
    out.prompt =
      header +
      "Tu entendras un court decor thematique, puis le mot «Dictee». Ecris uniquement la phrase dictee (sans recopier le decor).\n\n" +
      (q.prompt || '');
    out.readAloudText = `Decors ${label}. Dictee : ${out.expected}`;
    return out;
  }

  if (out.type === 'history') {
    const base = String(q.prompt || '');
    out.prompt = `${header}Question :\n${base}`;
    if (theme.categoryId === 'sport') {
      out.prompt += `\n\n(Passion sport : ${label} — tu peux imaginer un lien avec ta reponse.)`;
    }
    out.readAloudText = `${label}. ${base}`;
    return out;
  }

  if (out.prompt) {
    out.prompt = header + out.prompt;
  }

  if (out.readAloudText !== undefined && out.readAloudText !== null && String(out.readAloudText).trim() !== '') {
    out.readAloudText = `${label}. ${out.readAloudText}`;
  }

  return out;
}

function applyInterestToQuestions(list, child) {
  if (!parseInterest(child)) return list;
  return list.map((q) => applyInterestToQuestion(q, child));
}

module.exports = {
  loadCatalog,
  validateAndPackTheme,
  parseInterest,
  applyInterestToQuestion,
  applyInterestToQuestions,
};
