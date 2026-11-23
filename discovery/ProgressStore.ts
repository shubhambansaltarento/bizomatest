import fs from 'node:fs';
import path from 'node:path';

export interface RouteProgress {
  status: 'passed' | 'failed';
  finishedAt: string;
  error?: string;
}

/**
 * Remembers which routes a discovery run finished, so an interrupted run can resume (config
 * `resume`). One JSON file per run mode in output.stateDir.
 */
export class ProgressStore {
  private readonly file: string;
  private state: Record<string, RouteProgress>;

  constructor(stateDir: string, mode: string) {
    this.file = path.join(stateDir, `progress-${mode}.json`);
    this.state = fs.existsSync(this.file) ? (JSON.parse(fs.readFileSync(this.file, 'utf8')) as Record<string, RouteProgress>) : {};
  }

  isCompleted(routeId: string): boolean {
    return this.state[routeId]?.status === 'passed';
  }

  record(routeId: string, progress: RouteProgress) {
    this.state[routeId] = progress;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.state, null, 2));
  }

  reset() {
    this.state = {};
    fs.rmSync(this.file, { force: true });
  }
}
