import readline from "node:readline";

export function confirm(question: string, defaultYes = false): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.log(`  (non-interactive shell — refusing destructive action)`);
    return Promise.resolve(false);
  }
  const suffix = defaultYes ? "[Y/n]" : "[y/N]";
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`  ${question} ${suffix} `, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (!trimmed) return resolve(defaultYes);
      resolve(trimmed === "y" || trimmed === "yes");
    });
  });
}
