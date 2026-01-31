import { AuditEntry } from "./types.js";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const AUDIT_DIR = "/root/.openclaw/custom-skills/data/audit";

export class AuditLog {
  private getLogPath(): string {
    const date = new Date().toISOString().split("T")[0];
    return path.join(AUDIT_DIR, `${date}.jsonl`);
  }

  async log(entry: Omit<AuditEntry, "id" | "timestamp">): Promise<string> {
    const fullEntry: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry,
    };

    const logPath = this.getLogPath();
    await fs.promises.mkdir(path.dirname(logPath), { recursive: true });
    await fs.promises.appendFile(logPath, JSON.stringify(fullEntry) + "\n");

    return fullEntry.id;
  }

  async query(filters: {
    skill?: string;
    dateFrom?: string;
    dateTo?: string;
    action?: string;
  }): Promise<AuditEntry[]> {
    const entries: AuditEntry[] = [];
    
    try {
      const files = await fs.promises.readdir(AUDIT_DIR);
      for (const file of files) {
        if (!file.endsWith(".jsonl")) continue;
        
        const date = file.replace(".jsonl", "");
        if (filters.dateFrom && date < filters.dateFrom) continue;
        if (filters.dateTo && date > filters.dateTo) continue;
        
        const content = await fs.promises.readFile(path.join(AUDIT_DIR, file), "utf-8");
        const lines = content.trim().split("\n").filter(Boolean);
        
        for (const line of lines) {
          const entry: AuditEntry = JSON.parse(line);
          if (filters.skill && !entry.skill.includes(filters.skill)) continue;
          if (filters.action && entry.action !== filters.action) continue;
          entries.push(entry);
        }
      }
    } catch (err) {
      // Directory might not exist yet
    }
    
    return entries;
  }
}

export const audit = new AuditLog();
