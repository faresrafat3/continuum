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
const ctx = {
  get(name) {
    if (name === 'goals') return { get() { return undefined } }
    if (name === 'jobs') return { list() { return [] } }
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
    async fork() { return { sessionId: 'child-session' } }
  }
}

const agent = {
  id: 'source-session',
  status: 'idle',
  session: {
    seq: 7,
    header: { id: 'source-session', cwd: '/tmp/example', agentPreset: 'continuum' },
    ownEvents() {
      return [
        { type: 'user/message', time: 1, data: { message: { content: [{ type: 'text', text: 'finish the safe slice' }] } } },
        { type: 'turn/start', time: 2, data: { turn: 1 } },
        { type: 'turn/end', time: 3, data: { turn: 1, reason: { kind: 'completed' } } },
        { type: 'assistant/message', time: 4, data: { message: { content: [{ type: 'text', text: 'verified result' }] } } }
      ]
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

agent.status = 'running'
const blocked = await fork.handler({ agent, rawInput: ' T-0001 ' })
assert.equal(blocked.kind, 'error')
assert.match(blocked.text, /running/)

console.log('continuum-handoff source test passed')
