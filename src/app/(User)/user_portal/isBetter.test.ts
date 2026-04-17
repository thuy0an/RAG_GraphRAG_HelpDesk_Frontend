/**
 * Unit tests for isBetter function
 * Run with: npx vitest run (if vitest is installed) or node --experimental-vm-modules
 *
 * Since vitest is not in package.json, these tests use inline assertions
 * that can be run with: npx tsx isBetter.test.ts
 */

// ---- Inline copy of types and function for testing ----

interface RetrievedPassage {
  content: string;
  filename: string;
  pages: number[];
}

interface QueryMetrics {
  answer?: string;
  time_total_s?: number | null;
  answer_tokens?: number | null;
  word_count?: number | null;
  relevance_score?: number | null;
  source_coverage?: number | null;
  retrieved_chunk_count?: number | null;
  retrieved_chunks?: RetrievedPassage[];
  doc_passages?: RetrievedPassage[];
  sources?: { filename: string; pages: number[] }[];
}

type MetricKey = 'time_total_s' | 'relevance_score' | 'source_coverage' | 'word_count';

function isBetter(
  metric: MetricKey,
  side: 'pac' | 'graph',
  pac: QueryMetrics | null | undefined,
  graph: QueryMetrics | null | undefined
): boolean {
  const pacVal = pac?.[metric] ?? null;
  const graphVal = graph?.[metric] ?? null;
  if (pacVal === null || graphVal === null) return false;
  if (pacVal === graphVal) return false;
  // time_total_s: thấp hơn là tốt hơn
  if (metric === 'time_total_s') {
    return side === 'pac' ? pacVal < graphVal : graphVal < pacVal;
  }
  // Các metric còn lại: cao hơn là tốt hơn
  return side === 'pac' ? pacVal > graphVal : graphVal > pacVal;
}

// ---- Test runner ----

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

// ---- Test cases ----

console.log("\n=== isBetter unit tests ===\n");

// CP-6: Quality Badge Exclusivity
// Không bao giờ cả hai side cùng true cho cùng một metric
console.log("1. Badge exclusivity – không bao giờ cả hai side cùng true");
{
  const pac: QueryMetrics = { relevance_score: 0.8 };
  const graph: QueryMetrics = { relevance_score: 0.7 };
  const pacWins = isBetter("relevance_score", "pac", pac, graph);
  const graphWins = isBetter("relevance_score", "graph", pac, graph);
  assert(!(pacWins && graphWins), "pac và graph không thể cùng true (relevance_score)");
  assert(pacWins === true, "pac thắng khi relevance_score cao hơn");
  assert(graphWins === false, "graph không thắng khi relevance_score thấp hơn");
}

{
  const pac: QueryMetrics = { time_total_s: 1.5 };
  const graph: QueryMetrics = { time_total_s: 2.0 };
  const pacWins = isBetter("time_total_s", "pac", pac, graph);
  const graphWins = isBetter("time_total_s", "graph", pac, graph);
  assert(!(pacWins && graphWins), "pac và graph không thể cùng true (time_total_s)");
}

// null → false
console.log("\n2. null → false");
{
  const pac: QueryMetrics = { relevance_score: null };
  const graph: QueryMetrics = { relevance_score: 0.7 };
  assert(isBetter("relevance_score", "pac", pac, graph) === false, "pac null → false");
  assert(isBetter("relevance_score", "graph", pac, graph) === false, "graph false khi pac null");
}

{
  const pac: QueryMetrics = { relevance_score: 0.8 };
  const graph: QueryMetrics = { relevance_score: null };
  assert(isBetter("relevance_score", "pac", pac, graph) === false, "pac false khi graph null");
  assert(isBetter("relevance_score", "graph", pac, graph) === false, "graph null → false");
}

{
  assert(isBetter("relevance_score", "pac", null, null) === false, "cả hai null → false");
  assert(isBetter("relevance_score", "pac", undefined, undefined) === false, "cả hai undefined → false");
}

// bằng nhau → false
console.log("\n3. Bằng nhau → false");
{
  const pac: QueryMetrics = { relevance_score: 0.75 };
  const graph: QueryMetrics = { relevance_score: 0.75 };
  assert(isBetter("relevance_score", "pac", pac, graph) === false, "bằng nhau → pac false");
  assert(isBetter("relevance_score", "graph", pac, graph) === false, "bằng nhau → graph false");
}

{
  const pac: QueryMetrics = { time_total_s: 1.0 };
  const graph: QueryMetrics = { time_total_s: 1.0 };
  assert(isBetter("time_total_s", "pac", pac, graph) === false, "time bằng nhau → pac false");
  assert(isBetter("time_total_s", "graph", pac, graph) === false, "time bằng nhau → graph false");
}

// time_total_s đảo chiều (thấp hơn tốt hơn)
console.log("\n4. time_total_s – thấp hơn là tốt hơn");
{
  const pac: QueryMetrics = { time_total_s: 1.0 };
  const graph: QueryMetrics = { time_total_s: 2.0 };
  assert(isBetter("time_total_s", "pac", pac, graph) === true, "pac nhanh hơn → pac thắng");
  assert(isBetter("time_total_s", "graph", pac, graph) === false, "pac nhanh hơn → graph không thắng");
}

{
  const pac: QueryMetrics = { time_total_s: 3.0 };
  const graph: QueryMetrics = { time_total_s: 1.5 };
  assert(isBetter("time_total_s", "pac", pac, graph) === false, "graph nhanh hơn → pac không thắng");
  assert(isBetter("time_total_s", "graph", pac, graph) === true, "graph nhanh hơn → graph thắng");
}

// relevance_score cao hơn tốt hơn
console.log("\n5. relevance_score – cao hơn là tốt hơn");
{
  const pac: QueryMetrics = { relevance_score: 0.9 };
  const graph: QueryMetrics = { relevance_score: 0.6 };
  assert(isBetter("relevance_score", "pac", pac, graph) === true, "pac cao hơn → pac thắng");
  assert(isBetter("relevance_score", "graph", pac, graph) === false, "pac cao hơn → graph không thắng");
}

{
  const pac: QueryMetrics = { relevance_score: 0.5 };
  const graph: QueryMetrics = { relevance_score: 0.8 };
  assert(isBetter("relevance_score", "pac", pac, graph) === false, "graph cao hơn → pac không thắng");
  assert(isBetter("relevance_score", "graph", pac, graph) === true, "graph cao hơn → graph thắng");
}

// source_coverage cao hơn tốt hơn
console.log("\n6. source_coverage – cao hơn là tốt hơn");
{
  const pac: QueryMetrics = { source_coverage: 0.8 };
  const graph: QueryMetrics = { source_coverage: 0.5 };
  assert(isBetter("source_coverage", "pac", pac, graph) === true, "pac source_coverage cao hơn → pac thắng");
  assert(isBetter("source_coverage", "graph", pac, graph) === false, "pac source_coverage cao hơn → graph không thắng");
}

// word_count cao hơn tốt hơn
console.log("\n7. word_count – cao hơn là tốt hơn");
{
  const pac: QueryMetrics = { word_count: 200 };
  const graph: QueryMetrics = { word_count: 150 };
  assert(isBetter("word_count", "pac", pac, graph) === true, "pac word_count cao hơn → pac thắng");
  assert(isBetter("word_count", "graph", pac, graph) === false, "pac word_count cao hơn → graph không thắng");
}

// ---- Summary ----
console.log(`\n=== Kết quả: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) {
  process.exit(1);
}
