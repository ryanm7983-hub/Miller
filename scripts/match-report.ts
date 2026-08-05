/**
 * Matcher evaluation harness.
 *
 * Runs the analysis engine over the seeded demo corpus and prints the top
 * requirement matches per document, so the retrieval quality can be judged
 * against what a human would expect rather than by guesswork.
 *
 * Run with: npm run eval:matcher
 */
import { PrismaClient } from '@prisma/client';

import { analyzeDocumentHeuristically } from '../src/lib/ai/heuristics';
import { parseTags } from '../src/lib/json';
import type { RequirementRef } from '../src/lib/ai/types';
import { SEED_DOCUMENTS } from '../prisma/seed-documents';

const prisma = new PrismaClient();

/** What a quality manager would expect each document to be filed against. */
const EXPECTED: Record<string, string[]> = {
  'Quality Policy 2026.txt': ['DEMO-5.2', 'DEMO-5.1'],
  'Scope Statement 2026.txt': ['DEMO-4.1', 'DEMO-4.2'],
  'Document Control Procedure QP-001.txt': ['DEMO-7.5'],
  'Training Matrix 2026.csv': ['DEMO-7.2'],
  'Calibration Register 2026.csv': ['DEMO-8.5'],
  'Management Review Minutes.txt': ['DEMO-9.3'],
  'Internal Audit Programme 2026.csv': ['DEMO-9.2'],
  'Supplier Evaluation Records.txt': ['DEMO-8.3'],
  'Risk Register 2026.csv': ['DEMO-6.1'],
  'Nonconformance and Corrective Action Log.csv': ['DEMO-10.1', 'DEMO-8.6'],
  'Planned Maintenance Schedule.csv': ['DEMO-7.1'],
  'Goods-In Inspection Procedure QP-014.txt': ['DEMO-8.3', 'DEMO-8.6', 'DEMO-8.4'],
};

async function main() {
  const version = await prisma.frameworkVersion.findFirst({
    where: { framework: { key: 'demo-qms' } },
    include: { requirements: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!version) throw new Error('Run `npm run db:seed` first.');

  const requirements: RequirementRef[] = version.requirements.map((r) => ({
    projectRequirementId: r.identifier, // identifier doubles as the id here
    identifier: r.identifier,
    title: r.title,
    text: r.text,
    guidance: r.guidance,
    evidenceSuggestions: parseTags(r.evidenceSuggestions),
    importance: r.importance,
  }));

  let hits = 0;
  let expectedTotal = 0;
  let topOneHits = 0;
  let documentsWithNoMatch = 0;

  console.log('\nMatcher evaluation — top matches per document\n');

  for (const document of SEED_DOCUMENTS) {
    const analysis = analyzeDocumentHeuristically({
      filename: document.filename,
      mimeType: document.mimeType,
      text: document.content,
      requirements,
      today: new Date().toISOString().slice(0, 10),
      organizationName: 'Northfield Manufacturing',
      frameworkName: 'Demo Quality Management Framework',
    });

    const expected = EXPECTED[document.filename] ?? [];
    expectedTotal += expected.length;

    const matched = analysis.matches.map((m) => m.identifier);
    for (const identifier of expected) if (matched.includes(identifier)) hits++;
    if (expected.length > 0 && matched[0] === expected[0]) topOneHits++;
    if (matched.length === 0) documentsWithNoMatch++;

    const summary = analysis.matches
      .slice(0, 4)
      .map((m) => `${m.identifier}(${m.relevance.toFixed(2)}/${m.strength[0]})`)
      .join('  ');

    const ok = expected.every((identifier) => matched.includes(identifier));
    console.log(`${ok ? '✓' : '✗'} ${document.filename.padEnd(46)} ${summary || '— no matches'}`);
    if (!ok) console.log(`${' '.repeat(4)}expected: ${expected.join(', ')}`);
  }

  console.log(
    `\nRecall on expected pairs: ${hits}/${expectedTotal}` +
      `   top-1 correct: ${topOneHits}/${Object.keys(EXPECTED).length}` +
      `   documents with no match: ${documentsWithNoMatch}\n`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
