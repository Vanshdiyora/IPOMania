import axe from "axe-core";
import type { Page } from "@playwright/test";

declare global {
  interface Window {
    axe: typeof axe;
  }
}

export async function auditAccessibility(page: Page) {
  await page.addScriptTag({ content: axe.source });
  return page.evaluate(async () => {
    const results = await window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      },
    });
    return results.violations.map(({ id, impact, help, nodes }) => ({
      id,
      impact,
      help,
      nodes: nodes.map(({ target, html }) => ({ target, html })),
    }));
  });
}
