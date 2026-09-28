import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

// ------------------------------------------------------------------
// ENV HELPER (Loads .env.local or .env if present)
// ------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

for (const envFile of [".env.local", ".env"]) {
  const envPath = path.join(rootDir, envFile);
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [k, ...rest] = trimmed.split("=");
        const v = rest.join("=").trim().replace(/^["']|["']$/g, "");
        if (k && !process.env[k.trim()]) {
          process.env[k.trim()] = v;
        }
      }
    }
  }
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const REPO_FULL_NAME = process.env.GITHUB_REPOSITORY || "torvicpablero-glitch/Feet-Trust";
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || "http://127.0.0.1:1234/v1/chat/completions";
const POLL_INTERVAL_MS = 10000;

const [REPO_OWNER, REPO_NAME] = REPO_FULL_NAME.includes("/")
  ? REPO_FULL_NAME.split("/")
  : ["torvicpablero-glitch", "Feet-Trust"];

const HEADERS = {
  Authorization: `token ${GITHUB_TOKEN}`,
  Accept: "application/vnd.github.v3+json",
  "User-Agent": "FeeTrust-Autonomous-Agent"
};

// Helper: Run shell command safely
function runCmd(cmd: string, cwd = rootDir): { success: boolean; output: string } {
  try {
    const output = execSync(cmd, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
    return { success: true, output: output.trim() };
  } catch (err: any) {
    const output = (err.stdout || "") + "\n" + (err.stderr || "") + "\n" + (err.message || "");
    return { success: false, output: output.trim() };
  }
}

// ------------------------------------------------------------------
// LM STUDIO INFERENCE
// ------------------------------------------------------------------
async function queryLMStudioJson(systemPrompt: string, userPrompt: string): Promise<any> {
  const response = await fetch(LM_STUDIO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "local-model",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 3072
    })
  });

  if (!response.ok) {
    throw new Error(`LM Studio HTTP ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as any;
  const rawText = data.choices?.[0]?.message?.content || "";

  // Attempt to extract JSON from response (handling markdown block ```json ... ```)
  let cleanJson = rawText;
  if (cleanJson.includes("```json")) {
    cleanJson = cleanJson.split("```json")[1].split("```")[0].trim();
  } else if (cleanJson.includes("```")) {
    cleanJson = cleanJson.split("```")[1].split("```")[0].trim();
  }

  try {
    return JSON.parse(cleanJson);
  } catch {
    return { rawText, parsed: false };
  }
}

async function queryLMStudioText(prompt: string): Promise<string> {
  const response = await fetch(LM_STUDIO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "local-model",
      messages: [
        { role: "system", content: "You are FeeTrust AI agent, an expert full-stack engineer." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2048
    })
  });

  if (!response.ok) {
    throw new Error(`LM Studio HTTP ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as any;
  return data.choices?.[0]?.message?.content || "No output generated.";
}

// ------------------------------------------------------------------
// GITHUB API
// ------------------------------------------------------------------
async function getRecentIssueComments(): Promise<any[]> {
  try {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues/comments?sort=created&direction=desc&per_page=10`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return [];
    return (await res.json()) as any[];
  } catch {
    return [];
  }
}

async function postIssueComment(commentsUrl: string, bodyText: string): Promise<boolean> {
  try {
    const res = await fetch(commentsUrl, {
      method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ body: bodyText })
    });
    return res.status === 200 || res.status === 201;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------
// AUTONOMOUS CODE EXECUTION ENGINE
// ------------------------------------------------------------------
async function processCodeEditTask(userPrompt: string, issueNumber: number): Promise<string> {
  console.log(`🔨 [Agent Task Execution]: ${userPrompt}`);

  // Step 1: Create a feature branch
  const branchName = `agent/issue-${issueNumber}-${Date.now().toString().slice(-4)}`;
  console.log(`🌿 Creating branch: ${branchName}`);
  runCmd(`git checkout -b ${branchName}`);

  // Step 2: System prompt requesting structured file edits
  const systemPrompt = `You are FeeTrust AI Autonomous Developer.
Your task is to modify project files to fulfill the user's request.
Return strictly valid JSON in the following format:
{
  "summary": "Short explanation of the code changes",
  "edits": [
    {
      "filePath": "relative/path/to/file.ext",
      "content": "Full complete text of the file"
    }
  ]
}`;

  const promptWithContext = `User Request: "${userPrompt}"\nProject Context: React 19, TypeScript, Vite, Tailwind CSS v4, Express, Supabase. Please produce the required file edits in JSON.`;

  let aiRes: any;
  try {
    aiRes = await queryLMStudioJson(systemPrompt, promptWithContext);
  } catch (err: any) {
    runCmd(`git checkout main`);
    return `❌ **Execution Failed**: Could not contact LM Studio: ${err.message}`;
  }

  // Fallback if LLM didn't return valid JSON
  if (aiRes.parsed === false || !aiRes.edits) {
    const replyText = aiRes.rawText || "No response generated.";
    runCmd(`git checkout main`);
    return `💬 **LM Studio Output (Q&A mode)**:\n\n${replyText}`;
  }

  // Step 3: Apply edits to disk
  const modifiedFiles: string[] = [];
  for (const edit of aiRes.edits) {
    if (!edit.filePath || !edit.content) continue;
    const fullPath = path.join(rootDir, edit.filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, edit.content, "utf-8");
    modifiedFiles.push(edit.filePath);
    console.log(`📝 Modified file: ${edit.filePath}`);
  }

  if (modifiedFiles.length === 0) {
    runCmd(`git checkout main`);
    return `⚠️ No file edits were produced for this request.`;
  }

  // Step 4: Run typecheck verification
  console.log("🧪 Running TypeCheck (`npm run lint`)...");
  const lintCheck = runCmd("npm run lint");

  if (!lintCheck.success) {
    console.log("❌ TypeCheck failed. Reverting changes...");
    runCmd("git reset --hard");
    runCmd("git checkout main");
    return (
      `❌ **TypeCheck Failed after code edit**:\n\n` +
      `\`\`\`\n${lintCheck.output.slice(0, 1000)}\n\`\`\`\n\n` +
      `Changes were automatically reverted for safety.`
    );
  }

  // Step 5: Commit and Push changes
  console.log("📦 Committing and pushing changes...");
  runCmd("git add .");
  runCmd(`git commit -m "feat(agent): ${userPrompt.slice(0, 50)}"`);
  const pushRes = runCmd(`git push origin ${branchName}`);

  // Return to main branch
  runCmd("git checkout main");

  if (pushRes.success) {
    return (
      `🎉 **Code Modification Complete & Pushed!**\n\n` +
      `**Summary**: ${aiRes.summary || "Applied requested edits"}\n\n` +
      `📁 **Files Modified**:\n` +
      modifiedFiles.map((f) => `- \`${f}\``).join("\n") +
      `\n\n` +
      `🌿 **Branch Pushed**: \`${branchName}\`\n` +
      `🧪 **TypeCheck**: Passed (npm run lint ✅)`
    );
  } else {
    return (
      `✅ **Local Edits Applied & Verified**, but git push encountered an issue:\n\n` +
      `\`\`\`\n${pushRes.output.slice(0, 500)}\n\`\`\``
    );
  }
}

// ------------------------------------------------------------------
// MAIN WORKER LOOP
// ------------------------------------------------------------------
async function main() {
  if (!GITHUB_TOKEN) {
    console.log("⚠️ WARNING: GITHUB_TOKEN environment variable is not set!");
  }

  console.log("==================================================");
  console.log("🤖 FeeTrust Autonomous GitHub Agent (LM Studio)");
  console.log("==================================================");
  console.log(`📍 Target Repository: ${REPO_OWNER}/${REPO_NAME}`);
  console.log(`🔗 LM Studio Endpoint: ${LM_STUDIO_URL}`);
  console.log(`⏱️  Polling Interval: ${POLL_INTERVAL_MS / 1000} seconds`);
  console.log("--------------------------------------------------");
  console.log("📱 Mobile Commands:");
  console.log("  • Ask a question: '!agent <question>'");
  console.log("  • Edit code:       '!agent edit: <instructions>' (or '!agent code: ...')");
  console.log("Press Ctrl+C to stop.\n");

  const seenCommentIds = new Set<number>();
  let initialRun = true;

  while (true) {
    try {
      const comments = await getRecentIssueComments();

      for (const comment of comments) {
        const cid = comment.id;
        const body = (comment.body || "").trim();

        if (initialRun) {
          seenCommentIds.add(cid);
          continue;
        }

        if (seenCommentIds.has(cid)) continue;
        seenCommentIds.add(cid);

        if (body.startsWith("!agent") || body.startsWith("@agent")) {
          const rawPrompt = body.includes(" ") ? body.split(" ").slice(1).join(" ") : "";
          const issueNumber = comment.issue_url ? parseInt(comment.issue_url.split("/").pop() || "1", 10) : 1;
          const commentsUrl = `${comment.issue_url}/comments`;

          if (rawPrompt.toLowerCase().startsWith("edit:") || rawPrompt.toLowerCase().startsWith("code:")) {
            // Code editing mode
            const editPrompt = rawPrompt.replace(/^(edit:|code:)/i, "").trim();
            await postIssueComment(commentsUrl, `⚙️ **Autonomous Agent Started Task**: "${editPrompt}"\nApplying code edits & testing build on local server...`);
            
            const resultReport = await processCodeEditTask(editPrompt, issueNumber);
            await postIssueComment(commentsUrl, resultReport);
          } else {
            // Q&A mode
            console.log(`\n📩 [Q&A Request from Phone]: '${rawPrompt}'`);
            const answer = await queryLMStudioText(rawPrompt || "Hello!");
            await postIssueComment(commentsUrl, `🤖 **FeeTrust Local Agent Response**:\n\n${answer}`);
          }
        }
      }

      if (initialRun) {
        initialRun = false;
        console.log("✅ Agent synchronized. Ready to answer questions or edit code from phone!");
      }
    } catch (err: any) {
      console.log(`⚠️ Unexpected loop error: ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main();
