// The task list. Tasks are done in this order, one per day.
//
// - Progress is tracked by `id`, so you can reorder, insert or remove tasks
//   later without losing history. Never reuse an id for a different task.
// - `early: true` adds a "Done early" button for tasks with a goal you can
//   reach before the 15 minutes are up (finding something, not doing something).
// - Similar tasks (writing, music, finding things) are spaced apart on purpose.

window.TASKS = [
  { id: 'morning-pages', title: 'Do stream of consciousness writing (like morning pages)' },
  { id: 'new-artist', title: 'Find a new musical artist to listen to', early: true },
  { id: 'walk', title: 'Go on a walk' },
  { id: 'recipe', title: 'Find a recipe you want to learn how to make', early: true },
  { id: 'play-known', title: 'Play songs you know on guitar/piano' },
  { id: 'month-list',    title: 'List what you want to do this month', hint: 'Places, people, things to make or try.' },
  { id: 'read-print', title: 'Read a book or an article in print' },
  { id: 'anxieties', title: 'Write out your anxieties' },
  { id: 'find-album', title: 'Find a new album by an artist you like / used to like', early: true },
  { id: 'meditate', title: 'Meditate' },
  { id: 'find-book', title: 'Find a new book you might want to read', early: true },
  { id: 'find-song', title: 'Find a new song to learn on guitar/piano', early: true },
  { id: 'wait-wait', title: 'Listen to Wait Wait... Don’t Tell Me!' },
  { id: 'listen-music', title: 'Listen to music' },
];

// More ideas. Move any of these into the list above when you want them.
//
// { id: 'letter',        title: 'Write to someone you miss', hint: 'A letter, a postcard or a long text.', early: true },
// { id: 'stretch',       title: 'Stretch', hint: 'Slowly, floor to ceiling. Hold each stretch for a few breaths.' },
// { id: 'sketch',        title: 'Draw what’s in front of you', hint: 'Pencil and paper. Look more than you draw.' },
// { id: 'tidy',          title: 'Tidy one small space', hint: 'A drawer, a shelf, the top of the desk. Just one.' },
// { id: 'good-things',   title: 'Write down what’s going well', hint: 'Small things count. Aim for ten.' },
// { id: 'poem',          title: 'Read poetry out loud', hint: 'Slower than feels natural.' },
// { id: 'write-poem',    title: 'Write a short poem', hint: 'Any form. It doesn’t have to be good.' },
// { id: 'outside',       title: 'Sit outside without your phone', hint: 'Notice five things you can hear.' },
// { id: 'practice',      title: 'Practise the hard part', hint: 'Guitar or piano. Loop the one passage that trips you up, slowly.' },
// { id: 'by-ear',        title: 'Work out a song by ear', hint: 'Guitar or piano. No tabs. Just the melody or the chords.' },
// { id: 'birth-year',    title: 'Find an album from the year you were born', hint: 'Or any year that means something to you.', early: true },
// { id: 'podcast',       title: 'Find a podcast episode worth saving', hint: 'Something new, not a show you already follow.', early: true },
// { id: 'film',          title: 'Find a film to watch this week', hint: 'Old, foreign, or recommended by someone you trust.', early: true },
// { id: 'outing',        title: 'Plan a small outing', hint: 'A gig, a gallery, a market, a hike. Put a date on it.', early: true },
// { id: 'playlist',      title: 'Make a playlist for a friend', hint: 'Ten songs they haven’t heard. Send it.', early: true },
// { id: 'memory',        title: 'Write about a memory', hint: 'A place, a meal, a person. As much detail as you can recall.' },
// { id: 'puzzle',        title: 'Do a crossword or a puzzle', hint: 'On paper if you can.' },
// { id: 'plants',        title: 'Look after your plants', hint: 'Water, prune, repot, wipe the leaves.' },
// { id: 'cook-prep',     title: 'Prep one ingredient for the week', hint: 'Wash greens, cook grains, make a dressing.' },
// { id: 'body-scan',     title: 'Do a body scan', hint: 'Lie down. Move your attention slowly from your feet to your head.' },
// { id: 'radio',         title: 'Listen to a radio station from another country', hint: 'Somewhere you’ve never been.' },
// { id: 'photos',        title: 'Print or sort a few photos', hint: 'Pick the ones worth keeping somewhere you’ll see them.' },
