ambient audio
=============

drop a single MP3 file at /public/audio/simian.mp3 and the
<AmbientAudio> component will pick it up automatically — no
code change needed.

settings (already wired in components/AmbientAudio.tsx):
  volume:  0.20
  loop:    true
  preload: auto

playback rules:
  - does not start until the user's first gesture in the tab
    (pointerdown / keydown / touchstart anywhere)
  - pauses on /void/deep so the chaos page's own audio has the
    room to itself; resumes on the next route
  - user toggle stored in localStorage["sound_enabled"]
    (default true; user-flipped "false" persists across visits)

if the file is missing the toggle still renders but does
nothing — drop a file in and refresh.

the source must be a file you own or have licensed for this
use. extracting copyrighted audio from third-party platforms
is not something this project will do automatically.
