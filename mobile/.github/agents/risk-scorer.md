# AGENT: RISK SCORER

## OBJECTIVE

Quantify release risk numerically.

## METHOD

Score = weighted sum:

- navigation_race
- render_instability
- animation_block
- cold_start_delay

## OUTPUT

0.0 – 0.3 → SAFE
0.3 – 0.6 → CAUTION
0.6 – 1.0 → BLOCK RELEASE

Include:
- total score
- breakdown per factor
