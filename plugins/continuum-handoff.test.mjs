import assert from 'node:assert/strict'

let registeredTool
const commands = new Map()
globalThis.harness = {
  defineTool(definition) { return definition },
  registerTool(_ctx, definition) {
    registeredTool = definition
    return () => { registeredTool = undefined }
  }
}

const { default: createPlugin } = await import('./continuum-handoff.js')
let jobRows = []
let goalView
let forkCalls = 0
let missingServices = false
let inspectFailures = 0
let omitChildFields = false
const ctx = {
  get(name) {
    if (missingServices) return undefined
    if (name === 'goals') return { get() { return goalView } }
    if (name === 'jobs') return { list() { return jobRows } }
    return undefined
  },
  effect(effect) {
    if (effect.constructor.name === 'GeneratorFunction') {
      const iterator = effect()
      let step = iterator.next()
      while (!step.done) step = iterator.next(step.value)
    } else {
      effect()
    }
    return () => {}
  },
  commands: {
    register(definition) {
      commands.set(definition.name, definition)
      return () => commands.delete(definition.name)
    }
  },
  sessionController: {
    async fork() {
      forkCalls += 1
      await new Promise(resolve => setTimeout(resolve, 5))
      return { sessionId: 'child-session' }
    },
    async inspect(id) {
      if (inspectFailures > 0) { inspectFailures -= 1; throw new Error('temporary inspect failure') }
      return { meta: { id: String(id), ...(omitChildFields ? {} : { cwd: '/tmp/example', agentPreset: 'continuum' }) } }
    }
  }
}

let openTurn = false
const agent = {
  id: 'source-session',
  status: 'idle',
  session: {
    seq: 7,
    header: { id: 'source-session', cwd: '/tmp/example', agentPreset: 'continuum' },
    ownEvents() {
      const events = [
        { type: 'user/message', time: 1, data: { message: { content: [{ type: 'text', text: 'finish the safe slice' }] } } },
        { type: 'turn/start', time: 2, data: { turn: 1 } },
        { type: 'turn/end', time: 3, data: { turn: 1, reason: { kind: 'completed' } } },
        { type: 'assistant/message', time: 4, data: { message: { content: [{ type: 'text', text: 'verified result' }] } } }
      ]
      if (openTurn) events.push({ type: 'turn/start', time: 5, data: { turn: 2 } })
      return events
    }
  }
}

const plugin = createPlugin()
plugin.apply(ctx)
assert.ok(registeredTool)
const preview = JSON.parse(registeredTool.execute({ taskId: 'T-0001' }, { agent }))
assert.equal(preview.sourceSessionId, 'source-session')
assert.equal(preview.mutation, 'none')
assert.equal(preview.archiveAllowed, false)
assert.equal(preview.parentRetained, true)
assert.match(preview.prompt, /@\[source-session\]/)
assert.match(preview.prompt, /T-0001/)
const redactedPreview = JSON.parse(registeredTool.execute({ taskId: 'T-0001', objective: 'client_secret=supersecret', note: 'Authorization: Bearer abcdefghijklmnop' }, { agent }))
assert.ok(!JSON.stringify(redactedPreview).includes('supersecret'))
assert.ok(!JSON.stringify(redactedPreview).includes('abcdefghijklmnop'))
assert.throws(() => registeredTool.execute({ taskId: '../../escape', objective: '' }, { agent }))
assert.throws(() => registeredTool.execute({ taskId: 'T-0001', objective: 'x'.repeat(4001) }, { agent }))

const handoff = commands.get('continuum-handoff')
assert.ok(handoff)
const handoffResult = handoff.handler({ agent, rawInput: ' T-0001 ' })
assert.equal(handoffResult.kind, 'success')
assert.match(handoffResult.text, /T-0001/)

const fork = commands.get('continuum-fork')
assert.ok(fork)
const forkResult = await fork.handler({ agent, rawInput: ' T-0001 ' })
assert.equal(forkResult.kind, 'success')
assert.match(forkResult.text, /child-session/)
assert.match(forkResult.text, /Parent retained/)

const concurrent = await Promise.all([
  fork.handler({ agent, rawInput: ' T-0002 ' }),
  fork.handler({ agent, rawInput: ' T-0002 ' })
])
assert.equal(concurrent.filter(result => result.kind === 'success').length, 1)
assert.equal(concurrent.filter(result => result.kind === 'error').length, 1)
assert.equal(forkCalls, 2)
const idempotent = await fork.handler({ agent, rawInput: ' T-0002 ' })
assert.equal(idempotent.kind, 'success')
assert.match(idempotent.text, /Idempotent replay/)
assert.equal(forkCalls, 2)
inspectFailures = 1
const firstInspectFailure = await fork.handler({ agent, rawInput: ' T-0004 ' })
assert.equal(firstInspectFailure.kind, 'error')
const callsAfterInspectFailure = forkCalls
const retryAfterInspectFailure = await fork.handler({ agent, rawInput: ' T-0004 ' })
assert.equal(retryAfterInspectFailure.kind, 'error')
assert.equal(forkCalls, callsAfterInspectFailure)
omitChildFields = true
const missingChildFields = await fork.handler({ agent, rawInput: ' T-0005 ' })
assert.equal(missingChildFields.kind, 'error')
const callsAfterMissingFields = forkCalls
assert.equal((await fork.handler({ agent, rawInput: ' T-0005 ' })).kind, 'error')
assert.equal(forkCalls, callsAfterMissingFields)
omitChildFields = false

jobRows = [{ id: 'job-1', kind: 'test', status: 'running' }]
const jobBlocked = await fork.handler({ agent, rawInput: ' T-0001 ' })
assert.equal(jobBlocked.kind, 'error')
assert.match(jobBlocked.text, /background jobs/)
jobRows = []
goalView = { phase: 'active', objective: 'do work', roundsStarted: 1, maxGoalRounds: 3 }
const goalBlocked = await fork.handler({ agent, rawInput: ' T-0001 ' })
assert.equal(goalBlocked.kind, 'error')
assert.match(goalBlocked.text, /goal is active/)
goalView = { phase: 'paused', objective: 'do work', roundsStarted: 1, maxGoalRounds: 3 }
const pausedBlocked = await fork.handler({ agent, rawInput: ' T-0001 ' })
assert.equal(pausedBlocked.kind, 'error')
assert.match(pausedBlocked.text, /goal is paused/)
goalView = undefined
openTurn = true
const turnBlocked = await fork.handler({ agent, rawInput: ' T-0001 ' })
assert.equal(turnBlocked.kind, 'error')
assert.match(turnBlocked.text, /turn is open/)
openTurn = false
missingServices = true
const missingBlocked = await fork.handler({ agent, rawInput: ' T-0001 ' })
assert.equal(missingBlocked.kind, 'error')
assert.match(missingBlocked.text, /missing required services/)
missingServices = false

agent.status = 'running'
const blocked = await fork.handler({ agent, rawInput: ' T-0001 ' })
assert.equal(blocked.kind, 'error')
assert.match(blocked.text, /running/)

console.log('continuum-handoff source test passed')
