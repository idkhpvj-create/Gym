import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Plus, Trash2, X, Dumbbell, TrendingUp, Ruler, Camera, LayoutGrid, Loader2 } from "lucide-react";

const COMMON_LIFTS = [
  "Back Squat", "Bench Press", "Deadlift", "Overhead Press", "Barbell Row",
  "Pull-up", "Front Squat", "Incline Bench Press", "Romanian Deadlift", "Hip Thrust",
];

const WORKOUT_SPLITS = {
  "Back and Biceps": ["Lat Pulldowns", "Seated Rows", "Deadlifts", "Flys", "Preacher Curls", "Hammer Curls", "Normal Curls"],
  "Chest and Triceps": ["Bench Press", "Incline Bench Press", "Cable Flys", "Tricep Pushdowns", "Overhead Tricep Extension", "Dips", "Close-Grip Bench Press"],
  "Chest and Shoulders": ["Bench Press", "Incline Dumbbell Press", "Overhead Press", "Lateral Raises", "Front Raises", "Chest Flys", "Arnold Press"],
  "Legs": ["Back Squat", "Leg Press", "Romanian Deadlift", "Leg Extension", "Leg Curl", "Walking Lunges", "Calf Raises"],
  "Abs and Core": ["Plank", "Hanging Leg Raises", "Cable Crunches", "Russian Twists", "Ab Wheel Rollout", "Bicycle Crunches"],
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const fmtDateShort = (d) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
const ordinalSuffix = (n) => {
  const j = n % 10, k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
};
const fmtFriendlyDate = (d) => {
  const dt = new Date(d + "T00:00:00");
  const day = dt.getDate();
  const month = dt.toLocaleDateString(undefined, { month: "long" });
  const weekday = dt.toLocaleDateString(undefined, { weekday: "long" });
  return `${day}${ordinalSuffix(day)} ${month}, ${weekday}`;
};
const epley1RM = (weight, reps) => (reps <= 1 ? weight : weight * (1 + reps / 30));
const round1 = (n) => Math.round(n * 10) / 10;

async function loadKey(key, fallback) {
  try {
    const res = await window.storage.get(key, false);
    return res ? JSON.parse(res.value) : fallback;
  } catch (e) {
    return fallback;
  }
}
async function saveKey(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), false);
  } catch (e) {
    console.error("Save failed", key, e);
  }
}

function compressImage(file, maxDim = 480, quality = 0.65) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');`;

const styles = {
  paper: "radial-gradient(circle at 15% 0%, #2A2140 0%, #191325 38%, #120C1D 100%)",
  headerPaper: "rgba(18, 12, 29, 0.82)",
  ink: "#F6F1E7",
  steel: "#B6ADC4",
  steelLight: "#7E7692",
  line: "rgba(246, 241, 231, 0.12)",
  accent: "#FF6A3D",
  accentTint: "#3A2A1E",
  accentDeep: "#FFA36B",
  card: "#FBF7EE",
  cardLine: "rgba(36, 27, 51, 0.14)",
  inkOnCard: "#241B33",
  glow: "linear-gradient(135deg, #FF6A3D 0%, #FF3D77 100%)",
};

function Section({ title, action, children }) {
  return (
    <div style={{ marginBottom: "2.5rem" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.9rem" }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: styles.ink, margin: 0, letterSpacing: "0.01em" }}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function TextBtn({ onClick, children, danger, style }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        font: "inherit",
        fontSize: 13,
        fontWeight: 500,
        color: danger ? styles.accentDeep : styles.ink,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function NumberField({ label, value, onChange, placeholder, width = 84 }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: styles.steel }}>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width,
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 15,
          fontWeight: 600,
          padding: "7px 8px",
          border: `1px solid ${styles.cardLine}`,
          borderRadius: 4,
          background: styles.card,
          color: styles.inkOnCard,
        }}
      />
    </label>
  );
}

export default function GymTracker() {
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [workouts, setWorkouts] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    (async () => {
      const [w, m, p] = await Promise.all([
        loadKey("gym:workouts", []),
        loadKey("gym:measurements", []),
        loadKey("gym:photos", []),
      ]);
      setWorkouts(w);
      setMeasurements(m);
      setPhotos(p);
      setLoading(false);
    })();
  }, []);

  const updateWorkouts = useCallback((next) => {
    setWorkouts(next);
    saveKey("gym:workouts", next);
  }, []);
  const updateMeasurements = useCallback((next) => {
    setMeasurements(next);
    saveKey("gym:measurements", next);
  }, []);
  const updatePhotos = useCallback((next) => {
    setPhotos(next);
    saveKey("gym:photos", next);
  }, []);

  const prList = useMemo(() => {
    const best = {};
    workouts.forEach((w) => {
      w.exercises.forEach((ex) => {
        ex.sets.forEach((s) => {
          const weight = parseFloat(s.weight) || 0;
          const reps = parseFloat(s.reps) || 0;
          if (weight <= 0 || reps <= 0) return;
          const est = epley1RM(weight, reps);
          const key = ex.name.trim().toLowerCase();
          if (!best[key] || est > best[key].est) {
            best[key] = { name: ex.name, weight, reps, est, date: w.date };
          }
        });
      });
    });
    return Object.values(best).sort((a, b) => b.est - a.est);
  }, [workouts]);

  const weekVolume = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    let vol = 0;
    workouts.forEach((w) => {
      const d = new Date(w.date + "T00:00:00");
      if (d >= weekAgo && d <= now) {
        w.exercises.forEach((ex) =>
          ex.sets.forEach((s) => {
            vol += (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 0);
          })
        );
      }
    });
    return Math.round(vol);
  }, [workouts]);

  const streak = useMemo(() => {
    const dates = new Set(workouts.map((w) => w.date));
    let count = 0;
    let cursor = new Date();
    for (;;) {
      const ds = cursor.toISOString().slice(0, 10);
      if (dates.has(ds)) {
        count++;
        cursor.setDate(cursor.getDate() - 1);
      } else if (ds === todayStr()) {
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  }, [workouts]);

  const workoutsThisWeek = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    return workouts.filter((w) => {
      const d = new Date(w.date + "T00:00:00");
      return d >= weekAgo && d <= now;
    }).length;
  }, [workouts]);

  const tabs = [
    { id: "dashboard", label: "Overview", icon: LayoutGrid },
    { id: "workouts", label: "Workouts", icon: Dumbbell },
    { id: "prs", label: "PRs", icon: TrendingUp },
    { id: "measurements", label: "Body", icon: Ruler },
    { id: "photos", label: "Photos", icon: Camera },
  ];

  const sectionRefs = useRef({});
  const scrollToSection = (id) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setTab(entry.target.dataset.section);
        });
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [loading]);

  return (
    <div
      style={{
        fontFamily: "'Inter', sans-serif",
        background: styles.paper,
        color: styles.ink,
        minHeight: "100vh",
        padding: "0 0 4rem",
      }}
    >
      <style>{FONT_IMPORT}</style>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: styles.headerPaper,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: `1px solid ${styles.line}`,
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "1.5rem 1.5rem 0" }}>
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 22,
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-0.01em",
              backgroundImage: styles.glow,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              display: "inline-block",
            }}
          >
            Training log
          </h1>
          <div style={{ display: "flex", gap: "1.5rem", marginTop: "1rem", overflowX: "auto" }}>
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => scrollToSection(t.id)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "0 0 10px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: "'Inter', sans-serif",
                    color: active ? styles.ink : styles.steelLight,
                    borderBottom: active ? `2px solid ${styles.accent}` : "2px solid transparent",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Icon size={14} strokeWidth={2} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 1.5rem" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: styles.steel, fontSize: 13, padding: "2rem 0" }}>
            <Loader2 size={16} className="spin" style={{ animation: "spin 1s linear infinite" }} />
            Loading your log...
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <>
            <div ref={(el) => (sectionRefs.current.dashboard = el)} data-section="dashboard" style={{ paddingTop: "2rem", scrollMarginTop: 96 }}>
              <Dashboard
                weekVolume={weekVolume}
                streak={streak}
                workoutsThisWeek={workoutsThisWeek}
                workouts={workouts}
                prList={prList}
                onGo={scrollToSection}
              />
            </div>
            <div ref={(el) => (sectionRefs.current.workouts = el)} data-section="workouts" style={{ paddingTop: "1rem", scrollMarginTop: 96 }}>
              <Workouts workouts={workouts} setWorkouts={updateWorkouts} />
            </div>
            <div ref={(el) => (sectionRefs.current.prs = el)} data-section="prs" style={{ paddingTop: "1rem", scrollMarginTop: 96 }}>
              <PRs prList={prList} />
            </div>
            <div ref={(el) => (sectionRefs.current.measurements = el)} data-section="measurements" style={{ paddingTop: "1rem", scrollMarginTop: 96 }}>
              <Measurements measurements={measurements} setMeasurements={updateMeasurements} />
            </div>
            <div ref={(el) => (sectionRefs.current.photos = el)} data-section="photos" style={{ paddingTop: "1rem", scrollMarginTop: 96 }}>
              <Photos photos={photos} setPhotos={updatePhotos} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Dashboard({ weekVolume, streak, workoutsThisWeek, workouts, prList, onGo }) {
  const recent = [...workouts].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 4);
  const topPRs = prList.slice(0, 3);

  return (
    <div>
      <div style={{ marginBottom: "2.5rem" }}>
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 52,
            fontWeight: 700,
            lineHeight: 1,
            backgroundImage: styles.glow,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            display: "inline-block",
          }}
        >
          {weekVolume.toLocaleString()}
          <span style={{ fontSize: 16, fontWeight: 600, color: styles.steel, marginLeft: 8, WebkitTextFillColor: styles.steel }}>lb lifted this week</span>
        </div>
        <div style={{ display: "flex", gap: "2rem", marginTop: "1.1rem" }}>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 600 }}>{workoutsThisWeek}</div>
            <div style={{ fontSize: 12, color: styles.steel }}>sessions this week</div>
          </div>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 600 }}>{streak}</div>
            <div style={{ fontSize: 12, color: styles.steel }}>day streak</div>
          </div>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 600 }}>{workouts.length}</div>
            <div style={{ fontSize: 12, color: styles.steel }}>sessions logged</div>
          </div>
        </div>
      </div>

      <Section
        title="Recent sessions"
        action={<TextBtn onClick={() => onGo("workouts")}>Log a workout</TextBtn>}
      >
        {recent.length === 0 ? (
          <EmptyRow text="No sessions yet. Log your first workout to start the streak." />
        ) : (
          recent.map((w) => (
            <div key={w.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${styles.line}` }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{w.name || "Workout"}</span>
              <span style={{ fontSize: 13, color: styles.steel }}>{fmtDateShort(w.date)} &middot; {w.exercises.length} exercises</span>
            </div>
          ))
        )}
      </Section>

      <Section title="Top personal records" action={<TextBtn onClick={() => onGo("prs")}>View all</TextBtn>}>
        {topPRs.length === 0 ? (
          <EmptyRow text="Log some sets and your best lifts will show up here." />
        ) : (
          topPRs.map((pr) => (
            <div key={pr.name} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${styles.line}` }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{pr.name}</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 600, color: styles.accentDeep }}>
                {round1(pr.weight)} &times; {pr.reps}
              </span>
            </div>
          ))
        )}
      </Section>
    </div>
  );
}

function EmptyRow({ text }) {
  return <div style={{ fontSize: 13, color: styles.steel, padding: "14px 0", borderBottom: `1px solid ${styles.line}` }}>{text}</div>;
}

function Workouts({ workouts, setWorkouts }) {
  const [date, setDate] = useState(todayStr());
  const [name, setName] = useState("");
  const [exercises, setExercises] = useState([]);
  const [exName, setExName] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [splitChoice, setSplitChoice] = useState("");

  const addExerciseByName = (nm) => {
    if (!nm.trim()) return;
    setExercises((prev) => [...prev, { id: uid(), name: nm.trim(), sets: [{ reps: "", weight: "" }] }]);
  };
  const addExercise = () => {
    addExerciseByName(exName);
    setExName("");
  };
  const selectStyle = {
    padding: "8px 10px",
    border: `1px solid ${styles.cardLine}`,
    borderRadius: 4,
    fontSize: 13,
    background: styles.card,
    color: styles.inkOnCard,
    fontFamily: "'Inter', sans-serif",
  };
  const updateSet = (exId, idx, field, val) => {
    setExercises(exercises.map((ex) => ex.id !== exId ? ex : {
      ...ex, sets: ex.sets.map((s, i) => (i === idx ? { ...s, [field]: val } : s)),
    }));
  };
  const addSet = (exId) => {
    setExercises(exercises.map((ex) => ex.id !== exId ? ex : { ...ex, sets: [...ex.sets, { reps: "", weight: "" }] }));
  };
  const removeSet = (exId, idx) => {
    setExercises(exercises.map((ex) => ex.id !== exId ? ex : { ...ex, sets: ex.sets.filter((_, i) => i !== idx) }));
  };
  const removeExercise = (exId) => setExercises(exercises.filter((ex) => ex.id !== exId));

  const saveWorkout = () => {
    const cleaned = exercises
      .map((ex) => ({ ...ex, sets: ex.sets.filter((s) => s.reps !== "" && s.weight !== "") }))
      .filter((ex) => ex.sets.length > 0);
    if (cleaned.length === 0) return;
    const w = { id: uid(), date, name: name.trim(), exercises: cleaned };
    setWorkouts([w, ...workouts]);
    setName("");
    setExercises([]);
  };

  const deleteWorkout = (id) => setWorkouts(workouts.filter((w) => w.id !== id));

  const sorted = [...workouts].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <Section title="Log a session">
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
            {fmtFriendlyDate(date)}
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: styles.steel }}>Select your workout for today</span>
            <select
              value={splitChoice}
              onChange={(e) => {
                setSplitChoice(e.target.value);
                setName((prev) => prev || e.target.value);
              }}
              style={{ ...selectStyle, maxWidth: 280 }}
            >
              <option value="">Choose a split</option>
              {Object.keys(WORKOUT_SPLITS).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          {splitChoice && (
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, color: styles.steel }}>Add an exercise from {splitChoice}</span>
              <select
                value=""
                onChange={(e) => e.target.value && addExerciseByName(e.target.value)}
                style={{ ...selectStyle, maxWidth: 280 }}
              >
                <option value="">Choose an exercise</option>
                {WORKOUT_SPLITS[splitChoice].map((ex) => (
                  <option key={ex} value={ex}>{ex}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: styles.steel }}>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              style={{ padding: "7px 8px", border: `1px solid ${styles.cardLine}`, borderRadius: 4, fontSize: 13, background: styles.card, color: styles.inkOnCard }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 160 }}>
            <span style={{ fontSize: 11, color: styles.steel }}>Session name (optional)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Push day"
              style={{ padding: "7px 8px", border: `1px solid ${styles.cardLine}`, borderRadius: 4, fontSize: 13, background: styles.card, color: styles.inkOnCard }} />
          </label>
        </div>

        {exercises.map((ex) => (
          <div key={ex.id} style={{ border: `1px solid ${styles.line}`, borderRadius: 6, padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{ex.name}</span>
              <button onClick={() => removeExercise(ex.id)} style={{ background: "none", border: "none", cursor: "pointer", color: styles.steelLight }}>
                <X size={14} />
              </button>
            </div>
            {ex.sets.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: styles.steel, width: 14, paddingBottom: 9 }}>{i + 1}</span>
                <NumberField label="Reps" value={s.reps} onChange={(v) => updateSet(ex.id, i, "reps", v)} width={70} />
                <NumberField label="Weight (lb)" value={s.weight} onChange={(v) => updateSet(ex.id, i, "weight", v)} width={90} />
                <button onClick={() => removeSet(ex.id, i)} style={{ background: "none", border: "none", cursor: "pointer", color: styles.steelLight, paddingBottom: 9 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <TextBtn onClick={() => addSet(ex.id)}><Plus size={12} /> Add set</TextBtn>
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            list="lift-suggestions"
            value={exName}
            onChange={(e) => setExName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addExercise()}
            placeholder="Add an exercise, e.g. Bench Press"
            style={{ flex: 1, padding: "8px 10px", border: `1px solid ${styles.cardLine}`, borderRadius: 4, fontSize: 13, background: styles.card, color: styles.inkOnCard }}
          />
          <datalist id="lift-suggestions">
            {COMMON_LIFTS.map((l) => <option key={l} value={l} />)}
          </datalist>
          <button
            onClick={addExercise}
            style={{ padding: "8px 14px", border: `1px solid ${styles.cardLine}`, borderRadius: 4, background: styles.card, color: styles.inkOnCard, fontSize: 13, cursor: "pointer" }}
          >
            Add
          </button>
        </div>

        <button
          onClick={saveWorkout}
          disabled={exercises.length === 0}
          style={{
            padding: "10px 18px", border: "none", borderRadius: 4,
            background: exercises.length === 0 ? styles.steelLight : styles.accent,
            color: "#fff", fontSize: 13, fontWeight: 600, cursor: exercises.length === 0 ? "default" : "pointer",
          }}
        >
          Save session
        </button>
      </Section>

      <Section title="History">
        {sorted.length === 0 ? (
          <EmptyRow text="Nothing logged yet." />
        ) : (
          sorted.map((w) => {
            const isOpen = expanded === w.id;
            const volume = w.exercises.reduce((sum, ex) => sum + ex.sets.reduce((s2, s) => s2 + (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 0), 0), 0);
            return (
              <div key={w.id} style={{ borderBottom: `1px solid ${styles.line}`, padding: "12px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setExpanded(isOpen ? null : w.id)}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{w.name || "Workout"}</div>
                    <div style={{ fontSize: 12, color: styles.steel }}>{fmtDate(w.date)} &middot; {w.exercises.length} exercises &middot; {Math.round(volume).toLocaleString()} lb volume</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteWorkout(w.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: styles.steelLight }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                {isOpen && (
                  <div style={{ marginTop: 10, paddingLeft: 2 }}>
                    {w.exercises.map((ex) => (
                      <div key={ex.id} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{ex.name}</div>
                        <div style={{ fontSize: 12, color: styles.steel }}>
                          {ex.sets.map((s, i) => `${s.reps}\u00d7${round1(parseFloat(s.weight) || 0)}`).join("  \u00b7  ")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </Section>
    </div>
  );
}

function PRs({ prList }) {
  return (
    <Section title="Personal records">
      <p style={{ fontSize: 12, color: styles.steel, marginTop: -6, marginBottom: 14 }}>
        Best set logged per exercise, ranked by estimated one-rep max.
      </p>
      {prList.length === 0 ? (
        <EmptyRow text="Log some sets in Workouts and your PRs will appear here." />
      ) : (
        <div>
          <div style={{ display: "flex", fontSize: 11, color: styles.steel, padding: "0 0 8px", borderBottom: `1px solid ${styles.line}` }}>
            <span style={{ flex: 1 }}>Exercise</span>
            <span style={{ width: 90, textAlign: "right" }}>Best set</span>
            <span style={{ width: 90, textAlign: "right" }}>Est. 1RM</span>
            <span style={{ width: 90, textAlign: "right" }}>Date</span>
          </div>
          {prList.map((pr) => (
            <div key={pr.name} style={{ display: "flex", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${styles.line}` }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{pr.name}</span>
              <span style={{ width: 90, textAlign: "right", fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 600 }}>
                {round1(pr.weight)}&times;{pr.reps}
              </span>
              <span style={{ width: 90, textAlign: "right", fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 600, color: styles.accentDeep }}>
                {round1(pr.est)}
              </span>
              <span style={{ width: 90, textAlign: "right", fontSize: 12, color: styles.steel }}>{fmtDateShort(pr.date)}</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function Measurements({ measurements, setMeasurements }) {
  const [date, setDate] = useState(todayStr());
  const [weight, setWeight] = useState("");
  const [chest, setChest] = useState("");
  const [waist, setWaist] = useState("");
  const [arms, setArms] = useState("");
  const [thighs, setThighs] = useState("");

  const save = () => {
    if (!weight) return;
    const entry = { id: uid(), date, weight: parseFloat(weight), chest: chest || null, waist: waist || null, arms: arms || null, thighs: thighs || null };
    setMeasurements([entry, ...measurements]);
    setWeight(""); setChest(""); setWaist(""); setArms(""); setThighs("");
  };
  const remove = (id) => setMeasurements(measurements.filter((m) => m.id !== id));

  const sorted = [...measurements].sort((a, b) => (a.date < b.date ? -1 : 1));
  const chartData = sorted.map((m) => ({ date: fmtDateShort(m.date), weight: m.weight }));

  return (
    <div>
      <Section title="Log measurements">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: styles.steel }}>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              style={{ padding: "7px 8px", border: `1px solid ${styles.cardLine}`, borderRadius: 4, fontSize: 13, background: styles.card, color: styles.inkOnCard }} />
          </label>
          <NumberField label="Weight (lb)" value={weight} onChange={setWeight} width={90} />
          <NumberField label="Chest (in)" value={chest} onChange={setChest} width={90} />
          <NumberField label="Waist (in)" value={waist} onChange={setWaist} width={90} />
          <NumberField label="Arms (in)" value={arms} onChange={setArms} width={90} />
          <NumberField label="Thighs (in)" value={thighs} onChange={setThighs} width={90} />
        </div>
        <button
          onClick={save}
          disabled={!weight}
          style={{
            padding: "10px 18px", border: "none", borderRadius: 4,
            background: !weight ? styles.steelLight : styles.accent,
            color: "#fff", fontSize: 13, fontWeight: 600, cursor: !weight ? "default" : "pointer",
          }}
        >
          Save entry
        </button>
      </Section>

      {chartData.length > 1 && (
        <Section title="Body weight over time">
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke={styles.line} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: styles.steel }} axisLine={{ stroke: styles.line }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: styles.steel }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, border: `1px solid ${styles.line}` }} />
                <Line type="monotone" dataKey="weight" stroke={styles.accent} strokeWidth={2} dot={{ r: 3, fill: styles.accent }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      <Section title="History">
        {sorted.length === 0 ? (
          <EmptyRow text="No measurements logged yet." />
        ) : (
          [...sorted].reverse().map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${styles.line}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{fmtDate(m.date)}</div>
                <div style={{ fontSize: 12, color: styles.steel }}>
                  {m.weight} lb
                  {m.chest && ` \u00b7 chest ${m.chest}"`}
                  {m.waist && ` \u00b7 waist ${m.waist}"`}
                  {m.arms && ` \u00b7 arms ${m.arms}"`}
                  {m.thighs && ` \u00b7 thighs ${m.thighs}"`}
                </div>
              </div>
              <button onClick={() => remove(m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: styles.steelLight }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </Section>
    </div>
  );
}

function Photos({ photos, setPhotos }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await compressImage(file);
      const entry = { id: uid(), date: todayStr(), note: note.trim(), image: dataUrl };
      setPhotos([entry, ...photos]);
      setNote("");
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const remove = (id) => setPhotos(photos.filter((p) => p.id !== id));

  const sorted = [...photos].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <Section title="Add a progress photo">
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 8 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 160 }}>
            <span style={{ fontSize: 11, color: styles.steel }}>Note (optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Week 6"
              style={{ padding: "7px 8px", border: `1px solid ${styles.cardLine}`, borderRadius: 4, fontSize: 13, background: styles.card, color: styles.inkOnCard }} />
          </label>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            style={{ padding: "9px 16px", border: "none", borderRadius: 4, background: styles.accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer" }}
          >
            {busy ? "Adding..." : "Choose photo"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
        </div>
        <p style={{ fontSize: 11, color: styles.steelLight, margin: 0 }}>Photos are compressed and stored privately to your account.</p>
      </Section>

      <Section title="Gallery">
        {sorted.length === 0 ? (
          <EmptyRow text="No photos yet." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
            {sorted.map((p) => (
              <div key={p.id} style={{ position: "relative" }}>
                <img
                  src={p.image}
                  alt={p.note || fmtDate(p.date)}
                  onClick={() => setLightbox(p)}
                  style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 4, border: `1px solid ${styles.line}`, cursor: "pointer" }}
                />
                <div style={{ fontSize: 11, color: styles.steel, marginTop: 4 }}>{fmtDateShort(p.date)}{p.note ? ` \u00b7 ${p.note}` : ""}</div>
                <button
                  onClick={() => remove(p.id)}
                  style={{ position: "absolute", top: 6, right: 6, background: "rgba(27,27,24,0.6)", border: "none", borderRadius: 3, color: "#fff", cursor: "pointer", padding: 3, lineHeight: 0 }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(27,27,24,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 24 }}
        >
          <img src={lightbox.image} alt={lightbox.note} style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 4 }} />
        </div>
      )}
    </div>
  );
}
