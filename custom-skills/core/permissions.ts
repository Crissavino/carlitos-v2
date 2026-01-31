import * as fs from "fs";
import * as yaml from "yaml";
import { SkillId } from "./types.js";
import { audit } from "./audit.js";

const PERMISSIONS_PATH = "/root/.openclaw/custom-skills/config/permissions.yaml";

interface SkillPermissionConfig {
  enabled: boolean;
  permissions: string[];
  prohibited: string[];
  mode?: string;
  connection?: Record<string, string>;
  data_source?: string;
}

interface PermissionConfig {
  version: string;
  global: {
    destructive_actions: boolean;
    auto_execute: boolean;
    require_approval: boolean;
  };
  skills: Record<string, SkillPermissionConfig>;
}

export class PermissionChecker {
  private config: PermissionConfig | null = null;

  private loadConfig(): PermissionConfig {
    if (!this.config) {
      const content = fs.readFileSync(PERMISSIONS_PATH, "utf-8");
      this.config = yaml.parse(content);
    }
    return this.config!;
  }

  reloadConfig(): void {
    this.config = null;
    this.loadConfig();
  }

  isSkillEnabled(skillId: SkillId): boolean {
    const config = this.loadConfig();
    return config.skills[skillId]?.enabled ?? false;
  }

  getGlobalConfig(): PermissionConfig["global"] {
    return this.loadConfig().global;
  }

  async checkPermission(
    skillId: SkillId,
    action: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const config = this.loadConfig();
    const skillConfig = config.skills[skillId];

    if (!skillConfig?.enabled) {
      await audit.log({
        skill: `system:permissions`,
        action: "check",
        input: { skillId, action },
        output: { allowed: false },
        blocked: true,
        blockReason: "skill_disabled",
      });
      return { allowed: false, reason: "Skill disabled" };
    }

    if (skillConfig.prohibited.includes(action)) {
      await audit.log({
        skill: `system:permissions`,
        action: "check",
        input: { skillId, action },
        output: { allowed: false },
        blocked: true,
        blockReason: "action_prohibited",
      });
      return { allowed: false, reason: `Action "${action}" is prohibited` };
    }

    if (skillConfig.permissions.length > 0 && !skillConfig.permissions.includes(action)) {
      await audit.log({
        skill: `system:permissions`,
        action: "check",
        input: { skillId, action },
        output: { allowed: false },
        blocked: true,
        blockReason: "action_not_permitted",
      });
      return { allowed: false, reason: `Action "${action}" not in allowed list` };
    }

    return { allowed: true };
  }
}

export const permissions = new PermissionChecker();
