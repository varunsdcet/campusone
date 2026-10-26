import tokens from "./tokens.json" with { type: "json" };

export const designTokens = tokens;
export type DesignTokens = typeof tokens;
export default tokens;
