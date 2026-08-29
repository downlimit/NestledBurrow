# Build mode and developer authoring

## Purpose

Owns construction, placeable lifecycle and asset/layout editing.

## Player-facing build contract

- walls/surfaces support placement, demolition and grouped undo; objects move through one owner;
- `BUILD / TEST` separates construction from prototype simulation; TEST never starts placement, move or demolition;
- TEST grants canonical inventory/coins and transient population proof without changing real clock/gameplay/save;
- library items expose names/previews; placement uses the `16 px` grid;
- preview and commit share position, pivot, visual offset and effective collider; cursor anchor uses pivot/collider midpoint;
- construction is not yet gameplay-persisted.

## Universal placeable lifecycle

Every catalog object declares one `placeableOwner` and one `place → move → remove → restore` lifecycle. Resource profiles use the same placement contract; authoring selection shares it.

## Developer-authoring contract

One versioned profile owns collider, pivot, visual/crop/interaction offsets, approach, render policy and optional timeline data. Mouse and `1 px` arrow edits suppress movement. Visible bounds select instances; point markers drag/nudge; approach uses a `3×3` grid.

Render policy is `below-character`, `pivot-depth` or `above-character`. Fixed-world stairs/gliders use ordinary move authoring but stay outside construction catalog. Per-instance `collisionEnabled` may remove blocking without losing editing/interaction. Canon export contains layout, profiles and fixed-world state; browser storage may hold drafts/backups, `NEW GAME` restores baseline.

## Будущая законная территория

Приватизированные клетки дают юридическое право на коммерческую застройку, а не техническое разрешение строить.

- стартовая законная площадь ограничена; дополнительные клетки покупаются у государства и последовательно дорожают;
- присоединённый остров NPC даёт бесплатный пакет приватизированных клеток;
- огород, грядки и выращивание растений от приватизации освобождены;
- постройку вне законной площади можно поставить, но она помечается незаконной;
- штраф требует обнаружения подходящим представителем официальной службы, а не возникает всеведуще сразу;
- незаконная застройка повышает скрытую вероятность пожара, замыкания, затопления, ос, кражи и подобных происшествий;
- происшествие может привлечь пожарных, полицию, скорую или другую службу; прибывший представитель тоже может заметить нарушение и сообщить о нём;
- периодический налог законной недвижимости зависит от площади помещений и стоимости находящихся внутри построек, оборудования и имущества;
- цены клеток, налог, штрафы, земельный бонус острова и коэффициенты риска пока остаются балансными параметрами.

Незаконное строительство — осознанный риск игрока, а территория, происшествия и контроль образуют один связанный контур.

## Owners

`WorldBuildCoordinator` owns build actions; runtime owners own entities; `WorldScene` remains composition only. TEST proof lives in `simulationTestPalette`; placement in `placeableBuildContract`/`placeablePlacementPose`; profiles/authoring in `assetProfiles`, `assetAuthoringRegistry`, `universalPlaceableAuthoring`; fixed transitions use `fixedWorldAuthoringState` and `worldTransitionAuthoringBridge`.

Owner/persistence для законной территории выделяются только с первым playable slice, не заранее.

## Invariants

- preview/commit use one placement pose and live pivot/effective collider;
- targeting uses live collider, interaction offset and approach directions;
- one registry/mode list covers live placeables and fixed transitions;
- render/timeline data survive profile export/load;
- fixed transitions stay outside build-library creation/demolition;
- fixed-world placement/collision survive canonical export; collision OFF preserves interaction;
- every catalog object has one lifecycle owner; move/demolition resolve the same target;
- TEST sandboxes are proof only, never gameplay state;
- authoring stays separate from gameplay persistence; orchestration stays outside `src/main.js`.

## Current baseline

Village objects use full construction lifecycle. BUILD holds catalog; TEST grants canonical items/coins and transient demographic proof. Burrow/Nest stairs and Atoll transitions share fixed-world move/collider/collision authoring; only village exposes construction. Законная площадь, налоги, штрафы и связанный контур происшествий пока являются будущим дизайном, не runtime.

## Evidence

`check:build-mode`, `check:facilities`, `check:authoring`, `check:task-090`, `check:task-100`, `check:task-101`, `authoring-persistence.spec.js`.