# M09 — Enhancement Integration ★ V10.3

## Purpose
This module defines integration rules for F1–F7 mobile enhancements and their alignment to dashboard zones.

## F1 — Engagement Ring
Render as an overlay in the `apex` zone and animate with `DURATION.deliberate`.

## F2 — Streak Tracker
Render in the `signal` zone, track consecutive active days, and persist offline.

## F3 — Donut Chart
Render in the `ambient` zone with deterministic backend data only (no fabricated values).

## F4 — AI Chat Assistant
Launch from floating action, request user consent before sending financial context to external APIs.

## F5 — Milestone Badges
Show a brief celebration overlay in `apex`, then auto-dismiss.

## F6 — Smart Notifications
Trigger from deadline proximity and health score drops; limit notification frequency.

## F7 — Guided Onboarding
Show first-session contextual guidance for gauge, quick actions, and invoice start flow.

## Integration Points
- `apex`: F1, F5, F7
- `signal`: F2
- `ambient`: F3
- Floating modal: F4
- Push channel: F6
