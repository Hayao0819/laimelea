import * as fs from "fs";
import * as path from "path";

interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  repository: string | null;
}

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"),
);

const deps = Object.keys(packageJson.dependencies || {});

const licenses: LicenseEntry[] = [];

for (const dep of deps) {
  try {
    const pkgPath = path.join(
      __dirname,
      "..",
      "node_modules",
      dep,
      "package.json",
    );
    if (!fs.existsSync(pkgPath)) continue;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    licenses.push({
      name: pkg.name || dep,
      version: pkg.version || "unknown",
      license:
        typeof pkg.license === "string"
          ? pkg.license
          : pkg.license?.type || "Unknown",
      repository:
        typeof pkg.repository === "string"
          ? pkg.repository
          : pkg.repository?.url?.replace(/^git\+/, "").replace(/\.git$/, "") ||
            null,
    });
  } catch {
    // skip unreadable packages
  }
}

licenses.sort((a, b) => a.name.localeCompare(b.name));

const outDir = path.join(__dirname, "..", "src", "generated");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(
  path.join(outDir, "licenses.json"),
  JSON.stringify(licenses, null, 2) + "\n",
);

console.log(`Generated licenses.json with ${licenses.length} entries`);
