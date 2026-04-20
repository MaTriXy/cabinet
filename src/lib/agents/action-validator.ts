import cron from "node-cron";
import type { AgentAction, ActionWarning } from "@/types/actions";
import type { AgentPersona } from "./persona-manager";
import type { ConversationMeta } from "@/types/conversations";

export type PersonaLookup = Map<string, AgentPersona>;

export function personaCanDispatch(persona: AgentPersona): boolean {
  if (typeof persona.canDispatch === "boolean") return persona.canDispatch;
  return persona.type === "lead";
}

export function computeWarnings(
  meta: ConversationMeta,
  dispatcher: AgentPersona | null,
  action: AgentAction,
  personas: PersonaLookup,
  ancestorAgentSlugs: string[]
): ActionWarning[] {
  const warnings: ActionWarning[] = [];

  if (!dispatcher || !personaCanDispatch(dispatcher)) {
    warnings.push({
      code: "persona_cannot_dispatch",
      severity: "hard",
      message:
        "This agent does not have permission to assign tasks. Enable " +
        "'Can assign tasks to other team members' on its agent page.",
    });
  }

  const target = personas.get(action.agent);
  if (!target) {
    warnings.push({
      code: "unknown_agent",
      severity: "hard",
      message: `No agent named "${action.agent}" was found in this cabinet.`,
    });
  } else {
    if (target.active === false) {
      warnings.push({
        code: "inactive_target",
        severity: "soft",
        message: `${target.name} is currently inactive.`,
      });
    }
    if (
      typeof target.budget === "number" &&
      typeof target.heartbeatsUsed === "number" &&
      target.heartbeatsUsed + 1 > target.budget
    ) {
      warnings.push({
        code: "budget_low",
        severity: "soft",
        message: `${target.name} is near its monthly budget (${target.heartbeatsUsed}/${target.budget}).`,
      });
    }
  }

  if (action.type === "LAUNCH_TASK" && dispatcher && action.agent === dispatcher.slug) {
    warnings.push({
      code: "self_dispatch",
      severity: "soft",
      message: "This task is being dispatched to the same agent that proposed it.",
    });
  }

  if (ancestorAgentSlugs.includes(action.agent)) {
    warnings.push({
      code: "cycle_risk",
      severity: "soft",
      message: `${action.agent} is already part of this dispatch chain.`,
    });
  }

  const depth = (meta.spawnDepth ?? 0) + 1;
  if (depth >= 3) {
    warnings.push({
      code: "depth_warning",
      severity: "soft",
      message: `This would be ${depth} levels deep in the dispatch chain.`,
    });
  }

  if (action.type === "SCHEDULE_JOB" && !cron.validate(action.schedule)) {
    warnings.push({
      code: "invalid_schedule",
      severity: "hard",
      message: `"${action.schedule}" is not a valid cron expression.`,
    });
  }

  if (action.type === "SCHEDULE_TASK") {
    const when = new Date(action.when);
    if (Number.isNaN(when.getTime())) {
      warnings.push({
        code: "invalid_when",
        severity: "hard",
        message: `"${action.when}" is not a valid ISO datetime.`,
      });
    }
  }

  return warnings;
}

export function hasHardWarnings(warnings: ActionWarning[]): boolean {
  return warnings.some((w) => w.severity === "hard");
}
