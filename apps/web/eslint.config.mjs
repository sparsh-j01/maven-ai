import coreWebVitals from "eslint-config-next/core-web-vitals";

// Next 16 removed `next lint`; ESLint runs directly off this flat config now.
// eslint-config-next v16 ships flat config natively, so no FlatCompat shim.
const config = [
  {
    ignores: [".next/**", "next-env.d.ts", "public/**"],
  },
  ...coreWebVitals,
];

export default config;
