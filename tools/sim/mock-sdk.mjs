/**
 * A stand-in Decentraland runtime, good enough to play the game headlessly.
 *
 * The scene's real host is the Explorer: a native/WASM client we cannot run in
 * CI, and cannot step frame by frame even when we can run it. So the simulator
 * substitutes this module for `@dcl/sdk/*` at bundle time and drives the scene
 * directly — call `main()`, pump systems with a fixed dt, and invoke the pointer
 * callbacks the scene registered on its own star entities.
 *
 * Two deliberate choices:
 *
 *  - `@dcl/sdk/math` is NOT mocked. The bundler aliases it to the real
 *    `@dcl/ecs-math`, because the projection maths (dome positions, quaternion
 *    line rotations) is exactly the kind of thing a fake would paper over.
 *
 *  - Unknown component names resolve through a Proxy to a generic component
 *    rather than throwing. New modules add new SDK surface constantly; a mock
 *    that fails closed would turn every new component into a simulator bug.
 *    Anything actually asserted on is defined explicitly below.
 */

// ── entity + component store ────────────────────────────────────────────────
let nextEntity = 512
const componentsByName = new Map()

export const world = {
  entities: new Set(),
  systems: [],
  pointerHandlers: [],   // { entity, opts, callback } in registration order
  syncedEntities: [],
  uiRenderer: null,
  audioEvents: [],
  materialWrites: 0,
  transformWrites: 0,
  errors: []
}

function makeComponent(componentName, buildDefault = () => ({})) {
  const data = new Map()
  const comp = {
    componentName,
    componentId: hashId(componentName),
    _data: data,
    create(entity, value) {
      const v = { ...buildDefault(), ...(value ?? {}) }
      data.set(entity, v)
      return v
    },
    createOrReplace(entity, value) {
      return comp.create(entity, value)
    },
    getMutable(entity) {
      const v = data.get(entity)
      if (!v) throw new Error(`${componentName}.getMutable on entity ${entity} with no component`)
      return v
    },
    getMutableOrNull(entity) {
      return data.get(entity) ?? null
    },
    get(entity) {
      const v = data.get(entity)
      if (!v) throw new Error(`${componentName}.get on entity ${entity} with no component`)
      return v
    },
    getOrNull(entity) {
      return data.get(entity) ?? null
    },
    getOrCreateMutable(entity, value) {
      return data.get(entity) ?? comp.create(entity, value)
    },
    has(entity) {
      return data.has(entity)
    },
    deleteFrom(entity) {
      data.delete(entity)
    },
    *iterator() {
      for (const [e, v] of data) yield [e, v]
    }
  }
  componentsByName.set(componentName, comp)
  return comp
}

function hashId(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// ── the components the scene actually reads back ────────────────────────────
export const Transform = makeComponent('core::Transform', () => ({
  position: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  parent: 0
}))

export const VisibilityComponent = makeComponent('core::VisibilityComponent', () => ({ visible: true }))
export const Billboard = makeComponent('core::Billboard', () => ({ billboardMode: 0 }))

const _material = makeComponent('core::Material')
export const Material = Object.assign(_material, {
  setPbrMaterial(entity, props) {
    // Counted, not just stored. On the real client a material write is a CRDT
    // message and a shader-parameter update, and it is the single easiest way
    // for an "animated" scene to quietly cost more than it can afford on a
    // phone. The runner asserts a budget against this number.
    world.materialWrites++
    _material.createOrReplace(entity, { kind: 'pbr', ...props })
  },
  setBasicMaterial(entity, props) {
    _material.createOrReplace(entity, { kind: 'basic', ...props })
  },
  Texture: {
    Common: (opts) => ({ tex: { $case: 'texture', texture: { ...opts } } }),
    Avatar: (opts) => ({ tex: { $case: 'avatarTexture', avatarTexture: { ...opts } } }),
    Video: (opts) => ({ tex: { $case: 'videoTexture', videoTexture: { ...opts } } })
  }
})

const _meshRenderer = makeComponent('core::MeshRenderer')
export const MeshRenderer = Object.assign(_meshRenderer, {
  setBox: (e, uvs) => _meshRenderer.createOrReplace(e, { mesh: 'box', uvs }),
  setPlane: (e, uvs) => _meshRenderer.createOrReplace(e, { mesh: 'plane', uvs }),
  setSphere: (e) => _meshRenderer.createOrReplace(e, { mesh: 'sphere' }),
  setCylinder: (e, top, bottom) => _meshRenderer.createOrReplace(e, { mesh: 'cylinder', top, bottom })
})

const _meshCollider = makeComponent('core::MeshCollider')
export const MeshCollider = Object.assign(_meshCollider, {
  setBox: (e, layer) => _meshCollider.createOrReplace(e, { mesh: 'box', layer }),
  setPlane: (e, layer) => _meshCollider.createOrReplace(e, { mesh: 'plane', layer }),
  setSphere: (e, layer) => _meshCollider.createOrReplace(e, { mesh: 'sphere', layer }),
  setCylinder: (e, layer, top, bottom) =>
    _meshCollider.createOrReplace(e, { mesh: 'cylinder', layer, top, bottom })
})

const _audio = makeComponent('core::AudioSource', () => ({
  playing: false, loop: false, volume: 1, pitch: 1, audioClipUrl: ''
}))
export const AudioSource = Object.assign(_audio, {
  create(entity, value) {
    const v = makeComponent.prototype // placeholder, replaced below
    return _audioCreate(entity, value)
  }
})
function _audioCreate(entity, value) {
  const v = {
    playing: false, loop: false, volume: 1, pitch: 1, audioClipUrl: '',
    ...(value ?? {})
  }
  _audio._data.set(entity, v)
  if (v.playing) world.audioEvents.push({ entity, url: v.audioClipUrl, volume: v.volume, pitch: v.pitch, loop: v.loop })
  return v
}
AudioSource.create = _audioCreate
AudioSource.createOrReplace = _audioCreate
/** The SDK's extended helper: a fresh PUT with currentTime reset, which is how
 *  the scene retriggers a voice that is already playing the same clip. */
AudioSource.playSound = (entity, url, resetCursor = true) => {
  const prev = _audio._data.get(entity) ?? {}
  return _audioCreate(entity, { ...prev, audioClipUrl: url, playing: true, currentTime: resetCursor ? 0 : prev.currentTime })
}
AudioSource.stopSound = (entity) => {
  const prev = _audio._data.get(entity)
  if (prev) prev.playing = false
}

export const TextShape = makeComponent('core::TextShape', () => ({ text: '' }))
export const PointerEvents = makeComponent('core::PointerEvents')
export const GltfContainer = makeComponent('core::GltfContainer')
export const Animator = makeComponent('core::Animator')
export const Tween = makeComponent('core::Tween')
export const TweenSequence = makeComponent('core::TweenSequence')

// ── schemas ─────────────────────────────────────────────────────────────────
const prim = (d) => ({ __schema: true, default: () => d })
export const Schemas = {
  Boolean: prim(false),
  Bool: prim(false),
  Int: prim(0),
  Int64: prim(0),
  Number: prim(0),
  Float: prim(0),
  Double: prim(0),
  Byte: prim(0),
  Short: prim(0),
  String: prim(''),
  EntityId: prim(0),
  Vector3: { __schema: true, default: () => ({ x: 0, y: 0, z: 0 }) },
  Quaternion: { __schema: true, default: () => ({ x: 0, y: 0, z: 0, w: 1 }) },
  Color3: { __schema: true, default: () => ({ r: 0, g: 0, b: 0 }) },
  Color4: { __schema: true, default: () => ({ r: 0, g: 0, b: 0, a: 1 }) },
  Array: (inner) => ({ __schema: true, default: () => [] , inner }),
  Map: (spec) => ({ __schema: true, default: () => defaultsOf(spec), spec }),
  Optional: (inner) => ({ __schema: true, default: () => undefined, inner }),
  Enum: () => prim(0),
  OneOf: () => prim(undefined)
}

function defaultsOf(spec) {
  const out = {}
  for (const [k, s] of Object.entries(spec)) {
    out[k] = s && typeof s.default === 'function' ? s.default() : undefined
  }
  return out
}

// ── engine ──────────────────────────────────────────────────────────────────
export const engine = {
  RootEntity: 0,
  PlayerEntity: 1,
  CameraEntity: 2,

  addEntity() {
    const e = nextEntity++
    world.entities.add(e)
    return e
  },
  addTransformEntity() {
    return engine.addEntity()
  },
  removeEntity(e) {
    world.entities.delete(e)
    for (const c of componentsByName.values()) c._data.delete(e)
  },
  addSystem(fn, priority = 0, name = fn.name || 'system') {
    world.systems.push({ fn, priority, name })
    world.systems.sort((a, b) => b.priority - a.priority)
  },
  removeSystem(target) {
    const i = world.systems.findIndex((s) => s.fn === target || s.name === target)
    if (i >= 0) world.systems.splice(i, 1)
    return i >= 0
  },
  defineComponent(name, spec) {
    if (componentsByName.has(name)) return componentsByName.get(name)
    return makeComponent(name, () => defaultsOf(spec))
  },
  getComponent(name) {
    return componentsByName.get(name)
  },
  getEntitiesWith(...comps) {
    const [first, ...rest] = comps
    const out = []
    for (const [e, v] of first._data) {
      if (rest.every((c) => c._data.has(e))) out.push([e, v, ...rest.map((c) => c._data.get(e))])
    }
    return out
  },
  update(dt) {
    for (const s of world.systems) s.fn(dt)
  }
}

// ── enums ───────────────────────────────────────────────────────────────────
export const InputAction = {
  IA_POINTER: 0, IA_PRIMARY: 1, IA_SECONDARY: 2, IA_ANY: 3,
  IA_FORWARD: 4, IA_BACKWARD: 5, IA_RIGHT: 6, IA_LEFT: 7, IA_JUMP: 8,
  IA_WALK: 9, IA_ACTION_3: 10, IA_ACTION_4: 11, IA_ACTION_5: 12, IA_ACTION_6: 13
}
export const PointerEventType = { PET_UP: 0, PET_DOWN: 1, PET_HOVER_ENTER: 2, PET_HOVER_LEAVE: 3 }
export const ColliderLayer = { CL_NONE: 0, CL_POINTER: 1, CL_PHYSICS: 2, CL_RESERVED1: 4, CL_CUSTOM1: 64 }
export const BillboardMode = { BM_NONE: 0, BM_X: 1, BM_Y: 2, BM_Z: 4, BM_ALL: 7 }
export const MaterialTransparencyMode = {
  MTM_OPAQUE: 0, MTM_ALPHA_TEST: 1, MTM_ALPHA_BLEND: 2,
  MTM_ALPHA_TEST_AND_ALPHA_BLEND: 3, MTM_AUTO: 4
}
export const AvatarAnchorPointType = { AAPT_POSITION: 0, AAPT_NAME_TAG: 1 }
export const CameraType = { CT_FIRST_PERSON: 0, CT_THIRD_PERSON: 1 }
export const Font = { F_SANS_SERIF: 0, F_SERIF: 1, F_MONOSPACE: 2 }
export const TextAlignMode = { TAM_TOP_LEFT: 0, TAM_MIDDLE_CENTER: 4 }
export const YGUnit = { YGU_UNDEFINED: 0, YGU_POINT: 1, YGU_PERCENT: 2, YGU_AUTO: 3 }

// ── pointer events ──────────────────────────────────────────────────────────
export const pointerEventsSystem = {
  onPointerDown(arg, callback) {
    const entry = arg && arg.entity !== undefined
      ? { entity: arg.entity, opts: arg.opts ?? {}, callback }
      : { entity: arg, opts: {}, callback }
    world.pointerHandlers.push(entry)
  },
  onPointerUp(arg, callback) {
    pointerEventsSystem.onPointerDown(arg, callback)
  },
  removeOnPointerDown(entity) {
    const i = world.pointerHandlers.findIndex((h) => h.entity === entity)
    if (i >= 0) world.pointerHandlers.splice(i, 1)
  },
  removeOnPointerUp(entity) {
    pointerEventsSystem.removeOnPointerDown(entity)
  }
}

export const inputSystem = {
  isTriggered: () => false,
  isPressed: () => false,
  getInputCommand: () => null
}

export const executeTask = (fn) => {
  try {
    const r = fn()
    if (r && typeof r.catch === 'function') r.catch((e) => world.errors.push(String(e)))
  } catch (e) {
    world.errors.push(String(e))
  }
}

export const componentDefinitionByName = (name) => componentsByName.get(name)

// ── network / players / platform ────────────────────────────────────────────
export function syncEntity(entity, componentIds, entityId) {
  world.syncedEntities.push({ entity, componentIds, entityId })
}
export const isStateSyncronized = () => true
export const parentEntity = () => {}
export const getParent = () => 0
export const myProfile = { userId: 'sim-player', name: 'Simulator' }

export function onEnterScene(cb) { world.onEnter = cb }
export function onLeaveScene(cb) { world.onLeave = cb }
export function getPlayer() {
  return { userId: 'sim-player', name: 'Simulator', isGuest: true }
}
export function getPlayersInScene() { return [] }

export function isMobile() { return world.mobile === true }

// ── UI ──────────────────────────────────────────────────────────────────────
export const ReactEcsRenderer = {
  setUiRenderer(fn, opts) {
    world.uiRenderer = fn
    world.uiOpts = opts
  }
}
export const UiEntity = 'UiEntity'
export const Label = 'Label'
export const Button = 'Button'
export const Input = 'Input'
export const Dropdown = 'Dropdown'
export const UiCanvasInformation = makeComponent('core::UiCanvasInformation')

const ReactEcs = {
  createElement(type, props, ...children) {
    const kids = []
    for (const c of children) {
      if (Array.isArray(c)) kids.push(...c.flat(4))
      else if (c !== null && c !== undefined && c !== false) kids.push(c)
    }
    if (typeof type === 'function') {
      // Function components are evaluated eagerly; the simulator wants the
      // resulting tree, not a lazy element.
      return type({ ...(props ?? {}), children: kids })
    }
    return { type, props: props ?? {}, children: kids }
  },
  Fragment: 'Fragment'
}
export default ReactEcs
export { ReactEcs }
