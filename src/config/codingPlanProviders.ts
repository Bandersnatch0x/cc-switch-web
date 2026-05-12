/**
 * Coding Plan Providers Configuration
 *
 * Maps provider base URLs to their Token Plan query script templates.
 * These providers support the Anthropic-compatible /anthropic/v1/messages endpoint
 * for querying usage/token plan information.
 */

/**
 * Token Plan query script template structure
 * Matches the UsageScript code format used in UsageScriptModal.tsx
 */
export interface CodingPlanTemplate {
  /** Provider display name */
  name: string;
  /** URL pattern(s) that identify this provider */
  urlPatterns: string[];
  /** The full URL for the Anthropic messages endpoint */
  messagesEndpoint: string;
  /** Generate the query script code with optional API key placeholder */
  generateScript: (apiKey?: string) => string;
}

/**
 * Kimi (Moonshot) Coding Plan provider
 * Base URL pattern: api.kimi.com
 * Endpoint: /anthropic/v1/messages
 */
const kimiProvider: CodingPlanTemplate = {
  name: "Kimi",
  urlPatterns: ["api.kimi.com", "kimi.com"],
  messagesEndpoint: "https://api.kimi.com/anthropic/v1/messages",
  generateScript: (apiKey = "{{apiKey}}") => `({
  request: {
    url: "https://api.kimi.com/anthropic/v1/messages",
    method: "POST",
    headers: {
      "x-api-key": "${apiKey}",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }]
    })
  },
  extractor: function (response) {
    if (response.error) {
      return {
        isValid: false,
        invalidMessage: response.error.message || "Invalid API key"
      };
    }
    return {
      isValid: true,
      remaining: response.usage?.input_tokens ?? null,
      unit: "tokens"
    };
  }
})`,
};

/**
 * Zhipu (智谱) GLM Coding Plan provider
 * Base URL pattern: open.bigmodel.cn
 * Endpoint: /api/anthropic/v1/messages
 */
const zhipuProvider: CodingPlanTemplate = {
  name: "Zhipu",
  urlPatterns: ["open.bigmodel.cn", "bigmodel.cn"],
  messagesEndpoint: "https://open.bigmodel.cn/api/anthropic/v1/messages",
  generateScript: (apiKey = "{{apiKey}}") => `({
  request: {
    url: "https://open.bigmodel.cn/api/anthropic/v1/messages",
    method: "POST",
    headers: {
      "x-api-key": "${apiKey}",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }]
    })
  },
  extractor: function (response) {
    if (response.error) {
      return {
        isValid: false,
        invalidMessage: response.error.message || "Invalid API key"
      };
    }
    return {
      isValid: true,
      remaining: response.usage?.input_tokens ?? null,
      unit: "tokens"
    };
  }
})`,
};

/**
 * MiniMax Coding Plan provider
 * Base URL pattern: api.minimaxi.com
 * Endpoint: /anthropic/v1/messages
 */
const miniMaxProvider: CodingPlanTemplate = {
  name: "MiniMax",
  urlPatterns: ["api.minimaxi.com", "minimaxi.com"],
  messagesEndpoint: "https://api.minimaxi.com/anthropic/v1/messages",
  generateScript: (apiKey = "{{apiKey}}") => `({
  request: {
    url: "https://api.minimaxi.com/anthropic/v1/messages",
    method: "POST",
    headers: {
      "x-api-key": "${apiKey}",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }]
    })
  },
  extractor: function (response) {
    if (response.error) {
      return {
        isValid: false,
        invalidMessage: response.error.message || "Invalid API key"
      };
    }
    return {
      isValid: true,
      remaining: response.usage?.input_tokens ?? null,
      unit: "tokens"
    };
  }
})`,
};

/**
 * All supported coding plan providers
 */
const CODING_PLAN_PROVIDERS: CodingPlanTemplate[] = [
  kimiProvider,
  zhipuProvider,
  miniMaxProvider,
];

/**
 * Match a base URL to a coding plan provider
 * @param baseUrl The API base URL to check
 * @returns The matching provider template, or null if not a coding plan provider
 */
function matchProvider(baseUrl: string): CodingPlanTemplate | null {
  if (!baseUrl) return null;

  const normalizedUrl = baseUrl.toLowerCase().trim();

  // Extract hostname from URL
  let hostname: string;
  try {
    const urlObj = normalizedUrl.includes("://")
      ? new URL(normalizedUrl)
      : new URL(`https://${normalizedUrl}`);
    hostname = urlObj.hostname.toLowerCase();
  } catch {
    // If URL parsing fails, try matching the raw string
    hostname = normalizedUrl;
  }

  // Remove www. prefix for matching
  const hostWithoutWww = hostname.replace(/^www\./, "");

  for (const provider of CODING_PLAN_PROVIDERS) {
    for (const pattern of provider.urlPatterns) {
      if (hostWithoutWww === pattern || hostWithoutWww.endsWith(`.${pattern}`)) {
        return provider;
      }
    }
  }

  return null;
}

/**
 * Get the Token Plan query script for a given base URL
 *
 * @param baseUrl - The API base URL to check (e.g., "https://api.kimi.com/anthropic")
 * @param apiKey - Optional API key to embed in the script (defaults to "{{apiKey}}" template placeholder)
 * @returns The Token Plan query script string, or null if the base URL is not a coding plan provider
 *
 * @example
 * ```ts
 * const script = getCodingPlanScript("https://api.kimi.com/anthropic");
 * if (script) {
 *   // This is a coding plan provider, use the script
 *   console.log(script);
 * }
 * ```
 */
export function getCodingPlanScript(
  baseUrl: string,
  apiKey?: string,
): string | null {
  const provider = matchProvider(baseUrl);
  if (!provider) return null;

  return provider.generateScript(apiKey);
}

/**
 * Check if a base URL belongs to a coding plan provider
 *
 * @param baseUrl - The API base URL to check
 * @returns true if the base URL matches a known coding plan provider
 */
export function isCodingPlanProvider(baseUrl: string): boolean {
  return matchProvider(baseUrl) !== null;
}

/**
 * Get the provider info for a given base URL
 *
 * @param baseUrl - The API base URL to check
 * @returns The provider template with name and endpoint info, or null if not a coding plan provider
 */
export function getCodingPlanProviderInfo(
  baseUrl: string,
): Pick<CodingPlanTemplate, "name" | "messagesEndpoint"> | null {
  const provider = matchProvider(baseUrl);
  if (!provider) return null;

  return {
    name: provider.name,
    messagesEndpoint: provider.messagesEndpoint,
  };
}

/**
 * Get all supported coding plan provider names
 */
export function getSupportedCodingPlanProviders(): string[] {
  return CODING_PLAN_PROVIDERS.map((p) => p.name);
}
