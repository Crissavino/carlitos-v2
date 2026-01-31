import { DBReaderRequest, DBReaderResponse, AllowedQueryId } from "./types.js";
import { validateQuery } from "./validator.js";
import { executeQuery } from "./executor.js";
import { audit } from "../../core/audit.js";

export class DBReader {
  async execute(request: DBReaderRequest): Promise<DBReaderResponse> {
    const { query: queryId } = request;

    // 1. Validar query
    const validation = await validateQuery(queryId);

    if (!validation.valid) {
      return {
        queryId: queryId as AllowedQueryId,
        executedAt: new Date().toISOString(),
        status: "blocked",
        results: null,
        error: validation.reason,
        meta: { rowCount: 0, executionTimeMs: 0 },
      };
    }

    // 2. Ejecutar query
    const response = await executeQuery(validation.queryId!);

    return response;
  }

  async listQueries(): Promise<{ id: string; name: string; description: string }[]> {
    const { ALLOWED_QUERIES } = await import("./queries/index.js");
    return Object.values(ALLOWED_QUERIES).map((q) => ({
      id: q.id,
      name: q.name,
      description: q.description,
    }));
  }
}

export const dbReader = new DBReader();

// Re-export types
export * from "./types.js";
