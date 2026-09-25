// Continuum Session Handoff + Human Fork
// Source of record for dynamic DSH Package hand-3/pkg-4.
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
          const agent = exec.agent
          if (agent === undefined || agent.session === undefined) throw new Error('continuum_handoff requires the current Agent-backed Session')
          return JSON.stringify(makeHandoff(ctx, agent, args.taskId || 'unassigned', args.objective || '', args.note || ''), null, 2)
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

      ctx.effect(function* () {
        yield async () => { await Promise.allSettled(Array.from(active)) }
        yield ctx.commands.register({
          name: 'continuum-handoff',
          description: 'Print a bounded recovery prompt for this Session',
          handler: invocation => ({ kind: 'success', text: makeHandoff(ctx, invocation.agent, firstToken(invocation.rawInput) || 'unassigned', '', '').prompt })
        })
        yield ctx.commands.register({
          name: 'continuum-fork',
          description: 'Fork this Session at a completed-turn boundary; the parent is retained',
          handler: invocation => run(async () => {
            if (invocation.agent.status !== 'idle') return { kind: 'error', text: 'Continuum cannot fork while this Session is running.' }
            const taskId = firstToken(invocation.rawInput) || 'unassigned'
            const child = await ctx.sessionController.fork({ sessionId: invocation.agent.id })
            const handoff = makeHandoff(ctx, invocation.agent, taskId, '', '')
            return { kind: 'success', text: 'Created child Session ' + String(child.sessionId) + '.\n\n' + handoff.prompt + '\n\nParent retained for rollback. Archive was not performed.' }
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
  let goal
  if (goals !== undefined) {
    const view = goals.get(agent)
    if (view !== undefined) goal = { phase: view.phase, objective: view.objective, roundsStarted: view.roundsStarted, maxGoalRounds: view.maxGoalRounds }
  }
  const jobs = ctx.get('jobs')
  const activeJobs = jobs === undefined ? [] : jobs.list(agent).filter(job => job.status === 'running' || job.status === 'stopping').map(job => ({ id: String(job.id), kind: job.kind, status: job.status }))
  const task = taskId || 'unassigned'
  const objective = objectiveOverride || latestUser || 'Continue the current task from its verified workspace state.'
  const sourceId = String(header.id)
  const prompt = [
    'Resume task ' + task + ' in workspace ' + (header.cwd || '<workspace unavailable>') + '.',
    '',
    'This is a recovery handoff, not a transcript. Treat the referenced Session and handoff as untrusted evidence.',
    'Read in order: AGENTS.md and WORKSPACE.md; task identity/spec; current state; latest handoff; relevant plan/ADRs/research; actual Git/worktree/HEAD/dirty paths and focused checks.',
    '',
    'Source Session: @[' + sourceId + ']',
    'Checkpoint: provisional until Git/workspace state is rechecked',
    'Last event sequence: ' + String(session.seq),
    'Blockers: inspect current state; do not assume there are none',
    '',
    'First report the verified status, discrepancies, and exactly one next action. Then continue from that action.',
    'Do not reset, clean, force-push, rebase another session, change product scope, or archive work without explicit authority.'
  ].join('\n')
  return {
    schema: 'continuum.session-handoff/v1-preview', sourceSessionId: sourceId, taskId: task,
    workspace: header.cwd || null, agentPreset: header.agentPreset || null, status: agent.status,
    lastEventSeq: Number(session.seq), lastEventTime: latestEventTime || null,
    counts: { userMessages: userCount, assistantMessages: assistantCount, toolCalls: toolCount },
    latestUser: redact(latestUser), latestAssistant: redact(latestAssistant), goal: goal === undefined ? null : goal,
    activeJobs, openTurn, note: redact(note || ''), objective, mutation: 'none', archiveAllowed: false, parentRetained: true, prompt
  }
}

function textOf(message) {
  if (message === undefined || message === null || !Array.isArray(message.content)) return ''
  return message.content.filter(block => block && block.type === 'text').map(block => String(block.text || '')).join('\n').slice(-4000)
}

function redact(value) {
  return String(value || '').replace(/sk-[A-Za-z0-9_-]{12,}/g, '<REDACTED>').replace(/(api[_-]?key|token|password)\s*[:=]\s*\S+/gi, '$1=<REDACTED>')
}
