import { JSONPath } from "jsonpath-plus";

type JsonValue = string | number | boolean | object | unknown[] | null;

/**
 * Extract value from JSON using JSONPath expression
 */
export function extractValue<T = unknown>(data: unknown, path: string): T | undefined {
  try {
    const results = JSONPath({ path, json: data as JsonValue, wrap: false });
    return results as T;
  } catch (error) {
    console.error(`Error extracting path "${path}":`, error);
    return undefined;
  }
}

/**
 * Extract array from JSON using JSONPath expression
 */
export function extractArray<T = unknown>(data: unknown, path: string): T[] {
  try {
    const results = JSONPath({ path, json: data as JsonValue, wrap: true });
    if (Array.isArray(results)) {
      // Flatten if it's an array of arrays
      return results.flat() as T[];
    }
    return [];
  } catch (error) {
    console.error(`Error extracting array at path "${path}":`, error);
    return [];
  }
}

/**
 * Build content string from template with JSONPath expressions
 * Template format: "Title: {{$.title}} - Description: {{$.description}}"
 */
export function buildContentFromTemplate(
  data: unknown,
  template: string
): string {
  const regex = /\{\{([^}]+)\}\}/g;
  
  return template.replace(regex, (_, path) => {
    const value = extractValue(data, path.trim());
    if (value === undefined || value === null) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  });
}

/**
 * Extract content from item using either direct path or template
 */
export function extractContent(
  item: unknown,
  contentPath: string,
  contentTemplate?: string
): string {
  if (contentTemplate) {
    return buildContentFromTemplate(item, contentTemplate);
  }
  
  const value = extractValue(item, contentPath);
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
