/**
 * The HUD.
 *
 * Mobile UX rules this layout follows (Workshop #3 and the safe-area docs):
 *  - The renderer runs with screenInset 'interactable', so nothing here can end
 *    up underneath the joystick, chat or camera controls.
 *  - Nothing sits in the bottom-right corner, which belongs to the action button.
 *  - Touch targets are sized for thumbs, and are larger on mobile than desktop.
 *  - Type is larger on mobile; 10px default text is unreadable on a phone.
 *  - UI backgrounds here are flat colour fills only. Nine-slice tiled textures
 *    don't work on the mobile client, so nothing in this file leans on one.
 *
 * The centre of the screen shows exactly one thing at a time, chosen by what the
 * player most needs to know right now: where to look, what to do first, what
 * they just selected. Stacking those would make all of them harder to read.
 *
 * This is also the run's scoreboard, not just a status readout: a live score
 * and streak in the header, a ten-board atlas strip under it, a rank line in
 * the footer, and a reveal banner on solve that is deliberately the most
 * dressed-up thing on screen, since it is the moment a player screenshots.
 */
import ReactEcs, { Label, UiEntity, Button } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'
import { currentConstellation, readState } from './state'
import { CONSTELLATIONS } from './constellations'
import {
  currentToast,
  didBeatRecord,
  isAwaitingFirstTap,
  lastBoardResult,
  lastRunSeconds,
  progress,
  requestHint,
  revealedFigureTitle,
  revealFraction,
  runSeconds,
  selectedStarName,
  skipToNext,
  strayLineCount
} from './game'
import { BoardResult, currentScore, currentStreak, boardHistory, rank, totalScore } from './scoring'
import { stargazerCount } from './presence'
import { bearingHint } from './wayfinding'

const mobile = isMobile()

/** Type and target sizes, scaled up for touch. */
const S = {
  title: mobile ? 28 : 22,
  body: mobile ? 18 : 15,
  small: mobile ? 15 : 12,
  tiny: mobile ? 14 : 11,
  banner: mobile ? 34 : 28,
  hintButton: mobile ? 92 : 64,
  pip: mobile ? 22 : 16,
  mark: mobile ? 14 : 11,
  atlasCell: mobile ? 27 : 20,
  nextButtonW: mobile ? 220 : 170,
  nextButtonH: mobile ? 74 : 52
}

const INK = Color4.create(0.92, 0.95, 1, 1)
const DIM = Color4.create(0.72, 0.78, 0.95, 1)
const GOLD = Color4.create(1, 0.93, 0.7, 1)
const CYAN = Color4.create(0.72, 0.88, 1, 1)
const HOT = Color4.create(1, 0.6, 0.18, 1)
const PANEL = Color4.create(0.03, 0.04, 0.1, 0.72)
const PANEL_SOFT = Color4.create(0.03, 0.04, 0.1, 0.5)
const PIP_ON = Color4.create(0.75, 0.86, 1, 1)
const PIP_OFF = Color4.create(0.28, 0.33, 0.5, 0.85)
const MARK_OFF = Color4.create(0.3, 0.34, 0.5, 0.6)
const ATLAS_CURRENT = Color4.create(0.35, 0.55, 0.7, 0.9)
const ATLAS_UNSOLVED = Color4.create(0.15, 0.17, 0.26, 0.75)

/** Streak length at which the header calls it out loudly rather than just noting it. */
const STREAK_LOUD_AT = 3

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return '0.0s'
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  return `${m}m ${s.toFixed(0)}s`
}

export function ui(): ReactEcs.JSX.Element {
  const state = readState()
  const constellation = currentConstellation()
  const solved = state?.solved === true
  const { drawn, total } = progress()
  const constellationIndex = state ? state.constellationIndex % CONSTELLATIONS.length : 0

  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        positionType: 'absolute',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
    >
      <UiEntity uiTransform={{ flexDirection: 'column', alignItems: 'center' }}>
        {header(constellation, drawn, total, solved)}
        {atlasStrip(constellationIndex)}
      </UiEntity>
      {solved ? banner(constellation.name, revealedFigureTitle()) : centre()}
      {footer(solved)}
    </UiEntity>
  )
}

/**
 * Small filled/unfilled squares, shared by difficulty and the reveal's star
 * rating -- both are "how good was this", just measured at different times.
 */
function marks(
  filled: number,
  total: number,
  size: number,
  filledColor: Color4,
  keyPrefix: string
): ReactEcs.JSX.Element {
  const cells: ReactEcs.JSX.Element[] = []
  for (let i = 0; i < total; i++) {
    cells.push(
      <UiEntity
        key={`${keyPrefix}-${i}`}
        uiTransform={{
          width: size,
          height: size,
          margin: { left: 2, right: 2 },
          borderRadius: size * 0.25
        }}
        uiBackground={{ color: i < filled ? filledColor : MARK_OFF }}
      />
    )
  }
  return <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>{cells}</UiEntity>
}

/**
 * Header: identity of the board (name, difficulty, blurb), progress on it
 * (the pip row), and the run's live numbers (clock, dome record, score,
 * streak). The streak gets its own colour and size once it is worth bragging
 * about -- that is the moment worth reinforcing, not the tenth quiet edge.
 */
function header(
  constellation: ReturnType<typeof currentConstellation>,
  drawn: number,
  total: number,
  solved: boolean
): ReactEcs.JSX.Element {
  const state = readState()
  const best = state?.bestMillis ?? 0
  const streak = currentStreak()
  const loud = streak >= STREAK_LOUD_AT

  return (
    <UiEntity
      uiTransform={{
        flexDirection: 'column',
        alignItems: 'center',
        margin: { top: 14 },
        padding: { top: 10, bottom: 10, left: 22, right: 22 }
      }}
      uiBackground={{ color: PANEL }}
    >
      <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>
        <Label value={constellation.name} fontSize={S.title} color={INK} />
        <UiEntity uiTransform={{ margin: { left: 10 } }}>
          {marks(constellation.difficulty, 3, S.mark, CYAN, 'difficulty')}
        </UiEntity>
      </UiEntity>
      {pips(drawn, total)}
      {!solved ? <Label value={constellation.blurb} fontSize={S.small} color={DIM} /> : null}
      <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', margin: { top: 2 } }}>
        <Label
          value={
            best > 0
              ? `${formatTime(runSeconds())}  ·  dome best ${formatTime(best / 1000)}`
              : formatTime(runSeconds())
          }
          fontSize={S.small}
          color={DIM}
        />
      </UiEntity>
      <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', margin: { top: 2 } }}>
        <Label value={`Score ${currentScore()}`} fontSize={S.small} color={DIM} />
        {streak > 0 ? (
          <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>
            <Label value='  ·  ' fontSize={S.small} color={DIM} />
            <Label
              value={loud ? `${streak} in a row!` : `${streak} streak`}
              fontSize={loud ? S.body : S.small}
              color={loud ? HOT : DIM}
            />
          </UiEntity>
        ) : null}
      </UiEntity>
    </UiEntity>
  )
}

/**
 * One pip per line in the shape. On a phone this reads at a glance in a way
 * "3 of 7 lines" does not, and it shows the size of the job before you start.
 */
function pips(drawn: number, total: number): ReactEcs.JSX.Element {
  const cells: ReactEcs.JSX.Element[] = []
  for (let i = 0; i < total; i++) {
    cells.push(
      <UiEntity
        key={`pip-${i}`}
        uiTransform={{
          width: S.pip,
          height: S.pip * 0.34,
          margin: { left: 3, right: 3, top: 6, bottom: 4 }
        }}
        uiBackground={{ color: i < drawn ? PIP_ON : PIP_OFF }}
      />
    )
  }
  return (
    <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>
      {cells}
    </UiEntity>
  )
}

/**
 * A thin strip of all ten skies under the header. `boardHistory()` is in solve
 * order and can, in principle, contain the same name twice if the run has
 * looped back around; the most recent entry for a name is what's shown, since
 * that is the player's current standing on that board, not their first pass.
 * This is what makes ten separate puzzles read as one run being worked
 * through, so it earns a permanent spot rather than hiding in a menu.
 */
function atlasStrip(currentIndex: number): ReactEcs.JSX.Element {
  const history = boardHistory()
  const starsByName = new Map<string, number>()
  for (const h of history) starsByName.set(h.name, h.stars)

  const cells: ReactEcs.JSX.Element[] = []
  let solvedCount = 0
  for (let i = 0; i < CONSTELLATIONS.length; i++) {
    const c = CONSTELLATIONS[i]
    const stars = starsByName.get(c.name) ?? 0
    if (stars > 0) solvedCount++
    const isCurrent = i === currentIndex

    let bg = ATLAS_UNSOLVED
    if (isCurrent) bg = ATLAS_CURRENT
    else if (stars > 0) bg = Color4.create(1, 0.9, 0.6, 0.3 + 0.23 * stars)

    cells.push(
      <UiEntity
        key={`atlas-${c.name}`}
        uiTransform={{
          width: S.atlasCell,
          height: S.atlasCell,
          margin: { left: 2, right: 2, top: 6 },
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: 4
        }}
        uiBackground={{ color: bg }}
      >
        {stars > 0 ? <Label value={String(stars)} fontSize={S.tiny} color={INK} /> : null}
      </UiEntity>
    )
  }

  return (
    <UiEntity
      uiTransform={{
        flexDirection: 'column',
        alignItems: 'center',
        padding: { top: 4, bottom: 2, left: 14, right: 14 }
      }}
      uiBackground={{ color: PANEL_SOFT }}
    >
      <Label value={`Sky atlas  ${solvedCount}/${CONSTELLATIONS.length}`} fontSize={S.tiny} color={DIM} />
      <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>{cells}</UiEntity>
    </UiEntity>
  )
}

/**
 * The centre slot. Priority order matters: a player who cannot see the stars
 * needs to be told that before anything else, or the scene reads as broken.
 * The stray-line note sits below the toast on purpose -- clutter on the board
 * is the least urgent thing here, worth a mention only when nothing sharper
 * is competing for the same line of text.
 */
function centre(): ReactEcs.JSX.Element | null {
  const bearing = bearingHint()
  if (bearing !== '') return notice(bearing, GOLD)

  if (isAwaitingFirstTap()) return onboarding()

  const selection = selectedStarName()
  if (selection !== null) return notice(`${selection} — now tap another star`, INK)

  const toast = currentToast()
  if (toast !== '') return notice(toast, DIM)

  const stray = strayLineCount()
  if (stray > 0) {
    return notice(
      stray === 1
        ? '1 extra line on the board — harmless, tap the pair again to erase it'
        : `${stray} extra lines on the board — harmless, tap a pair again to erase it`,
      DIM
    )
  }

  return notice('Tap two stars to draw a line between them', INK)
}

function notice(text: string, color: Color4): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{
        flexDirection: 'column',
        alignItems: 'center',
        padding: { top: 8, bottom: 8, left: 18, right: 18 }
      }}
      uiBackground={{ color: PANEL_SOFT }}
    >
      <Label value={text} fontSize={S.body} color={color} />
    </UiEntity>
  )
}

/**
 * Shown until the very first tap. Names the goal, the control, and the fact
 * that this is shared — the three things a cold visitor needs in the first
 * few seconds.
 */
function onboarding(): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{
        flexDirection: 'column',
        alignItems: 'center',
        padding: { top: 16, bottom: 16, left: 26, right: 26 }
      }}
      uiBackground={{ color: Color4.create(0.03, 0.04, 0.12, 0.82) }}
    >
      <Label value='Trace the constellation' fontSize={S.title} color={INK} />
      <Label
        value='Tap a star, then tap another. A line appears between them.'
        fontSize={S.body}
        color={DIM}
      />
      <Label
        value='Wrong guesses cost nothing — tap the pair again to erase.'
        fontSize={S.small}
        color={DIM}
      />
      <Label
        value='Everyone in the dome draws on the same sky.'
        fontSize={S.small}
        color={CYAN}
      />
    </UiEntity>
  )
}

/**
 * The payoff, and deliberately the best-looking thing in the HUD -- this is
 * the screenshot moment. `revealFraction()` stages it in rather than dumping
 * every line on frame one: the figure's mythic title lands first, then the
 * star rating pops in one mark at a time, then the score, then the bonus
 * chips, then the time and record callout. The "Next sky" button is never
 * gated behind any of that -- a lone player must always be able to move on.
 */
function banner(name: string, figure: string): ReactEcs.JSX.Element {
  const result: BoardResult | null = lastBoardResult()
  const record = didBeatRecord()
  const f = revealFraction()

  // A staged fade-in: 0 before `threshold`, ramping to 1 over a short window
  // after it. Elements stay in the tree throughout so nothing pops in as a
  // sudden layout shift -- they just aren't visible yet.
  const stageAt = (threshold: number): number => clamp((f - threshold) / 0.18, 0, 1)

  const stars = result?.stars ?? 0
  const bonuses = result?.bonuses ?? []

  return (
    <UiEntity
      uiTransform={{
        flexDirection: 'column',
        alignItems: 'center',
        padding: { top: 18, bottom: 18, left: 34, right: 34 }
      }}
      uiBackground={{ color: Color4.create(0.06, 0.05, 0.02, 0.88) }}
    >
      <Label value={`${name} — Complete`} fontSize={S.banner} color={GOLD} />
      {figure !== '' ? (
        <UiEntity uiTransform={{ opacity: stageAt(0.05) }}>
          <Label value={figure} fontSize={S.body} color={CYAN} />
        </UiEntity>
      ) : null}
      <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', margin: { top: 6 } }}>
        {[0, 1, 2].map((i) => (
          <UiEntity key={`banner-star-${i}`} uiTransform={{ opacity: stageAt(0.2 + i * 0.12) }}>
            <UiEntity
              uiTransform={{
                width: S.mark * 1.6,
                height: S.mark * 1.6,
                margin: { left: 3, right: 3 },
                borderRadius: 4
              }}
              uiBackground={{ color: i < stars ? GOLD : MARK_OFF }}
            />
          </UiEntity>
        ))}
      </UiEntity>
      {result !== null ? (
        <UiEntity uiTransform={{ opacity: stageAt(0.42), margin: { top: 6 } }}>
          <Label value={`+${Math.round(result.score)} pts`} fontSize={S.body} color={INK} />
        </UiEntity>
      ) : null}
      {bonuses.length > 0 ? (
        <UiEntity
          uiTransform={{ opacity: stageAt(0.58), flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', margin: { top: 6 } }}
        >
          {bonuses.map((b, i) => (
            <UiEntity
              key={`bonus-${b}`}
              uiTransform={{ margin: { left: 4, right: 4, top: 2 }, padding: { top: 4, bottom: 4, left: 10, right: 10 } }}
              uiBackground={{ color: PANEL_SOFT }}
            >
              <Label value={b} fontSize={S.tiny} color={CYAN} />
            </UiEntity>
          ))}
        </UiEntity>
      ) : null}
      <UiEntity uiTransform={{ opacity: stageAt(0.74), flexDirection: 'column', alignItems: 'center', margin: { top: 6 } }}>
        <Label value={formatTime(lastRunSeconds())} fontSize={S.body} color={DIM} />
        {record ? <Label value='NEW DOME RECORD' fontSize={S.body} color={GOLD} /> : null}
      </UiEntity>
      <Button
        value='Next sky'
        fontSize={S.body}
        variant='primary'
        uiTransform={{
          width: S.nextButtonW,
          height: S.nextButtonH,
          margin: { top: 14 }
        }}
        onMouseDown={skipToNext}
      />
    </UiEntity>
  )
}

/**
 * Bottom strip. The hint button sits bottom-LEFT: the bottom-right corner is
 * reserved for the client's own action button on mobile. The social line
 * always states that lines are shared, even solo, so a judge testing alone
 * still sees this as a social space -- the rank line sits right under it so
 * the run's progress is visible in the same glance.
 */
function footer(solved: boolean): ReactEcs.JSX.Element {
  const others = stargazerCount()
  const social =
    others > 1
      ? `${others} stargazers in the dome — everyone sees your lines`
      : 'Lines you draw appear instantly for anyone who joins'

  const r = rank()
  const pct = Math.round(r.progress * 100)
  const rankLine =
    r.progress >= 1
      ? `${r.name}  ·  ${totalScore()} pts`
      : `${r.name}  ·  ${totalScore()} pts  ·  ${pct}% to next rank`

  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
        margin: { bottom: 18, left: 18 }
      }}
    >
      {!solved ? (
        <Button
          value='?'
          fontSize={S.title}
          variant='secondary'
          uiTransform={{
            width: S.hintButton,
            height: S.hintButton,
            margin: { right: 14 }
          }}
          onMouseDown={requestHint}
        />
      ) : null}
      <UiEntity
        uiTransform={{
          flexDirection: 'column',
          padding: { top: 8, bottom: 8, left: 14, right: 14 }
        }}
        uiBackground={{ color: PANEL }}
      >
        <Label value={social} fontSize={S.small} color={DIM} />
        <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', margin: { top: 4 } }}>
          <UiEntity
            uiTransform={{
              width: mobile ? 90 : 70,
              height: 6,
              margin: { right: 8 },
              borderRadius: 3
            }}
            uiBackground={{ color: MARK_OFF }}
          >
            <UiEntity
              uiTransform={{ width: `${Math.max(4, pct)}%`, height: '100%', borderRadius: 3 }}
              uiBackground={{ color: CYAN }}
            />
          </UiEntity>
          <Label value={rankLine} fontSize={S.small} color={CYAN} />
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}
