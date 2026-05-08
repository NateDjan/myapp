'use strict';

const fs = require('node:fs');
const path = require('node:path');

const quizBanks = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'quizBanks.fr.json'), 'utf8'));

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

function toEvalQuestion(raw) {
  return {
    type: 'quiz',
    skill: 'generique',
    prompt: raw.prompt,
    expected: raw.expected,
    explanation: raw.explanation || '',
    readAloudText: raw.readAloud || raw.prompt,
    contentKey: raw.key,
  };
}

function generateQuizFromBank(subject, randomInt) {
  const bank = quizBanks[subject];
  if (!bank || bank.length === 0) {
    return {
      type: 'quiz',
      prompt: `Revision ${subject} : note une idee importante vue en cours.`,
      expected: 'idee',
      explanation: 'Discute avec ton enseignant pour preciser.',
      readAloudText: `Revision ${subject}.`,
      contentKey: 'fallback',
    };
  }
  const q = bank[randomInt(0, bank.length - 1)];
  return toEvalQuestion(q);
}

/**
 * Huit questions sans doublon de cle consecutif ; banque partagee par niveau.
 */
function buildGenericEvaluationQuestions(subject, deps) {
  const { randomInt } = deps;
  const bank = quizBanks[subject];
  if (!bank || bank.length === 0) {
    return Array.from({ length: 8 }).map(() => generateQuizFromBank(subject, randomInt));
  }
  const shuffled = shuffle([...bank], randomInt);
  const out = [];
  let prevKey = null;
  for (const raw of shuffled) {
    if (out.length >= 8) break;
    if (raw.key === prevKey && bank.length > 1) continue;
    out.push(toEvalQuestion(raw));
    prevKey = raw.key;
  }
  let guard = 0;
  while (out.length < 8 && guard < 24) {
    guard += 1;
    const raw = bank[randomInt(0, bank.length - 1)];
    const last = out[out.length - 1];
    if (last && last.contentKey === raw.key) continue;
    out.push(toEvalQuestion(raw));
  }
  return out.slice(0, 8);
}

function hasQuizBank(subject) {
  return Array.isArray(quizBanks[subject]) && quizBanks[subject].length > 0;
}

module.exports = {
  quizBanks,
  generateQuizFromBank,
  buildGenericEvaluationQuestions,
  hasQuizBank,
};
