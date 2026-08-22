# Persistence

## Purpose

Separates player session progress from developer-authored defaults and keeps gameplay state JSON-safe, versioned and recoverable.

## Session save

`src/session/gameSessionState.js` owns normalized state; `src/session/sessionPersistence.js` owns envelopes, migrations, load/save/clear and safe fallback.

Session state includes player/world progress, needs, persistent population, household economy, inventory/world items, farm, kitchen, venue offer, tavern history/orders/feedback and coins. Accepted guests persist identity/order/service ownership; presentation, diagnostics and developer TEST state are transient.

Schema remains **v19** through Task #103. Missing `householdEconomy` is reconstructed during v19 normalization:
- old v19 saves with only the original 16 residents expand once to the mature ~300-person population; stable generated IDs prevent reseeding. Age/status/family links persist, including early death and later births;
- surnames persist inside `displayName`; older residents are deterministically repaired. Locale presentation is derived and not saved;
- `spendingCapacity` remains five-level income/dостаток `2/3/4/5/6`: income/lifestyle scale, not wallet or dish-price ceiling. Partner alignment, inheritance and rare career mobility mutate it;
- price preference/sensitivity are derived from stable identity and add no save field;
- price-audience memory reuses `tavernFeedback.reputationProfile.foodTagWeights` with `priceBand:*`; missing old evidence reconstructs as zero;
- `gameplay.householdEconomy` persists `lastProcessedWorldTimeSeconds`, real household coin balances, person→household assignments and active purchase reservations;
- old v19 without `householdEconomy` creates starting balances from population instead of treating `spendingCapacity` as money;
- family changes reconcile stored money without duplication; promotion/demotion changes future income scale, not current savings;
- active guest orders restore their tavern purchase reservations from persisted guest identity/item when needed.

## Authoring data

Starting layout, collider/profile drafts and authoring backups are developer data. Browser storage/dev write endpoints do not make them gameplay save state. BUILD/TEST presentation and demographic event lists never enter saves.

## `NEW GAME`

`NEW GAME` restores canonical starting world/inventory, mature population, household balances, kitchen, tavern and economy state. Authoring drafts may intentionally survive.

## Invariants

- every persisted field has a normalized owner and migration/recovery path; Phaser objects/functions never enter JSON state;
- migration chain: v6→v7 resources into inventory; v9→v10 tools/water/kitchen stock; v10→v11 combat loadout; v11→v12 serving stock under tables; v12→v13 population; v13→v14 venue offer; v14→v15 demand/preferences/history; v15→v16 exact orders; v16→v17 opinion/reputation/flow; v17→v18 relationships/visit periods; v18→v19 service format/place activity;
- within v19, age/status/full names/reciprocal family links and canonical `spendingCapacity` `2..6` are mutable persistent person state; valid `dead` persists at any age;
- within v19, missing `householdEconomy` is reconstructed by `src/character/householdEconomyDomain.js`; valid existing balances are preserved;
- household reservations are JSON-safe and cannot exceed the stored household coins; stale reservations without a live resumable guest are removed during normalization;
- current household cash never directly promotes or demotes a person; class changes come from population economic/career events and preserve existing savings;
- price preference/sensitivity remain recoverable identity traits; `priceBand:*` may occupy the existing reputation map without schema change;
- active guest IDs, reservations, exact orders, household purchase claims and service ownership restore without duplicate physical or monetary ownership;
- dropped items persist stable ID, payload and logical position; selection/drag/throw/feedback presentation do not;
- authoring backup version is independent from gameplay schema; the Task #049 warning persists until presentation.

## Current baseline

Schema v19 persists a multigeneration population with names, relationships and five-level income/dостаток alongside the real shared household wallet, tavern offer/feedback/price reputation/history, active service state, inventory, farm, kitchen and player coins. Existing older v19 saves normalize in place and acquire household balances once through the household owner.

## Not yet

Arbitrary construction saves, save slots, cloud sync and multiplayer ownership.

## Evidence

`check:inventory`, `check:progress`, `check:task-049`, `check:task-086`, `check:task-088`, `check:task-089`, `check:task-095`, `check:task-096`, `check:task-097`, `check:task-098`, `check:task-099`, `check:task-100`, `check:task-101`, `check:task-102`, `check:task-103`, `check:authoring`; persistence Browser E2E.