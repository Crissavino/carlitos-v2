import { audit } from "../../core/audit.js";
import { permissions } from "../../core/permissions.js";
import { router } from "../../core/router.js";

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
  console.log("\n=== FASE 0: Tests de validación ===\n");

  // Test 1: AuditLog escribe correctamente
  await test("AuditLog escribe entrada", async () => {
    const id = await audit.log({
      skill: "test",
      action: "test_action",
      input: { foo: "bar" },
      output: { result: "ok" },
    });
    if (!id) throw new Error("No se generó ID");
  });

  // Test 2: AuditLog con system:router
  await test("AuditLog acepta system:router", async () => {
    const id = await audit.log({
      skill: "system:router",
      action: "test",
      input: {},
      output: {},
    });
    if (!id) throw new Error("No se generó ID");
  });

  // Test 3: Permissions bloquea DELETE en db-reader
  await test("Permissions bloquea DELETE en db-reader", async () => {
    const result = await permissions.checkPermission("db-reader", "DELETE");
    if (result.allowed) throw new Error("DELETE debería estar bloqueado");
  });

  // Test 4: Permissions permite SELECT en db-reader
  await test("Permissions permite SELECT en db-reader", async () => {
    const result = await permissions.checkPermission("db-reader", "SELECT");
    if (!result.allowed) throw new Error("SELECT debería estar permitido");
  });

  // Test 5: Router rutea "suscripciones" a db-reader
  await test("Router: suscripciones → db-reader", async () => {
    const decision = await router.route({
      id: "t1",
      timestamp: new Date().toISOString(),
      userId: "test",
      input: "dame los datos de suscripciones activas",
    });
    if (decision.skillId !== "db-reader") {
      throw new Error(`Expected db-reader, got ${decision.skillId}`);
    }
  });

  // Test 6: Router rutea "CPA campañas" a google-ads-expert
  await test("Router: CPA campañas → google-ads-expert", async () => {
    const decision = await router.route({
      id: "t2",
      timestamp: new Date().toISOString(),
      userId: "test",
      input: "analiza el CPA de las campañas",
    });
    if (decision.skillId !== "google-ads-expert") {
      throw new Error(`Expected google-ads-expert, got ${decision.skillId}`);
    }
  });

  // Test 7: Router bloquea input ambiguo (baja confianza)
  await test("Router: input ambiguo → blocked", async () => {
    const response = await router.execute({
      id: "t3",
      timestamp: new Date().toISOString(),
      userId: "test",
      input: "hola qué tal",
    });
    if (response.status !== "blocked") {
      throw new Error(`Expected blocked, got ${response.status}`);
    }
    if (!response.reasoning?.includes("confianza")) {
      throw new Error("Reason should mention confianza");
    }
  });

  // Test 8: AdminOps NO matchea "email" solo
  await test("Router: email solo → NO admin-ops", async () => {
    const decision = await router.route({
      id: "t4",
      timestamp: new Date().toISOString(),
      userId: "test",
      input: "mandame un email",
    });
    if (decision.skillId === "admin-ops" && decision.confidence >= 0.2) {
      throw new Error("email solo no debería rutear a admin-ops con confianza");
    }
  });

  // Test 9: AdminOps SÍ matchea "redactar email"
  await test("Router: redactar email → admin-ops", async () => {
    const decision = await router.route({
      id: "t5",
      timestamp: new Date().toISOString(),
      userId: "test",
      input: "redactar email de seguimiento",
    });
    if (decision.skillId !== "admin-ops") {
      throw new Error(`Expected admin-ops, got ${decision.skillId}`);
    }
  });

  // Test 10: AdminOps SÍ matchea "borrador de mensaje"
  await test("Router: borrador de mensaje → admin-ops", async () => {
    const decision = await router.route({
      id: "t6",
      timestamp: new Date().toISOString(),
      userId: "test",
      input: "borrador de mensaje para cliente",
    });
    if (decision.skillId !== "admin-ops") {
      throw new Error(`Expected admin-ops, got ${decision.skillId}`);
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

  // Verificar que hay logs
  console.log("=== Verificando AuditLog ===");
  const logs = await audit.query({});
  console.log(`Total entries en AuditLog: ${logs.length}`);
  const routerLogs = logs.filter((l) => l.skill.includes("system:router"));
  console.log(`Entries de system:router: ${routerLogs.length}`);
}

runTests().catch(console.error);
