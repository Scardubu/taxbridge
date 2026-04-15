# TAXBRIDGE INCIDENT CHECKLIST

## CORE FIXES
- [ ] Navigation race removed
- [ ] Single deterministic onboarding hand-off
- [ ] Tabs prefetch handled appropriately

## STATE MANAGEMENT
- [ ] All onboarding Zustand selectors use useShallow
- [ ] No unnecessary render churn in onboarding screens

## PERFORMANCE
- [ ] Reanimated worklet progress implemented
- [ ] No JS-thread animation for progress UI
- [ ] inlineRequires enabled where appropriate

## CONFIG
- [ ] Hermes enabled
- [ ] app.json has no duplicated engine keys
- [ ] Metro config remains valid

## VALIDATION
- [ ] Local validation passed
- [ ] E2E passed
- [ ] Real device farm passed
- [ ] Telemetry stable
- [ ] PR gate passed
