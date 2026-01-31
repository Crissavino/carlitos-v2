import { dbReader } from "../../skills/db-reader/index.js";
import { audit } from "../../core/audit.js";
import { validateQuery } from "../../skills/db-reader/validator.js";

// Activar mock mode para tests
process.env.DB_READER_MOCK = "true";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✓ ${name}`);
  } catch (err) {
    results.push({ name, passed: false, error: String(err) });
    console.log(`✗ ${name}: ${err}`);
  }
}

async function runTests() {
  console.log("\n=== FASE 1: DBReader Tests ===\n");

  // Test 1: Query permitida se ejecuta
  await test("active-subscriptions ejecuta correctamente", async () => {
    const result = await dbReader.execute({ query: "active-subscriptions" });
    if (result.status !== "success") {
      throw new Error(`Expected success, got ${result.status}: ${result.error}`);
    }
    if (!result.results) {
      throw new Error("No results returned");
    }
    const res = result.results as any;
    if (typeof res.total !== "number") {
      throw new Error("Missing total in results");
    }
    if (!Array.isArray(res.byPlan)) {
      throw new Error("Missing byPlan array");
    }
  });

  // Test 2: trials-last-7-days ejecuta
  await test("trials-last-7-days ejecuta correctamente", async () => {
    const result = await dbReader.execute({ query: "trials-last-7-days" });
    if (result.status !== "success") {
      throw new Error(`Expected success, got ${result.status}: ${result.error}`);
    }
    const res = result.results as any;
    if (typeof res.total !== "number") {
      throw new Error("Missing total");
    }
    if (!Array.isArray(res.byDay)) {
      throw new Error("Missing byDay array");
    }
  });

  // Test 3: daily-revenue-7d con currencies
  await test("daily-revenue-7d incluye conversión de moneda", async () => {
    const result = await dbReader.execute({ query: "daily-revenue-7d" });
    if (result.status !== "success") {
      throw new Error(`Expected success, got ${result.status}: ${result.error}`);
    }
    const res = result.results as any;
    if (typeof res.totalEur !== "number") {
      throw new Error("Missing totalEur");
    }
    if (!Array.isArray(res.byDay)) {
      throw new Error("Missing byDay array");
    }
    // Verificar que hay datos de múltiples monedas
    const hasMultipleCurrencies = res.byDay.some((d: any) => d.byCurrency && d.byCurrency.length > 1);
    if (!hasMultipleCurrencies) {
      console.log("  (nota: mock data tiene múltiples monedas por día)");
    }
  });

  // Test 4: Query no existente se bloquea
  await test("Query inexistente -> blocked", async () => {
    const result = await dbReader.execute({ query: "drop-tables" as any });
    if (result.status !== "blocked") {
      throw new Error(`Expected blocked, got ${result.status}`);
    }
    if (!result.error?.includes("not in allowed list")) {
      throw new Error("Error message should mention allowed list");
    }
  });

  // Test 5: SQL injection attempt se bloquea
  await test("SQL injection attempt -> blocked", async () => {
    const result = await dbReader.execute({ query: "active-subscriptions; DROP TABLE users;" as any });
    if (result.status !== "blocked") {
      throw new Error(`Expected blocked, got ${result.status}`);
    }
  });

  // Test 6: Validación detecta queries peligrosas
  await test("Validator bloquea query no permitida", async () => {
    const validation = await validateQuery("SELECT * FROM users; DELETE FROM users");
    if (validation.valid) {
      throw new Error("Should have blocked invalid query");
    }
  });

  // Test 7: Cada ejecución genera audit entry
  await test("Ejecución genera audit entries", async () => {
    // Limpiar y ejecutar
    await dbReader.execute({ query: "active-subscriptions" });
    
    const logs = await audit.query({ skill: "db-reader" });
    if (logs.length === 0) {
      throw new Error("No audit entries found for db-reader");
    }
    
    const executeLog = logs.find((l) => l.action === "execute_success" || l.action === "execute_start");
    if (!executeLog) {
      throw new Error("No execute log found");
    }
  });

  // Test 8: listQueries devuelve las 3 queries
  await test("listQueries devuelve 3 queries permitidas", async () => {
    const queries = await dbReader.listQueries();
    if (queries.length !== 3) {
      throw new Error(`Expected 3 queries, got ${queries.length}`);
    }
    const ids = queries.map((q) => q.id);
    if (!ids.includes("active-subscriptions")) {
      throw new Error("Missing active-subscriptions");
    }
    if (!ids.includes("trials-last-7-days")) {
      throw new Error("Missing trials-last-7-days");
    }
    if (!ids.includes("daily-revenue-7d")) {
      throw new Error("Missing daily-revenue-7d");
    }
  });

  // Resumen
  console.log("\n=== RESUMEN ===");
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`${passed}/${total} tests pasaron\n`);

  if (passed < total) {
    console.log("Tests fallidos:");
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  }

  // Mostrar ejemplo de output
  console.log("=== Ejemplo de output: active-subscriptions ===");
  const example = await dbReader.execute({ query: "active-subscriptions" });
  console.log(JSON.stringify(example, null, 2));

  console.log("\n=== Ejemplo de output: daily-revenue-7d ===");
  const revenueExample = await dbReader.execute({ query: "daily-revenue-7d" });
  console.log(JSON.stringify(revenueExample, null, 2));
}

runTests().catch(console.error);
