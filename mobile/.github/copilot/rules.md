# 🚨 COPILOT RULES — TAXBRIDGE

## 1. ALWAYS FIX ROOT CAUSE FIRST

Never suggest improvements before fixing:

- navigation race
- hydration instability

---

## 2. NO GENERIC SOLUTIONS

Reject:

- vague advice
- partial fixes
- “try this” suggestions

Always produce:

- exact code changes
- file-specific instructions

---

## 3. SINGLE SOURCE OF TRUTH

Navigation must be controlled by:
→ app/(onboarding)/_layout.tsx ONLY

---

## 4. PERFORMANCE FIRST

Every solution must:

- reduce re-renders
- avoid blocking JS thread
- improve perceived speed

---

## 5. REACT NATIVE BEST PRACTICES

MANDATORY:

- useShallow (Zustand)
- Reanimated worklets
- Hermes optimization

---

## 6. NO OVER-ENGINEERING

Do NOT:

- introduce new libraries unnecessarily
- redesign architecture before fixing bug

---

## 7. REAL DEVICE FOCUS

All solutions must consider:

- low-end Android
- unstable networks

---

## 8. OUTPUT FORMAT

Always:

- show exact diffs OR full file updates
- include explanation of WHY fix works
- include validation steps

---

## 9. COMPLETION RULE

Do NOT claim success unless:

- crash is fully resolved
- navigation is stable
