import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export class SnapshotHashVerifier {
  private firecrackerRoot = "/var/firecracker";
  private kernelPath = path.join(this.firecrackerRoot, "kernel");
  private rootfsPath = path.join(this.firecrackerRoot, "rootfs");

  async verifySnapshotHash(): Promise<boolean> {
    try {
      const kernel = await this.computeFileHash(this.kernelPath);
      const rootfs = await this.computeFileHash(this.rootfsPath);

      // Store hashes for comparison across runs
      const storedSnapshot = await this.getStoredSnapshot();
      if (!storedSnapshot) {
        await this.storeSnapshot({ kernel, rootfs });
        return true;
      }

      return kernel === storedSnapshot.kernel && rootfs === storedSnapshot.rootfs;
    } catch (e) {
      console.error(`Snapshot hash verify failed: ${e}`);
      return false;
    }
  }

  async verifyFsHash(): Promise<boolean> {
    try {
      const fsHash = await this.computeDirectoryHash(this.rootfsPath);
      const storedFs = await this.getStoredFsHash();

      if (!storedFs) {
        await this.storeFsHash(fsHash);
        return true;
      }

      return fsHash === storedFs;
    } catch (e) {
      console.error(`Filesystem hash verify failed: ${e}`);
      return false;
    }
  }

  async verifyEnvHash(): Promise<boolean> {
    try {
      const envHash = this.computeEnvHash();
      const storedEnv = await this.getStoredEnvHash();

      if (!storedEnv) {
        await this.storeEnvHash(envHash);
        return true;
      }

      return envHash === storedEnv;
    } catch (e) {
      console.error(`Environment hash verify failed: ${e}`);
      return false;
    }
  }

  private async computeFileHash(filePath: string): Promise<string> {
    const data = await fs.readFile(filePath);
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  private async computeDirectoryHash(dirPath: string): Promise<string> {
    const hasher = crypto.createHash("sha256");
    const files = await fs.readdir(dirPath, { recursive: true });

    for (const file of files) {
      const filePath = path.join(dirPath, String(file));
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        const data = await fs.readFile(filePath);
        hasher.update(data);
      }
    }

    return hasher.digest("hex");
  }

  private computeEnvHash(): string {
    const envKeys = [
      "NODE_ENV",
      "DETERMINISTIC_SEED",
      "POSTGRES_URL",
      "MAAL_SLO_BUDGET_MS"
    ];

    const envValues = envKeys.map(key => process.env[key] || "").join("|");
    return crypto.createHash("sha256").update(envValues).digest("hex");
  }

  private async getStoredSnapshot(): Promise<{ kernel: string; rootfs: string } | null> {
    try {
      const data = await fs.readFile(path.join(this.firecrackerRoot, ".snapshot-hash.json"), "utf8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private async storeSnapshot(snapshot: { kernel: string; rootfs: string }): Promise<void> {
    await fs.writeFile(
      path.join(this.firecrackerRoot, ".snapshot-hash.json"),
      JSON.stringify(snapshot)
    );
  }

  private async getStoredFsHash(): Promise<string | null> {
    try {
      const data = await fs.readFile(path.join(this.firecrackerRoot, ".fs-hash"), "utf8");
      return data.trim();
    } catch {
      return null;
    }
  }

  private async storeFsHash(hash: string): Promise<void> {
    await fs.writeFile(path.join(this.firecrackerRoot, ".fs-hash"), hash);
  }

  private async getStoredEnvHash(): Promise<string | null> {
    try {
      const data = await fs.readFile(path.join(this.firecrackerRoot, ".env-hash"), "utf8");
      return data.trim();
    } catch {
      return null;
    }
  }

  private async storeEnvHash(hash: string): Promise<void> {
    await fs.writeFile(path.join(this.firecrackerRoot, ".env-hash"), hash);
  }
}
