require("dotenv").config();
const fs = require("fs");
const path = require("path");

const FRONTEND_DIR = path.join(__dirname, "../frontend");
const NETLIFY_DIR = path.join(__dirname, "../Netlify/frontend");

// Files and directories to copy
const FILES_TO_COPY = [
  // App files
  "app/globals.css",
  "app/layout.tsx",
  "app/page.tsx",
  "app/providers.tsx",
  
  // Components
  "components/AnimatedIcon.tsx",
  "components/CapitalMarkets.tsx",
  "components/ConnectWallet.tsx",
  "components/FXTrading.tsx",
  "components/LendingDashboard.tsx",
  "components/Payments.tsx",
  "components/Toast.tsx",
  "components/TokenInfo.tsx",
  "components/TokenSelector.tsx",
  
  // Contexts
  "contexts/ToastContext.tsx",
  
  // Config
  "config/contracts.ts",
  "config/tokens.ts",
  
  // Lib
  "lib/abis.ts",
  "lib/web3.ts",
  
  // Config files
  "next.config.js",
  "package.json",
  "postcss.config.js",
  "tailwind.config.js",
  "tsconfig.json",
  "next-env.d.ts",
  
  // Public
  "public/logo.png",
  "public/_redirects",
];

function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
  console.log(`✓ Copied: ${path.relative(FRONTEND_DIR, src)}`);
}

function updateNextConfig() {
  const nextConfigPath = path.join(NETLIFY_DIR, "next.config.js");
  let nextConfig = fs.readFileSync(nextConfigPath, "utf8");
  
  // Always ensure static export is enabled for Netlify (replace any conditional logic)
  if (!nextConfig.includes("output: 'export'") || nextConfig.includes("STATIC_EXPORT")) {
    // Replace conditional export logic with hardcoded export
    nextConfig = nextConfig.replace(
      /\.\.\.\(process\.env\.NODE_ENV === 'production' && process\.env\.STATIC_EXPORT === 'true' \? \{ output: 'export' \} : \{\}\)/,
      ""
    );
    nextConfig = nextConfig.replace(
      /const nextConfig = \{[\s\S]*?reactStrictMode:/,
      `const nextConfig = {
  output: 'export', // Enable static export for Netlify
  reactStrictMode:`
    );
    // If output: 'export' is not present, add it
    if (!nextConfig.includes("output: 'export'")) {
      nextConfig = nextConfig.replace(
        /const nextConfig = \{/,
        `const nextConfig = {
  output: 'export', // Enable static export for Netlify`
      );
    }
    fs.writeFileSync(nextConfigPath, nextConfig);
    console.log("✓ Updated next.config.js for static export");
  }
}

function updatePackageJson() {
  const packageJsonPath = path.join(NETLIFY_DIR, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  
  // Ensure required build dependencies are in dependencies (not devDependencies)
  const buildDeps = ["tailwindcss", "postcss", "autoprefixer"];
  let updated = false;
  
  for (const dep of buildDeps) {
    if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
      const version = packageJson.devDependencies[dep];
      if (!packageJson.dependencies[dep]) {
        packageJson.dependencies[dep] = version;
        delete packageJson.devDependencies[dep];
        updated = true;
      }
    }
  }
  
  // Add framer-motion if not present
  if (!packageJson.dependencies["framer-motion"]) {
    packageJson.dependencies["framer-motion"] = "^11.0.0";
    updated = true;
  }
  
  if (updated) {
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log("✓ Updated package.json dependencies");
  }
}

function main() {
  console.log("\n=== Bundling Frontend for Netlify ===\n");
  
  // Check if directories exist
  if (!fs.existsSync(FRONTEND_DIR)) {
    console.error("✗ Frontend directory not found:", FRONTEND_DIR);
    process.exit(1);
  }
  
  if (!fs.existsSync(NETLIFY_DIR)) {
    fs.mkdirSync(NETLIFY_DIR, { recursive: true });
    console.log("✓ Created Netlify frontend directory");
  }
  
  // Copy all files
  console.log("\n--- Copying files ---");
  let copied = 0;
  let skipped = 0;
  
  for (const file of FILES_TO_COPY) {
    const src = path.join(FRONTEND_DIR, file);
    const dest = path.join(NETLIFY_DIR, file);
    
    if (fs.existsSync(src)) {
      copyFile(src, dest);
      copied++;
    } else {
      console.log(`⚠ Skipped (not found): ${file}`);
      skipped++;
    }
  }
  
  // Update configuration files
  console.log("\n--- Updating configuration ---");
  updateNextConfig();
  updatePackageJson();
  
  // Summary
  console.log("\n=== Bundle Summary ===");
  console.log(`✓ Files copied: ${copied}`);
  console.log(`⚠ Files skipped: ${skipped}`);
  console.log(`\n✓ Bundle ready in: ${NETLIFY_DIR}`);
  console.log("\nNext steps:");
  console.log("1. Review the bundle in Netlify/frontend");
  console.log("2. Test build: cd Netlify/frontend && npm install && npm run build");
  console.log("3. Deploy to Netlify (drag & drop or git push)");
  console.log("\nNote: Make sure to set environment variables in Netlify dashboard:");
  console.log("  - NEXT_PUBLIC_ARC_RPC_URL");
  console.log("  - NEXT_PUBLIC_ARC_CHAIN_ID");
  console.log("  - STATIC_EXPORT=true (for static export)");
}

main();

