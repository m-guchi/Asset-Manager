import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    // Override default ignores of eslint-config-next.
    globalIgnores([
        // Default ignores of eslint-config-next:
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts",
        "deploy_package/**",
        "check_db.js",
        "test-db.js",
        "debug-db.ts",
        "scripts/**",
        "public/**", // Sometimes SVGs cause issues
    ]),
]);

export default eslintConfig;
