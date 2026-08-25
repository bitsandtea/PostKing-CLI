/**
 * Canonical onboarding chain helper (M2 + L5).
 *
 * The full chain:
 *   onboard → mediums → mix → audience → themes → voice → visual → smart-week → finalize
 *
 * Call printNextStep(currentStep) at the end of any step command to print
 * the consistent "Next step / Then / Finally" block.
 */

type OnboardStep =
  | "onboard"
  | "mediums"
  | "mix"
  | "audience"
  | "themes"
  | "voice"
  | "visual"
  | "smart-week"
  | "finalize";

const CHAIN: OnboardStep[] = [
  "onboard",
  "mediums",
  "mix",
  "audience",
  "themes",
  "voice",
  "visual",
  "smart-week",
  "finalize",
];

const COMMANDS: Record<OnboardStep, string> = {
  "onboard":     "pking onboard <websiteUrl>",
  "mediums":     "pking brand mediums --set \"<medium,...>\"",
  "mix":         "pking brand mix",
  "audience":    "pking brand audience edit --instructions \"<describe changes>\"",
  "themes":      "pking brand themes",
  "voice":       "pking voice brand list",
  "visual":      "pking brand visual set --primary-color <hex>",
  "smart-week":  "pking brand smart-week",
  "finalize":    "pking brand finalize",
};

const HINTS: Record<OnboardStep, string> = {
  "onboard":    "crawl & analyse the brand website",
  "mediums":    "pick channels (linkedin, x/twitter, instagram, blog, seo, ...)",
  "mix":        "review + confirm content intent mix",
  "audience":   "review audience-review data — edit with AI if needed",
  "themes":     "review content themes",
  "voice":      "review voice profiles (optional)",
  "visual":     "logo + colors",
  "smart-week": "generate this week's posts",
  "finalize":   "mark onboarding complete",
};

export function getCanonicalChain(): OnboardStep[] {
  return [...CHAIN];
}

/**
 * Print the "Next step → … → Finally" block starting from the step AFTER
 * currentStep. If currentStep is the last step, prints nothing.
 */
export function printNextStep(currentStep: OnboardStep): void {
  const idx = CHAIN.indexOf(currentStep);
  if (idx === -1 || idx >= CHAIN.length - 1) return;

  const remaining = CHAIN.slice(idx + 1);
  const [next, ...rest] = remaining;

  console.log(`Next step:  ${COMMANDS[next].padEnd(50)} (${HINTS[next]})`);
  for (let i = 0; i < rest.length - 1; i++) {
    const s = rest[i];
    console.log(`Then:       ${COMMANDS[s].padEnd(50)} (${HINTS[s]})`);
  }
  if (rest.length > 0) {
    const last = rest[rest.length - 1];
    console.log(`Finally:    ${COMMANDS[last].padEnd(50)} (${HINTS[last]})`);
  }
  console.log("");
}
