# TAXBRIDGE INCIDENT CHECKLIST

## CORE FIXES
- [x] Navigation race removed
- [x] Single deterministic onboarding hand-off
- [x] Tabs prefetch handled appropriately

## STATE MANAGEMENT
- [x] All onboarding Zustand selectors use useShallow
- [x] No unnecessary render churn in onboarding screens

## PERFORMANCE
- [x] Reanimated worklet progress implemented
- [x] No JS-thread animation for progress UI
- [x] inlineRequires enabled where appropriate

## CONFIG
- [x] Hermes enabled
- [x] app.json has no duplicated engine keys
- [x] Metro config remains valid

## VALIDATION
- [x] Local validation passed
- [ ] E2E passed
- [ ] Real device farm passed
- [ ] Telemetry stable
- [ ] PR gate passed
