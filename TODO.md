# FarmersMarketplace TODO Progress

## Issue #27: Add Tests for Database Schema and Constraints ✅ IN PROGRESS

**Completed Steps:**
- [x] Checkout new branch `blackboxai/issue-27-schema-tests`
- [x] Create `backend/tests/schema.test.js` with PRAGMA table/FK verifications + constraint enforcement tests
- [x] Fix schema SQL extraction & TS lint issues
- [ ] Run `cd backend && npm test` → Verify passes
- [ ] `git add backend/tests/schema.test.js && git commit -m "Add comprehensive DB schema tests verifying tables, FKs, CHECK/UNIQUE constraints (#27)"`
- [ ] `git push origin blackboxai/issue-27-schema-tests`
- [ ] Check/install `gh` CLI, `gh pr create --title "Add DB schema tests (#27)" --body "..."`

## Previous Issues
# Integration Tests Progress - Issue #28 ✅ COMPLETE
- [x] ... (as before)

Run `cd backend && npm test` anytime to verify.
