import { SkillId, SkillRequest, SkillResponse, SystemComponent } from "./types.js";
import { audit } from "./audit.js";
import { permissions } from "./permissions.js";

interface RouteDecision {
  skillId: SkillId;
  confidence: number;
  reasoning: string;
}

const MIN_CONFIDENCE = 0.2;

const SKILL_PATTERNS: Record<Exclude<SkillId, "system">, RegExp[]> = {
  "db-reader": [
    /\b(query|consulta|datos|database|db|tabla|select|registros|suscripciones?|trials?|revenue)\b/i,
  ],
  "google-ads-expert": [
    /\b(ads?|google\s*ads|campaña|campaign|cpa|roas|ctr|clicks?|impressions?|conversions?|adwords)\b/i,
  ],
  "business-expert": [
    /\b(kpi|métricas?|prioridad|backlog|decisión|experimento|negocio|business|strategy)\b/i,
  ],
  "dev-expert": [
    /\b(código|code|repo|github|pr|pull\s*request|arquitectura|refactor|bug|file|archivo)\b/i,
  ],
  "admin-ops": [
    /\b(tarea|task|pendiente|recordatorio|reminder|checklist|organizar|admin)\b/i,
    /\b(redactar|borrador|draft)\s+(de\s+)?(email|mensaje|mail|message)\b/i,
    /\b(preparar|escribir)\s+(email|mensaje|respuesta)\b/i,
  ],
};

async function logSystem(
  component: SystemComponent,
  action: string,
  input: unknown,
  output: unknown,
  decision?: string
) {
  return audit.log({
    skill: `system:${component}`,
    action,
    input,
    output,
    decision,
  });
}

export class SkillRouter {
  async route(request: SkillRequest): Promise<RouteDecision> {
    const input = request.input.toLowerCase();
    const scores: Record<Exclude<SkillId, "system">, number> = {
      "db-reader": 0,
      "google-ads-expert": 0,
      "business-expert": 0,
      "dev-expert": 0,
      "admin-ops": 0,
    };

    // Scoring por patrones
    for (const [skillId, patterns] of Object.entries(SKILL_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(input)) {
          scores[skillId as Exclude<SkillId, "system">] += 1;
        }
      }
    }

    // Encontrar skill con mayor score
    const entries = Object.entries(scores) as [Exclude<SkillId, "system">, number][];
    entries.sort((a, b) => b[1] - a[1]);

    const [topSkill, topScore] = entries[0];
    const confidence = topScore > 0 ? Math.min(topScore / 3, 1) : 0;

    const decision: RouteDecision = {
      skillId: topSkill,
      confidence,
      reasoning: `Matched ${topScore} pattern(s) for ${topSkill}`,
    };

    // Log de la decisión de routing
    await logSystem(
      "router",
      "route",
      { userInput: request.input },
      decision,
      `Routed to ${topSkill} with confidence ${(confidence * 100).toFixed(0)}%`
    );

    return decision;
  }

  async execute(request: SkillRequest): Promise<SkillResponse> {
    const decision = await this.route(request);

    // Verificar confianza mínima
    if (decision.confidence < MIN_CONFIDENCE) {
      await logSystem(
        "router",
        "blocked_low_confidence",
        { userInput: request.input, confidence: decision.confidence },
        { blocked: true },
        `Confidence ${(decision.confidence * 100).toFixed(0)}% below threshold ${MIN_CONFIDENCE * 100}%`
      );
      return {
        skillId: decision.skillId,
        requestId: request.id,
        status: "blocked",
        output: null,
        reasoning: `No se pudo determinar skill con confianza suficiente (${(decision.confidence * 100).toFixed(0)}% < ${MIN_CONFIDENCE * 100}% requerido)`,
      };
    }

    // Verificar permisos
    if (!permissions.isSkillEnabled(decision.skillId)) {
      await logSystem(
        "router",
        "blocked_skill_disabled",
        { userInput: request.input, skillId: decision.skillId },
        { blocked: true },
        `Skill ${decision.skillId} is disabled`
      );
      return {
        skillId: decision.skillId,
        requestId: request.id,
        status: "blocked",
        output: null,
        reasoning: `Skill ${decision.skillId} is disabled`,
      };
    }

    // Aquí se llamaría al skill correspondiente
    return {
      skillId: decision.skillId,
      requestId: request.id,
      status: "success",
      output: { routedTo: decision.skillId },
      reasoning: decision.reasoning,
    };
  }
}

export const router = new SkillRouter();
