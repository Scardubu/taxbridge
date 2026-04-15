# AGENT: CANARY CONTROLLER

## OBJECTIVE

Control progressive rollout.

## PHASES

- 10% → monitor
- 25% → monitor
- 50% → monitor
- 100% → full release

## RULES

- Do not progress if anomaly detected
- Require telemetry pass before next phase
