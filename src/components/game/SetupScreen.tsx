import { useState } from "react";
import { CATEGORIES, type CategoryId } from "@/lib/cards";
import type { Player } from "@/lib/players";

export type Mode = "sound" | "act" | "mix";

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "sound", label: "🔊 SOUND IT", hint: "Sounds only. No words, no acting." },
  { id: "act", label: "🎭 ACT IT", hint: "Actions only. No words, no sounds." },
  { id: "mix", label: "🔀 MIX IT", hint: "Everything shuffled together." },
];

interface Props {
  players: Player[];
  onAddPlayer: (name: string) => void;
  onRenamePlayer: (id: string, name: string) => void;
  onDeletePlayer: (id: string) => void;
  onTogglePlayer: (id: string) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  categories: CategoryId[];
  setCategories: (c: CategoryId[]) => void;
  cardCount: number;
  onStart: () => void;
}

export function SetupScreen({
  players,
  onAddPlayer,
  onRenamePlayer,
  onDeletePlayer,
  onTogglePlayer,
  mode,
  setMode,
  categories,
  setCategories,
  cardCount,
  onStart,
}: Props) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const activeCount = players.filter((p) => p.active).length;
  const allCats = categories.length === CATEGORIES.length;

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
        <h2 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-white/40">
          Players ({activeCount} playing)
        </h2>
        <div className="flex flex-wrap gap-2">
          {players.map((p) =>
            editing === p.id ? (
              <form
                key={p.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editName.trim()) onRenamePlayer(p.id, editName);
                  setEditing(null);
                }}
                className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-2"
              >
                <input
                  autoFocus
                  value={editName}
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
                  p.active
                    ? "bg-card-yellow text-black"
                    : "bg-white/10 text-white/40"
                }`}
              >
                <button onClick={() => onTogglePlayer(p.id)} className="max-w-32 truncate">
                  {p.name}
                </button>
                <button
                  onClick={() => {
                    setEditing(p.id);
                    setEditName(p.name);
                  }}
                  aria-label={`Rename ${p.name}`}
                  className="opacity-50"
                >
                  ✎
                </button>
                <button
                  onClick={() => onDeletePlayer(p.id)}
                  aria-label={`Remove ${p.name}`}
                  className="opacity-50"
                >
                  ✕
                </button>
              </div>
            ),
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onAddPlayer(name);
            setName("");
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add a player…"
            className="min-w-0 flex-1 rounded-2xl bg-white/10 px-4 py-3.5 text-base font-semibold text-white placeholder:text-white/30 outline-none focus:bg-white/15"
          />
          <button
            type="submit"
            className="shrink-0 rounded-2xl bg-white/15 px-5 text-2xl font-black text-white active:scale-95"
          >
            +
          </button>
        </form>
      </section>

      {/* Mode */}
      <section>
        <h2 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-white/40">
          Mode
        </h2>
        <div className="flex flex-col gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
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
      <section>
        <h2 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-white/40">
          Categories
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <button
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
              onClick={() => toggleCat(c.id)}
              className={`rounded-2xl px-4 py-4 text-sm font-black ${
                categories.includes(c.id)
                  ? "bg-card-blue text-white"
                  : "bg-white/8 text-white/50"
              }`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-xs font-semibold text-white/35">
          {cardCount} cards in this deck
        </p>
      </section>

      <div className="mt-auto pt-2">
        <button
          disabled={activeCount < 2}
          onClick={onStart}
          className="w-full rounded-3xl bg-card-lime py-6 text-3xl font-black text-black transition-transform active:scale-[0.98] disabled:bg-white/10 disabled:text-white/30"
          style={{ fontFamily: "var(--font-display)" }}
        >
          START GAME
        </button>
        {activeCount < 2 && (
          <p className="mt-3 text-center text-sm font-semibold text-white/40">
            Add at least 2 active players to start
          </p>
        )}
      </div>
    </div>
  );
}
