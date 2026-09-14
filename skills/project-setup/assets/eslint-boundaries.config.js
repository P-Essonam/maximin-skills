import boundaries from "eslint-plugin-boundaries"

const featureType = "feature"
const sharedTypes = ["app-components", "app-hooks", "app-lib", "server"]

const elements = [
  { type: "app-root", pattern: "src/*.ts", mode: "full" },
  { type: "app-root", pattern: "src/*.tsx", mode: "full" },
  {
    type: featureType,
    pattern: "src/features/*",
    mode: "folder",
    capture: ["featureName"],
  },
  { type: "routes", pattern: "src/routes", mode: "folder" },
  { type: "server", pattern: "src/server", mode: "folder" },
  { type: "app-hooks", pattern: "src/hooks", mode: "folder" },
  { type: "app-components", pattern: "src/components", mode: "folder" },
  { type: "app-lib", pattern: "src/lib", mode: "folder" },
]

export const projectBoundariesConfig = [
  {
    name: "project/architecture-boundaries",
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "boundaries/elements": elements,
      "boundaries/flag-as-external": {
        outsideRootPath: true,
        customSourcePatterns: ["@workspace/**", "@tanstack/**"],
      },
      "boundaries/legacy-templates": false,
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      "boundaries/no-unknown-files": "error",
      "boundaries/no-unknown": "error",
      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          rules: [
            {
              from: { type: featureType },
              disallow: {
                to: {
                  type: featureType,
                  captured: {
                    featureName: "!{{ from.captured.featureName }}",
                  },
                },
              },
              message:
                "Features must not import other features. Move shared code to src/lib, src/hooks, src/components, or src/server.",
            },
            {
              from: { type: sharedTypes },
              disallow: { to: { type: featureType } },
              message:
                "Global shared code must not import feature code. Move the dependency into shared code.",
            },
          ],
        },
      ],
    },
  },
  {
    name: "project/feature-roots-contain-folders",
    files: ["src/features/*/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Program",
          message:
            "Feature roots contain folders only. Move this file into the feature's components, hooks, or lib folder.",
        },
      ],
    },
  },
]
