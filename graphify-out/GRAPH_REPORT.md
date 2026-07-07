# Graph Report - .  (2026-07-07)

## Corpus Check
- Corpus is ~7,802 words - fits in a single context window. You may not need a graph.

## Summary
- 108 nodes · 220 edges · 12 communities (11 shown, 1 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Page Shell & Modal Wiring
- Card Rendering & Data Sync
- File Backup Modal Flow
- Firebase Data Layer
- Password-Gated Actions
- Typed Delete/Restore Confirmation
- Authorization Flow (HTML)
- Upload-in-Progress Guard
- Edit/View Modal Switching
- Realtime Sync Badges
- Add-Card Field Population
- Search Toggle

## God Nodes (most connected - your core abstractions)
1. `Currículo do Colaborador (Main Page)` - 32 edges
2. `toast()` - 19 edges
3. `renderCards()` - 13 edges
4. `setupRealtimeListeners()` - 8 edges
5. `saveLocalCards()` - 8 edges
6. `fillEditPane()` - 8 edges
7. `saveCard()` - 8 edges
8. `performRestore()` - 8 edges
9. `checkForUpdates()` - 7 edges
10. `loadDriveFiles()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `updateCardsWithNewFiles()` --calls--> `fillEditPane()`  [EXTRACTED]
  script.js → script.js  _Bridges community 1 → community 2_
- `closeSearch()` --calls--> `renderCards()`  [EXTRACTED]
  script.js → script.js  _Bridges community 11 → community 1_
- `saveCard()` --calls--> `saveLocalCards()`  [EXTRACTED]
  script.js → script.js  _Bridges community 1 → community 7_
- `validatePassword()` --calls--> `toast()`  [EXTRACTED]
  script.js → script.js  _Bridges community 4 → community 2_
- `executeSecureAction()` --calls--> `openEditModal()`  [EXTRACTED]
  script.js → script.js  _Bridges community 4 → community 8_

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Destructive Action Confirmation Flow (Delete & Restore)** — index_html_deleteoverlay, index_html_validatedeleteconfirmation, index_html_confirmdelete, index_html_backupoverlay, index_html_validaterestoreconfirmation, index_html_performrestore, index_html_typed_confirmation_pattern [INFERRED 0.85]
- **Collaborator CRUD Modal Flow** — index_html_mainmodal, index_html_addoverlay, index_html_savecard, index_html_savenewcard, index_html_switchmodaltab, index_html_filladdfields [INFERRED 0.85]
- **Password-Gated Actions (Add/Backup)** — index_html_checkauth, index_html_passwordoverlay, index_html_validatepassword, index_html_authorization_flow [INFERRED 0.85]

## Communities (12 total, 1 thin omitted)

### Community 0 - "Page Shell & Modal Wiring"
Cohesion: 0.09
Nodes (23): Currículo do Colaborador (Main Page), addOverlay (new collaborator modal), backupOverlay (backup/restore modal), closeAddModal (onclick handler), closeBackupModal (onclick handler), closeDeleteModal (onclick handler), closeModal (onclick handler), closePasswordModal (onclick handler) (+15 more)

### Community 1 - "Card Rendering & Data Sync"
Cohesion: 0.18
Nodes (20): buildCard(), checkForUpdates(), closeAddModal(), closeBackupModal(), generateDataHash(), handleVisibilityChange(), handleWindowFocus(), loadLocalData() (+12 more)

### Community 2 - "File Backup Modal Flow"
Cohesion: 0.19
Nodes (19): closeDeleteFileModal(), closeDeleteModal(), closeModal(), confirmDelete(), confirmDeleteFile(), fillEditPane(), finishEditingFileName(), handleBackupFile() (+11 more)

### Community 3 - "Firebase Data Layer"
Cohesion: 0.15
Nodes (8): allFiles, cards, database, deleteFile(), FIREBASE_PATHS, firebaseConfig, sheetData, showDeleteFileConfirmation()

### Community 4 - "Password-Gated Actions"
Cohesion: 0.29
Nodes (7): askDelete(), checkAuth(), executeSecureAction(), openAddModal(), openBackupModal(), updateBackupInfo(), validatePassword()

### Community 5 - "Typed Delete/Restore Confirmation"
Cohesion: 0.50
Nodes (5): confirmDelete (onclick handler), performRestore (onclick handler), Typed-Confirmation Guard for Destructive Actions, validateDeleteConfirmation (oninput handler), validateRestoreConfirmation (oninput handler)

### Community 6 - "Authorization Flow (HTML)"
Cohesion: 0.50
Nodes (4): Restricted Access / Password Authorization Pattern, checkAuth (onclick handler), passwordOverlay (auth modal), validatePassword (onclick handler)

### Community 7 - "Upload-in-Progress Guard"
Cohesion: 0.67
Nodes (4): closeUploadWarning(), monitorUploadProgress(), saveCard(), showUploadInProgressWarning()

### Community 8 - "Edit/View Modal Switching"
Cohesion: 0.50
Nodes (4): fillModalHeader(), openEditModal(), openViewModal(), switchModalTab()

### Community 9 - "Realtime Sync Badges"
Cohesion: 0.67
Nodes (3): Firebase Database Compat SDK, realtimeBadge (realtime status indicator), syncBadge (sync status indicator)

### Community 10 - "Add-Card Field Population"
Cohesion: 0.67
Nodes (3): fillAddFields(), fillViewPane(), formatGenero()

## Knowledge Gaps
- **28 isolated node(s):** `firebaseConfig`, `database`, `FIREBASE_PATHS`, `sheetData`, `cards` (+23 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Currículo do Colaborador (Main Page)` connect `Page Shell & Modal Wiring` to `Realtime Sync Badges`, `Typed Delete/Restore Confirmation`, `Authorization Flow (HTML)`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Why does `toast()` connect `File Backup Modal Flow` to `Card Rendering & Data Sync`, `Firebase Data Layer`, `Password-Gated Actions`, `Upload-in-Progress Guard`, `Edit/View Modal Switching`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `renderCards()` connect `Card Rendering & Data Sync` to `Search Toggle`, `File Backup Modal Flow`, `Firebase Data Layer`, `Upload-in-Progress Guard`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `firebaseConfig`, `database`, `FIREBASE_PATHS` to the rest of the system?**
  _28 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Page Shell & Modal Wiring` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._