import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class JsonStore {
  constructor(filePath, defaultValue) {
    this.filePath = filePath;
    this.defaultValue = defaultValue;
  }

  async read() {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw);
    } catch (error) {
      if (error.code === "ENOENT") {
        return structuredClone(this.defaultValue);
      }
      throw error;
    }
  }

  async write(value) {
    await mkdir(dirname(this.filePath), { recursive: true });
    const raw = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(this.filePath, raw, "utf8");
  }
}
