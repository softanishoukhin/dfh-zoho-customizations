# Test Cases — ZP-TBD-8 Police Dropoffs Workflow

Full test suite: `D:\Office\Andrea_Projects\DFH\widgets\testCases\DFH_Police_Dropoff_Test_Cases.xlsx`
(15 cases, DO-01 through DO-15). Covers: basic drop off, unidentified naming, multiple deceased
in one submission, the 1-10 boundary, morgue check-in data reaching the Operations record,
billing (no pickup fee, storage still applies, decomposed condition triggers the decomp fee),
hand tag printing (no police station, police station present, unidentified deceased), the
rename cascade (unidentified→identified, and misspelling fix), and regression checks confirming
normal Police pickups and Hospital cases are unaffected.

Status: in progress. Core creation flow was retested live multiple times during development,
surfacing and fixing 4 distinct bugs (phantom trip, Stage not persisting / mandatory-field
requirement, Date of Death format, Sex field omission — see crm/functions/deals/ZP-TBD-8_police_dropoff_workflow/metadata.md
for full detail). Full 15-case suite not yet run end to end as of 2026-07-07.
