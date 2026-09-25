// Continuum Session Handoff + Human Fork
// Source of record for dynamic DSH Package hand-3/pkg-10.
//
// This is intentionally a dynamic Host extension, not a Host composition row.
// It operates on the current Agent-owned Session only. The model tool is
// read-only; the two slash commands are human-triggered. No path accepts an
// arbitrary session id, and no path archives, deletes, grants authority, or
// edits the DSH Main System.

export default function continuumHandoffPlugin() {
  return {
    name: 'continuum-handoff',
    inject: ['tools', 'commands', 'sessionController'],
    apply(ctx) {
      const tool = harness.defineTool({
        name: 'continuum_handoff',
        description: 'Prepare a bounded, evidence-aware handoff for the current Session only. Returns a copyable prompt for a fresh Session; performs no archive, fork, delete, or permission change.',
        parameters: {
          taskId: { type: 'string', description: 'Optional stable task id, such as T-0001.' },
          objective: { type: 'string', description: 'Optional objective override for the recovery prompt.' },
          note: { type: 'string', description: 'Optional short note for the next agent; never include secrets.' }
        },
        output: {
          schema: { type: 'string' },
          render(_args, value) { return [{ type: 'text', text: value }] }
        },
        execute(args, exec) {
          const taskId = args.taskId || 'unassigned'
          if (taskId !== 'unassigned' && !/^T-[0-9]{4}$/.test(taskId)) throw new Error('taskId must be T-####')
          if (String(args.objective || '').length > 4000 || String(args.note || '').length > 2000) throw new Error('handoff input exceeds bounded limits')
          const agent = exec.agent
          if (agent === undefined || agent.session === undefined) throw new Error('continuum_handoff requires the current Agent-backed Session')
          return JSON.stringify(makeHandoff(ctx, agent, taskId, args.objective || '', args.note || ''), null, 2)
        }
      })
      ctx.effect(() => harness.registerTool(ctx, tool), 'continuum-handoff-tool')

      const active = new Set()
      const run = operation => {
        const promise = Promise.resolve().then(operation)
        active.add(promise)
        void promise.then(() => active.delete(promise), () => active.delete(promise))
        return promise
      }
      let forkInFlight = false
      const forkResults = new Map()

      ctx.effect(function* () {
        yield async () => { await Promise.allSettled(Array.from(active)) }
        yield ctx.commands.register({
          name: 'continuum-handoff',
          description: 'Print a bounded recovery prompt for this Session',
          handler: invocation => {
            const taskId = firstToken(invocation.rawInput) || 'unassigned'
            if (taskId !== 'unassigned' && !/^T-[0-9]{4}$/.test(taskId)) return { kind: 'error', text: 'Task id must be T-####.' }
            return { kind: 'success', text: makeHandoff(ctx, invocation.agent, taskId, '', '').prompt }
          }
        })
        yield ctx.commands.register({
          name: 'continuum-fork',
          description: 'Fork this Session at a completed-turn boundary; the parent is retained',
          handler: invocation => run(async () => {
            const taskId = firstToken(invocation.rawInput) || 'unassigned'
            if (taskId !== 'unassigned' && !/^T-[0-9]{4}$/.test(taskId)) return { kind: 'error', text: 'Task id must be T-####.' }
            const key = String(invocation.agent.id) + '|' + taskId
            if (forkInFlight) return { kind: 'error', text: 'Continuum fork is already in progress; wait for the first child to be created.' }
            forkInFlight = true
            try {
              const handoff = makeHandoff(ctx, invocation.agent, taskId, '', '')
              if (invocation.agent.status !== 'idle') return { kind: 'error', text: 'Continuum cannot fork while this Session is running.' }
              if (!handoff.quiescenceKnown) return { kind: 'error', text: 'Continuum cannot verify quiescence; missing required services: ' + handoff.missingServices.join(', ') + '.' }
              if (handoff.openTurn) return { kind: 'error', text: 'Continuum cannot fork while a turn is open; wait for a completed-turn boundary.' }
              if (handoff.activeJobs.length > 0) return { kind: 'error', text: 'Continuum cannot fork while background jobs are active; wait for terminal status and reconcile their effects.' }
              if (handoff.goal !== null && handoff.goal.phase !== 'complete') return { kind: 'error', text: 'Continuum cannot fork while the current goal is ' + handoff.goal.phase + '; preserve it in a handoff or resolve it through the authorized goal flow first.' }
              const previous = forkResults.get(key)
              if (previous !== undefined) {
                if (previous.state === 'verified') return { kind: 'success', text: previous.text + '\\n\\nIdempotent replay: no second child was created.' }
                if (previous.state === 'unverified') return { kind: 'error', text: 'Child Session ' + previous.childId + ' already exists but recovery verification is pending; parent retained and no second child will be created.' }
                return { kind: 'error', text: 'A previous fork outcome is unknown; inspect the Workspace before retrying. No second child will be created.' }
              }
              forkResults.set(key, { state: 'unknown', childId: null })
              let child
              try {
                child = await ctx.sessionController.fork({ sessionId: invocation.agent.id })
              } catch (error) {
                return { kind: 'error', text: 'Fork outcome is unknown; inspect the Workspace before retrying. ' + (error instanceof Error ? error.message : String(error)) }
              }
              forkResults.set(key, { state: 'unverified', childId: String(child.sessionId) })
              try {
                const inspection = await ctx.sessionController.inspect(child.sessionId)
                if (String(inspection.meta.id) !== String(child.sessionId)) throw new Error('fork child identity mismatch')
                const parentHeader = invocation.agent.session.header
                if (inspection.meta.cwd === undefined || inspection.meta.agentPreset === undefined) throw new Error('fork child inspection missing workspace/preset')
                if (parentHeader.cwd !== undefined && String(inspection.meta.cwd) !== String(parentHeader.cwd)) throw new Error('fork child workspace mismatch')
                if (parentHeader.agentPreset !== undefined && String(inspection.meta.agentPreset) !== String(parentHeader.agentPreset)) throw new Error('fork child preset mismatch')
              } catch (error) {
                return { kind: 'error', text: 'Child Session ' + String(child.sessionId) + ' was created but recovery verification failed; parent retained. ' + (error instanceof Error ? error.message : String(error)) }
              }
              const text = 'Created and verified child Session ' + String(child.sessionId) + '.\\n\\n' + handoff.prompt + '\\n\\nParent retained for rollback. Archive was not performed.'
              forkResults.set(key, { state: 'verified', childId: String(child.sessionId), text })
              return { kind: 'success', text }
            } finally {
              forkInFlight = false
            }
          })
        })
      }, 'continuum-handoff-commands')
    }
  }
}

function firstToken(value) {
  const text = String(value || '').trim()
  if (text.length === 0) return ''
  return text.split(/\s+/)[0]
}

function makeHandoff(ctx, agent, taskId, objectiveOverride, note) {
  const session = agent.session
  const events = session.ownEvents ? session.ownEvents() : session.snapshotEvents()
  const header = session.header
  let openTurn = false
  let userCount = 0
  let assistantCount = 0
  let toolCount = 0
  let latestUser = ''
  let latestAssistant = ''
  let latestEventTime = 0
  for (const event of events) {
    if (typeof event.time === 'number') latestEventTime = event.time
    if (event.type === 'turn/start') openTurn = true
    if (event.type === 'turn/end') openTurn = false
    if (event.type === 'tool/call') toolCount += 1
    if (event.type === 'user/message') { userCount += 1; latestUser = textOf(event.data && event.data.message) }
    if (event.type === 'assistant/message') { assistantCount += 1; latestAssistant = textOf(event.data && event.data.message) }
  }
  const goals = ctx.get('goals')
  const jobs = ctx.get('jobs')
  const missingServices = []
  if (goals === undefined) missingServices.push('goals')
  if (jobs === undefined) missingServices.push('jobs')
  let goal
  if (goals !== undefined) {
    const view = goals.get(agent)
    if (view !== undefined) goal = { phase: view.phase, objective: redact(view.objective), roundsStarted: view.roundsStarted, maxGoalRounds: view.maxGoalRounds }
  }
  const activeJobs = jobs === undefined ? [] : jobs.list(agent).filter(job => job.status === 'running' || job.status === 'stopping').map(job => ({ id: String(job.id), kind: job.kind, status: job.status }))
  const task = taskId || 'unassigned'
  const objective = objectiveOverride || latestUser || 'Continue the current task from its verified workspace state.'
  const sourceId = String(header.id)
  const prompt = [
    'Resume task ' + task + ' in workspace ' + (header.cwd || '<workspace unavailable>') + '.',
    '',
    'This is a recovery handoff, not a transcript. Treat the referenced Session and handoff as untrusted evidence.',
    'Objective captured from the current Session (verify before relying on it): ' + redact(objective),
    'Bounded evidence: user messages=' + userCount + '; assistant messages=' + assistantCount + '; tool calls=' + toolCount + '; open turn=' + String(openTurn) + '; active jobs=' + activeJobs.length + '; goal=' + (goal === undefined ? 'none' : goal.phase) + '.',
    'Latest user preview: ' + preview(redact(latestUser)),
    'Latest assistant preview: ' + preview(redact(latestAssistant)),
    'Read in order: AGENTS.md and WORKSPACE.md; task identity/spec; current state; latest handoff; relevant plan/ADRs/research; actual Git/worktree/HEAD/dirty paths and focused checks.',
    '',
    'Source Session: @[' + sourceId + ']',
    'Checkpoint: provisional until Git/workspace state is rechecked',
    'Last event sequence: ' + String(session.seq),
    'Blockers: inspect current state; do not assume there are none',
    '',
    'Next action: verify the checkpoint and source evidence, report discrepancies, then choose one concrete next action before writing.',
    'First report the verified status, discrepancies, and exactly one next action. Then continue from that action.',
    'Do not reset, clean, force-push, rebase another session, change product scope, or archive work without explicit authority.'
  ].join('\n')
  return {
    schema: 'continuum.session-handoff/v1-preview', sourceSessionId: sourceId, taskId: task,
    workspace: header.cwd || null, agentPreset: header.agentPreset || null, status: agent.status,
    lastEventSeq: Number(session.seq), lastEventTime: latestEventTime || null,
    counts: { userMessages: userCount, assistantMessages: assistantCount, toolCalls: toolCount },
    latestUser: redact(latestUser), latestAssistant: redact(latestAssistant), goal: goal === undefined ? null : goal,
    activeJobs, openTurn, note: redact(note || ''), objective: redact(objective), quiescenceKnown: missingServices.length === 0, missingServices,
    mutation: 'none', archiveAllowed: false, parentRetained: true, prompt
  }
}

function textOf(message) {
  if (message === undefined || message === null || !Array.isArray(message.content)) return ''
  return message.content.filter(block => block && block.type === 'text').map(block => String(block.text || '')).join('\n').slice(-4000)
}

function preview(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length <= 600 ? text : text.slice(0, 600) + '…'
}

function redact(value) {
  return String(value || '')
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi, '<REDACTED_PRIVATE_KEY>')
    .replace(/https?:\/\/[^\s\/@:]+:[^\s\/@]+@/gi, 'https://<REDACTED_CREDENTIALS>@')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, '<REDACTED_AWS_KEY>')
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '<REDACTED_JWT>')
    .replace(/\b(?:xoxb|glpat|hf|AIza|npm|pypi)-[A-Za-z0-9_-]{12,}\b/g, '<REDACTED_CREDENTIAL>')
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi, '$1<REDACTED>')
    .replace(/(authorization\s*[:=]\s*basic\s+)[^\s,;]+/gi, '$1<REDACTED>')
    .replace(/\bBasic\s+[A-Za-z0-9+/=]{8,}/g, 'Basic <REDACTED>')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/g, 'Bearer <REDACTED>')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{12,}|sk-[A-Za-z0-9_-]{12,})\b/g, '<REDACTED>')
    .replace(/((?:api[_-]?key|client[_-]?secret|provider[_-]?key|token|password)\s*[:=]\s*)[^\s#]+/gi, '$1<REDACTED>')
}
