/**
 * Transform data using a JavaScript expression
 * The script has access to the 'item' variable containing the original data
 */
export function transformData(
  item: Record<string, unknown>,
  script?: string
): Record<string, unknown> {
  if (!script || script.trim() === "") {
    return item;
  }

  try {
    // Create a sandboxed function with limited scope
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const transformFn = new Function(
      "item",
      `
      "use strict";
      try {
        ${script}
      } catch (e) {
        return item;
      }
      `
    );

    const result = transformFn(item);
    
    // Ensure result is an object
    if (typeof result === "object" && result !== null) {
      return result as Record<string, unknown>;
    }
    
    return item;
  } catch (error) {
    console.error("Transform error:", error);
    return item;
  }
}

/**
 * Example transform scripts:
 * 
 * 1. Simple field selection:
 *    return { id: item.id, title: item.titulo, summary: item.resumo };
 * 
 * 2. Field transformation:
 *    return {
 *      ...item,
 *      title: item.titulo.toUpperCase(),
 *      tags: item.categorias.join(', ')
 *    };
 * 
 * 3. Nested data extraction:
 *    return {
 *      id: item.id,
 *      content: item.dados.texto,
 *      metadata: { author: item.autor.nome }
 *    };
 */
