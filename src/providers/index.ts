/**
 * Provider 检查统一入口 — migrated from check-cx lib/providers/index.ts.
 *
 * Change: concurrency now reads from Workers `env` (not process.env), and
 * p-limit is replaced by the local concurrency.ts (no Node deps).
 */

import type { CheckResult, ProviderConfig } from "#/types";
import { getErrorMessage, getSanitizedErrorDetail, logError } from "#/lib/error-handler";
import { checkWithAiSdk } from "./ai-sdk-check";
import { getCheckConcurrency } from "#/core/polling-config";
import { pLimit } from "./concurrency";

const MAX_REQUEST_ABORT_RETRIES = 2;
const REQUEST_ABORTED_PATTERN = /request was aborted\.?/i;

function shouldRetryRequestAborted(message: string | undefined): boolean {
  if (!message) {
    return false;
  }
  return REQUEST_ABORTED_PATTERN.test(message);
}

async function checkWithRetry(config: ProviderConfig): Promise<CheckResult> {
  for (let attempt = 0; attempt <= MAX_REQUEST_ABORT_RETRIES; attempt += 1) {
    try {
      const result = await checkWithAiSdk(config);
      if (
        result.status === "failed" &&
        shouldRetryRequestAborted(result.message) &&
        attempt < MAX_REQUEST_ABORT_RETRIES
      ) {
        console.warn(
          `[check-cx] ${config.name} 请求异常（Request was aborted），正在重试第 ${
            attempt + 2
          } 次`,
        );
        continue;
      }
      return result;
    } catch (error) {
      const message = getErrorMessage(error);
      if (
        shouldRetryRequestAborted(message) &&
        attempt < MAX_REQUEST_ABORT_RETRIES
      ) {
        console.warn(
          `[check-cx] ${config.name} 请求异常（Request was aborted），正在重试第 ${
            attempt + 2
          } 次`,
        );
        continue;
      }

      logError(`检查 ${config.name} (${config.type}) 失败`, error);
      return {
        id: config.id,
        name: config.name,
        type: config.type,
        endpoint: config.endpoint,
        model: config.model,
        status: "error",
        latencyMs: null,
        pingLatencyMs: null,
        checkedAt: new Date().toISOString(),
        message,
        logMessage: getSanitizedErrorDetail(error),
        groupName: config.groupName || null,
      };
    }
  }

  throw new Error("Unexpected retry loop exit");
}

interface PollingEnv {
  CHECK_CONCURRENCY?: string;
}

/**
 * 批量执行 Provider 健康检查，按名称排序返回。
 * Concurrency is read from `env` per the Workers environment spec.
 */
export async function runProviderChecks(
  configs: ProviderConfig[],
  env: PollingEnv,
): Promise<CheckResult[]> {
  if (configs.length === 0) {
    return [];
  }

  const limit = pLimit(getCheckConcurrency(env));
  const results = await Promise.all(
    configs.map((config) => limit(() => checkWithRetry(config))),
  );

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export { checkWithAiSdk } from "./ai-sdk-check";
