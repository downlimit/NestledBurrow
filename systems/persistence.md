# Persistence

## Purpose

Separates player session progress from developer-authored defaults and keeps gameplay state JSON-safe, versioned and recoverable.

## Session save

`src/session/gameSessionState.js` owns normalized state; `src/session/sessionPersistence.js` owns envelopes, migrations, load/save/clear and safe fallback.

Session state includes player/world progress, needs, persistent population, inventory/world items, farm, kitchen, venue offer, tavern history/orders/feedback and coins. Accepted guests persist identity/order/service ownership; visit-local presentation, intent diagnostics and developer TEST state are transient.

Schema remains **v19** through Tasks #100–#102:
- old v19 saves with only the original 16 residents expand once to the mature ~300-person population; stable generated IDs prevent reseeding. Age/status/family links persist, including early death and later births;
- surnames persist inside `displayName`; older residents are deterministically repaired. Locale presentation is derived and not saved;
- `spendingCapacity` remains the persistent wealth field; legal values expand from `2/4/6` to `2/3/4/5/6`, so old values need no conversion. Partner alignment, inheritance and gradual mobility mutate that same field;
- price preference/sensitivity are derived from stable identity and add no save field;
- price-audience memory reuses `tavernFeedback.reputationProfile.foodTagWeights` with `priceBand:*`; missing old evidence reconstructs as zero.

The confirmed future real household wallet is **not** part of Task #102 or schema v19 yet. Adding it requires an explicit persistent owner/migration rather than treating `spendingCapacity` as money.

## Authoring data

Starting layout, collider/profile drafts and authoring backups are developer data. Browser storage/dev write endpoints do not make them gameplay save state. BUILD/TEST presentation and demographic event lists never enter saves.

## `NEW GAME`

`NEW GAME` restores canonical starting world/inventory, mature population, kitchen, tavern and economy state. Authoring drafts may intentionally survive.

## Invariants

- every persisted field has a normalized owner and migration/recovery path; Phaser objects/functions never enter JSON state;
- migration chain: v6→v7 resources into inventory; v9→v10 tools/water/kitchen stock; v10→v11 combat loadout; v11→v12 serving stock under tables; v12→v13 population; v13→v14 venue offer; v14→v15 demand/preferences/history; v15→v16 exact orders; v16→v17 opinion/reputation/flow; v17→v18 relationships/visit periods; v18→v19 service format/place activity;
- within v19, age/status/full names/reciprocal family links and canonical `spendingCapacity` `2..6` are mutable persistent person state; valid `dead` persists at any age;
- price preference/sensitivity remain recoverable identity traits; `priceBand:*` may occupy the existing reputation map without schema change;
- active guest IDs, reservations, exact orders and service ownership restore without duplicate physical ownership;
- dropped items persist stable ID, payload and logical position; selection/drag/throw/feedback presentation do not;
- authoring backup version is independent from gameplay schema; the Task #049 warning persists until presentation.

## Current baseline

Schema v19 persists a multigeneration population with names, relationships and five-level wealth ceiling alongside tavern offer/feedback/price reputation/history, active service state, inventory, farm, kitchen and player coins. Existing v19 saves normalize in place without a schema bump.

## Not yet

Real household coin balances, arbitrary construction saves, save slots, cloud sync and multiplayer ownership.

## Evidence

`check:inventory`, `check:progress`, `check:task-049`, `check:task-086`, `check:task-088`, `check:task-089`, `check:task-095`, `check:task-096`, `check:task-097`, `check:task-098`, `check:task-099`, `check:task-100`, `check:task-101`, `check:task-102`, `check:authoring`; persistence Browser E2E.
