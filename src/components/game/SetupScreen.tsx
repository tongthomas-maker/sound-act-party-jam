import { useState } from "react";
import { CATEGORIES, type CategoryId } from "@/lib/cards";
import type { Player } from "@/lib/players";
import { ROUND_COUNTS, ROUND_LENGTHS, MIN_PLAYERS } from "@/lib/game";
import type { PlayMode, Prefs } from "@/lib/prefs";

export type Mode = PlayMode;

/** Canonical V1 modes. Quick Call content is kept in lib/quickcall but not offered in V1. */
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "sound", label: "🔊 SOUND IT!", hint: "Sounds only. No words, no acting." },
  { id: "act", label: "🎭 ACT IT!", hint: "Actions only. No words, no sounds." },
  { id: "mix", label: "🔀 MIX IT!", hint: "Sound and act cards shuffled together." },
];

export const MAX_NAME = 20;

interface Props {
  players: Player[];
  selected: string[];
  onAddPlayer: (name: string) => void;
  onRenamePlayer: (id: string, name: string) => void;
  onDeletePlayer: (id: string) => void;
  onToggleSelect: (id: string) => void;
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  categories: CategoryId[];
  setCategories: (c: CategoryId[]) => void;
  cardCount: number;
  onStart: () => void;
}

export function SetupScreen({
  players,
  selected,
  onAddPlayer,
  onRenamePlayer,
  onDeletePlayer,
  onToggleSelect,
  prefs,
  setPrefs,
  categories,
  setCategories,
  cardCount,
  onStart,
}: Props) {
  const mode = prefs.mode;
  const setMode = (m: Mode) => setPrefs({ mode: m });
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Player | null>(null);
  const activeCount = selected.length;
  const allCats = categories.length === CATEGORIES.length;
  const canStart = activeCount >= MIN_PLAYERS && cardCount > 0;

  const toggleCat = (id: CategoryId) => {
    if (categories.includes(id)) {
      if (categories.length === 1) return;
      setCategories(categories.filter((c) => c !== id));
    } else {
      setCategories([...categories, id]);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-7 px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="pt-4 text-center">
        <h1
          className="text-6xl leading-none tracking-tight text-card-yellow"
          style={{ fontFamily: "var(--font-display)" }}
        >
          SOUND IT!
        </h1>
        <p className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-white/40">
          One phone. One guesser. Total chaos.
        </p>
      </header>

      {/* Players */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
            Who&apos;s playing? ({activeCount})
          </h2>
          {players.length > 0 && (
            <button
              onClick={() => {
                setEditMode((v) => !v);
                setEditing(null);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wider ${
                editMode ? "bg-card-pink text-white" : "bg-white/10 text-white/60"
              }`}
            >
              {editMode ? "Done" : "Edit players"}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {players.map((p) =>
            editing === p.id ? (
              <form
                key={p.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editName.trim()) onRenamePlayer(p.id, editName.trim().slice(0, MAX_NAME));
                  setEditing(null);
                }}
                className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-2"
              >
                <input
                  autoFocus
                  value={editName}
                  maxLength={MAX_NAME}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-24 bg-transparent text-sm font-bold text-white outline-none"
                />
                <button type="submit" className="text-sm font-black text-card-lime">
                  OK
                </button>
              </form>
            ) : (
              <div
                key={p.id}
                className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-colors ${
                  selected.includes(p.id)
                    ? "bg-card-yellow text-black"
                    : "bg-white/10 text-white/40"
                }`}
              >
                <button
                  type="button"
                  aria-pressed={selected.includes(p.id)}
                  aria-label={`${p.name}${selected.includes(p.id) ? ", playing" : ", not playing"}`}
                  disabled={editMode}
                  onClick={() => (editMode ? undefined : onToggleSelect(p.id))}
                  className="max-w-32 truncate"
                >
                  {selected.includes(p.id) ? `${p.name} ✓` : p.name}
                </button>
                {editMode && (
                  <>
                    <button
                      onClick={() => {
                        setEditing(p.id);
                        setEditName(p.name);
                      }}
                      aria-label={`Rename ${p.name}`}
                      className="opacity-60"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => setConfirmDelete(p)}
                      aria-label={`Delete ${p.name}`}
                      className="opacity-60"
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
            ),
          )}

          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="rounded-full bg-white/15 px-4 py-2.5 text-sm font-black text-white"
            >
              + ADD PLAYER
            </button>
          )}
        </div>

        {adding && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) onAddPlayer(name.trim().slice(0, MAX_NAME));
              setName("");
              setAdding(false);
            }}
            className="mt-3 flex gap-2"
          >
            <input
              autoFocus
              value={name}
              maxLength={MAX_NAME}
              onChange={(e) => setName(e.target.value)}
              placeholder="Player name…"
              aria-label="New player name"
              className="min-w-0 flex-1 rounded-2xl bg-white/10 px-4 py-3.5 text-base font-semibold text-white placeholder:text-white/30 outline-none focus:bg-white/15"
            />
            <button
              type="submit"
              className="shrink-0 rounded-2xl bg-card-lime px-5 text-base font-black text-black active:scale-95"
            >
              SAVE
            </button>
          </form>
        )}

        <p className="mt-2 text-xs font-semibold text-white/35">
          Saved on this device. Tap a name to add or remove them from this game.
        </p>

        {confirmDelete && (
          <div className="mt-3 rounded-2xl bg-white/10 p-4">
            <p className="text-sm font-bold text-white">
              Delete {confirmDelete.name} from your saved players?
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  onDeletePlayer(confirmDelete.id);
                  setConfirmDelete(null);
                }}
                className="rounded-xl bg-card-pink px-4 py-2 text-sm font-black text-white"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-xl bg-white/15 px-4 py-2 text-sm font-black text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Mode */}
      <section>
        <h2 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-white/40">Mode</h2>
        <div className="flex flex-col gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={mode === m.id}
              onClick={() => setMode(m.id)}
              className={`rounded-2xl px-5 py-4 text-left transition-colors ${
                mode === m.id ? "bg-card-purple text-white" : "bg-white/8 text-white/70"
              }`}
            >
              <div className="text-xl font-black">{m.label}</div>
              <div className="text-xs font-semibold opacity-70">{m.hint}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Categories */}
      {
        <section>
          <h2 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-white/40">
            Categories
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={allCats}
              onClick={() => setCategories(CATEGORIES.map((c) => c.id))}
              className={`col-span-2 rounded-2xl px-4 py-3 text-sm font-black ${
                allCats ? "bg-card-lime text-black" : "bg-white/8 text-white/70"
              }`}
            >
              ✨ ALL CATEGORIES
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={categories.includes(c.id)}
                onClick={() => toggleCat(c.id)}
                className={`rounded-2xl px-4 py-4 text-sm font-black ${
                  categories.includes(c.id) ? "bg-card-blue text-white" : "bg-white/8 text-white/50"
                }`}
              >
                {c.emoji} {c.label}
                {categories.includes(c.id) ? " ✓" : ""}
              </button>
            ))}
          </div>
          <p aria-live="polite" className="mt-2 text-center text-xs font-semibold text-white/35">
            {cardCount} cards in this deck
          </p>
        </section>
      }

      {/* Round setup */}
      <section>
        <h2 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-white/40">
          Round length
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {ROUND_LENGTHS.map((sec) => (
            <button
              key={sec}
              onClick={() => setPrefs({ roundSeconds: sec })}
              aria-pressed={prefs.roundSeconds === sec}
              className={`rounded-2xl py-3 text-lg font-black ${
                prefs.roundSeconds === sec
                  ? "bg-card-yellow text-black"
                  : "bg-white/8 text-white/60"
              }`}
            >
              {sec}s
            </button>
          ))}
        </div>
        <h2 className="mb-3 mt-5 text-xs font-black uppercase tracking-[0.2em] text-white/40">
          Turns each
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {ROUND_COUNTS.map((n) => (
            <button
              key={n}
              onClick={() => setPrefs({ rounds: n })}
              aria-pressed={prefs.rounds === n}
              className={`rounded-2xl py-3 text-lg font-black ${
                prefs.rounds === n ? "bg-card-yellow text-black" : "bg-white/8 text-white/60"
              }`}
            >
              {n} {n === 1 ? "round" : "rounds"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-xs font-semibold text-white/35">
          Everyone guesses the same number of times.
        </p>
      </section>

      {/* Audio & feedback */}
      <section>
        <h2 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-white/40">
          Sound &amp; feedback
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["🎵 Music", "music"],
              ["🔊 Effects", "sfx"],
              ["📳 Vibration", "haptics"],
              ["📱 Flip controls", "flip"],
            ] as const
          ).map(([label, key]) => (
            <button
              key={key}
              onClick={() => setPrefs({ [key]: !prefs[key] })}
              aria-pressed={prefs[key]}
              className={`rounded-2xl px-2 py-3 text-xs font-black ${
                prefs[key] ? "bg-card-blue text-white" : "bg-white/8 text-white/40"
              }`}
            >
              {label}
              <span className="block text-[10px] opacity-70">{prefs[key] ? "ON" : "OFF"}</span>
            </button>
          ))}
        </div>
        <label className="mt-3 block rounded-2xl bg-white/8 px-4 py-3">
          <span className="flex justify-between text-xs font-black text-white/70">
            <span>🔈 Volume</span>
            <span>{prefs.volume}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={prefs.volume}
            aria-label="Volume"
            onChange={(e) => setPrefs({ volume: Number(e.target.value) })}
            className="mt-2 w-full accent-card-yellow"
          />
        </label>
      </section>

      <div className="mt-auto pt-2">
        <button
          disabled={!canStart}
          onClick={onStart}
          className="w-full rounded-3xl bg-card-lime py-6 text-3xl font-black text-black transition-transform active:scale-[0.98] disabled:bg-white/10 disabled:text-white/30"
          style={{ fontFamily: "var(--font-display)" }}
        >
          START GAME
        </button>
        {!canStart && (
          <p role="status" className="mt-3 text-center text-sm font-semibold text-white/40">
            {activeCount < 2
              ? "Select at least 2 players to start"
              : "No cards match — pick another category"}
          </p>
        )}
      </div>
    </div>
  );
}
