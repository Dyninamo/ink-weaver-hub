# 157 — Fix "Build your rig" gate on Home sessions

## Change
`src/pages/DiaryNew.tsx` water-type buttons: `default` variant only when `(venueTypeResolved || venueTypeManual) && venueType === wt`. For Home before any tap, both buttons render as outline; tapping flips `venueTypeManual=true`, highlights the choice and releases `canBuildRig`. State shape unchanged.
