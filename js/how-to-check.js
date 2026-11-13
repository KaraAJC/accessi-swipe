// "How do I check this?" steps, shown on the back of each card and on the
// scorecard for anything marked "I don't know". Keyed by success criterion id.
// Written for someone testing their own site with a browser and free tools.
const WCAG_HOW_TO_CHECK = {
  // ---------- Level A ----------
  '1.1.1': [
    'Run a free checker like WAVE or axe DevTools — it flags images with no alt attribute.',
    'For each image, ask: does the alt text say what the image means here? Purely decorative images should have alt="".',
    'Don’t forget icon buttons, SVGs, charts, and CAPTCHAs — they need a text name too.',
  ],
  '1.2.1': [
    'List every audio-only clip (podcasts, sound files) and video-only clip (no sound, like a silent animation).',
    'Audio-only: check there’s a transcript linked nearby.',
    'Video-only: check there’s a text description or a narrated audio version.',
  ],
  '1.2.2': [
    'Play each prerecorded video that has sound and turn captions (CC) on.',
    'Read along: captions should match the dialogue and include who’s speaking and important sounds.',
    'Auto-generated captions usually have errors — skim them, don’t assume they’re fine.',
  ],
  '1.2.3': [
    'Watch each video with your eyes closed for a minute.',
    'If you’d miss important information (on-screen text, actions, charts), there should be audio description or a full text transcript that covers the visuals.',
  ],
  '1.3.1': [
    'Use the structure view in WAVE or axe DevTools, or a headings bookmarklet.',
    'Things that look like headings should be <h1>–<h6>, lists should be <ul>/<ol>, and data tables should use <th> header cells.',
    'Click each form label — the matching field should get focus. That proves they’re connected.',
  ],
  '1.3.2': [
    'Turn off CSS (Firefox: View → Page Style → No Style) or open the page in reader mode.',
    'Read top to bottom — does it still make sense in that order?',
    'Watch for content that CSS moves around so the code order doesn’t match the visual order.',
  ],
  '1.3.3': [
    'Read your instructions, help text, and error messages.',
    'Look for phrases like “the button on the right”, “the round icon”, “the green box”, or “when you hear the beep”.',
    'Answer yes if any instruction relies only on those cues with no name or label to go with it.',
  ],
  '1.4.1': [
    'Look at links inside paragraphs: are they underlined (or marked some other way), not just a different color?',
    'Look at errors, required fields, charts, and status indicators — is there text, an icon, or a pattern besides color?',
    'Tip: switch your screen to grayscale (OS accessibility settings). If meaning disappears, color is the only cue.',
  ],
  '1.4.2': [
    'Load each page with your sound on.',
    'If anything plays on its own for more than 3 seconds, look for a pause, stop, or volume control near the top of the page.',
    'Answer yes if autoplaying audio has no such control.',
  ],
  '2.1.1': [
    'Put your mouse away. Use only Tab, Shift+Tab, Enter, Space, Escape, and the arrow keys.',
    'Try every feature: menus, forms, modals, carousels, custom dropdowns, drag-and-drop.',
    'Answer no if anything can’t be reached or used.',
  ],
  '2.1.2': [
    'Tab through the whole page, including into widgets, modals, embedded videos, and iframes.',
    'In each one, check you can Tab or Escape back out.',
    'Answer yes if focus gets stuck anywhere.',
  ],
  '2.1.4': [
    'Check your docs or settings for keyboard shortcuts that use a single letter, number, or symbol (no Ctrl, Alt, or Cmd).',
    'Click on a blank part of the page (not in a field) and type some letters — does anything happen?',
    'Answer yes if a shortcut like that exists and can’t be turned off, remapped, or limited to when a component has focus.',
  ],
  '2.2.1': [
    'Look for anything with a timer: session timeouts, timed quizzes, auto-advancing carousels, reserved checkout items.',
    'Check users get a warning with a way to extend (and at least 20 seconds to respond), or can turn the limit off or adjust it.',
    'Answer yes if a limit can’t be turned off, adjusted, or extended. Real-time events like live auctions are exempt.',
  ],
  '2.2.2': [
    'Look for carousels, marquees, animations, auto-updating feeds, and tickers.',
    'If it starts automatically and lasts more than 5 seconds, there should be a pause, stop, or hide control.',
    'Answer yes if any of them is missing one.',
  ],
  '2.3.1': [
    'Look for videos, animations, or effects that flash or strobe.',
    'If anything flashes rapidly, test it with a free flash analyzer like PEAT (Photosensitive Epilepsy Analysis Tool).',
    'Answer yes if anything flashes more than 3 times in one second (tiny, low-contrast flashes are exempt).',
  ],
  '2.4.1': [
    'Load the page and press Tab once — a “Skip to main content” link should appear.',
    'Or check the page uses landmarks (<header>, <nav>, <main>) and headings, using the WAVE or axe structure view.',
    'Answer yes if either one is there.',
  ],
  '2.4.2': [
    'Look at the browser tab text on several different pages.',
    'Each title should describe that page (like “Checkout – Store Name”), not repeat the same text everywhere.',
  ],
  '2.4.3': [
    'Start at the top and press Tab repeatedly.',
    'Focus should move in a logical order — usually the reading order, top to bottom.',
    'Open modals and menus: focus should move into them, and go back somewhere sensible when they close.',
  ],
  '2.4.4': [
    'Scan for links like “click here”, “read more”, or “learn more”.',
    'For each, check the sentence, paragraph, or list item around it makes the destination clear.',
    'Answer yes if any link’s purpose is unclear even with its context.',
  ],
  '2.5.1': [
    'Find features that use multi-finger or path gestures: pinch-zoom maps, swipe-only carousels, signature drawing.',
    'Check there’s also a single tap or click option, like +/− buttons or next/previous arrows.',
    'Answer yes if the gesture is the only way to do it.',
  ],
  '2.5.2': [
    'Press and hold on buttons and links, then slide your finger or mouse off before letting go.',
    'The action shouldn’t fire — actions should happen on release, not on press.',
    'Answer yes if something fires on press with no way to abort or undo.',
  ],
  '2.5.3': [
    'Compare each control’s visible text to its accessible name (browser DevTools → Accessibility panel, or axe DevTools).',
    'The name should contain the visible words, ideally starting with them. A button showing “Search” shouldn’t be named “Find”.',
    'Why it matters: voice-control users say what they see.',
  ],
  '2.5.4': [
    'Look for features triggered by shaking or tilting the device (shake to undo, tilt to scroll).',
    'Check there’s also an on-screen control, and a way to turn the motion trigger off.',
    'Answer yes if motion is the only way. Answer N/A if nothing uses motion.',
  ],
  '3.1.1': [
    'View the page source (Ctrl+U or Cmd+Option+U) and look at the <html> tag at the top.',
    'It should have a lang attribute matching the page’s main language, like <html lang="en">.',
  ],
  '3.2.1': [
    'Tab slowly through every link, button, and field.',
    'Watch for anything that happens from focus alone: popups opening, forms submitting, focus jumping elsewhere.',
    'Answer yes if just landing on something causes a big change.',
  ],
  '3.2.2': [
    'Change every dropdown, checkbox, radio button, and field value.',
    'Watch for the page navigating, the form submitting, or a new window opening on its own.',
    'Answer yes if that happens without the user being told beforehand.',
  ],
  '3.2.6': [
    'Visit several pages that offer help: contact details, a chat widget, an FAQ link, a phone number.',
    'Check it’s in the same relative spot each time, like always in the footer.',
    'Answer N/A if your site has no help mechanism.',
  ],
  '3.3.1': [
    'Submit forms with mistakes: empty required fields, a badly formatted email.',
    'Errors should be shown in text (not just a red border) and say which field is wrong.',
    'Bonus: check a screen reader announces the error.',
  ],
  '3.3.2': [
    'Look at every form field, including search boxes and filters.',
    'Each should have a visible label or instructions. Placeholder text that vanishes when you type doesn’t count on its own.',
    'Required fields and format rules (like a date format) should be stated up front.',
  ],
  '3.3.7': [
    'Walk through a multi-step process like checkout, sign-up, or an application.',
    'Note any time you’re asked for something you already entered in the same process, like your address again for billing.',
    'Answer yes if it isn’t pre-filled or selectable. Re-entering a password for security is fine.',
  ],
  '4.1.1': [
    'Run a few pages through the W3C HTML validator (validator.w3.org).',
    'Look for duplicate IDs and elements opened or closed in the wrong order.',
    'Since the 2023 errata treat this as always met for HTML, most teams answer yes here.',
  ],
  '4.1.2': [
    'Turn on a screen reader (VoiceOver: Cmd+F5 on Mac; NVDA is free on Windows) or open the browser DevTools Accessibility panel.',
    'Focus each custom control: toggles, tabs, accordions, menus, dialogs.',
    'Each should announce a name, a role (like “button” or “tab”), and its state (like “expanded” or “checked”) — and the state should update when it changes.',
  ],

  // ---------- Level AA ----------
  '1.2.4': [
    'Find any live streams, live webinars, or live events with audio.',
    'Check real-time captions are provided (by a human captioner or reliable live captioning).',
    'Answer N/A if you don’t broadcast live media.',
  ],
  '1.2.5': [
    'Watch each prerecorded video while only listening.',
    'If the visuals carry information the narration doesn’t mention, an audio-described version is needed.',
    'Answer yes if every such video has audio description (or already describes the visuals out loud).',
  ],
  '1.3.4': [
    'Open the site on a phone or tablet and rotate it — or use browser DevTools device mode to switch between portrait and landscape.',
    'Answer yes if content refuses to show in one orientation (unless it truly has to, like a piano keyboard app).',
  ],
  '1.3.5': [
    'Find fields that collect personal info: name, email, phone, address, birthday, card number.',
    'Inspect each — it should have an autocomplete attribute with the right value, like autocomplete="email".',
    'Quick test: does your browser offer to autofill them?',
  ],
  '1.4.3': [
    'Use a contrast checker: the WebAIM Contrast Checker, or the color picker in Chrome DevTools (it shows the ratio).',
    'Check body text, small labels, placeholder text, and text on images or colored buttons.',
    'Normal text needs 4.5:1. Large text (24px, or about 19px bold) needs 3:1.',
  ],
  '1.4.4': [
    'Zoom the browser to 200% (Ctrl or Cmd and + a few times).',
    'Check text gets bigger and nothing is cut off, overlapping, or impossible to use.',
    'Answer yes if content or features are lost.',
  ],
  '1.4.5': [
    'Look for text that’s part of an image: banners, buttons, infographics, quotes.',
    'Try selecting the text with your cursor — if you can’t, it’s probably an image.',
    'Answer yes if real text could have been used instead. Logos are fine.',
  ],
  '1.4.10': [
    'Make your browser window 1280px wide and zoom to 400% — or use DevTools device mode at 320px wide.',
    'Read through the content.',
    'Answer yes if you have to scroll sideways to read text. Maps, data tables, and diagrams are exempt.',
  ],
  '1.4.11': [
    'Use a contrast checker on input borders, outlined buttons, icons, checkboxes, and the focus indicator.',
    'Also check the meaningful parts of charts and graphs.',
    'Each needs at least 3:1 against the colors right next to it.',
  ],
  '1.4.12': [
    'Install a “text spacing” bookmarklet or browser extension (search for “text spacing bookmarklet”).',
    'It bumps up line height, paragraph spacing, letter spacing, and word spacing to the WCAG test values.',
    'Answer yes if any text gets clipped, overlaps, or disappears.',
  ],
  '1.4.13': [
    'Find tooltips, hover menus, and popovers.',
    'Check that Escape closes them without moving the mouse, that you can move the mouse onto the popup without it vanishing, and that it stays until you move away or dismiss it.',
    'Answer N/A if nothing appears on hover or focus.',
  ],
  '2.4.5': [
    'Pick a page and try to reach it two different ways: main navigation, site search, a sitemap, related links, or an A–Z index.',
    'Steps in a process (like checkout) are exempt.',
  ],
  '2.4.6': [
    'Read only the headings (use a headings bookmarklet, or a screen reader’s headings list).',
    'Each should tell you what its section is about.',
    'Read the form labels too — do they clearly say what to enter?',
  ],
  '2.4.7': [
    'Tab through the whole page.',
    'You should always be able to see where focus is: an outline, underline, or highlight.',
    'Watch for spots where focus seems to vanish (often caused by outline: none in the CSS).',
  ],
  '2.4.11': [
    'Tab through the page, especially as it scrolls under sticky headers, footers, cookie banners, or chat widgets.',
    'Answer yes if the focused element is ever completely hidden behind something.',
  ],
  '2.5.7': [
    'Find anything you drag: sliders, sortable lists, drag-and-drop uploads, map panning, kanban boards.',
    'Check there’s a click or tap alternative, like arrow buttons, a text input, or a “Move to…” menu.',
    'Answer yes if dragging is the only option.',
  ],
  '2.5.8': [
    'Inspect small targets — icon buttons, close (×) buttons, pagination links — in browser DevTools.',
    'Each should be at least 24×24px, or have enough space around it that a 24px circle centered on it doesn’t touch another target.',
    'Links inside a sentence are exempt.',
  ],
  '3.1.2': [
    'Look for phrases or sections in a different language from the rest of the page (quotes, a language switcher, translated snippets).',
    'Inspect them — each should have its own lang attribute, like <span lang="es">.',
    'Answer N/A if everything is in one language.',
  ],
  '3.2.3': [
    'Visit several pages and compare the main navigation, header, and footer.',
    'Links should appear in the same order each time. Adding or removing items is OK.',
  ],
  '3.2.4': [
    'Compare repeated elements across pages: search buttons, icons, download links, “Add to cart”.',
    'The same function should have the same label everywhere — not “Search” on one page and “Find” on another.',
  ],
  '3.3.3': [
    'Submit forms with common mistakes: a bad email, a short password, the wrong date format.',
    'The error should say how to fix it (“Enter a date like 12/31/2025”), not just “Invalid”.',
  ],
  '3.3.4': [
    'Find forms that make legal or financial commitments, or change or delete user data (purchases, bookings, deleting an account).',
    'Check users can review before submitting, confirm, or undo/cancel afterward.',
    'Answer N/A if there are no forms like that.',
  ],
  '3.3.8': [
    'Go through log in, sign up, and password reset.',
    'Try pasting into the password field, and try a password manager.',
    'Answer yes if you must solve a puzzle, retype characters, or remember something with no alternative. (Picking out pictures of objects is allowed at this level.)',
  ],
  '4.1.3': [
    'Turn on a screen reader (VoiceOver: Cmd+F5 on Mac; NVDA is free on Windows).',
    'Trigger status updates: add to cart, submit a form, run a search, apply a filter.',
    'The message should be read out without focus moving to it — usually done with role="status" or aria-live.',
  ],

  // ---------- Level AAA ----------
  '1.2.6': [
    'Check each prerecorded video for a sign language interpreter, either in the video or as an alternate version.',
    'Answer N/A if you have no prerecorded video with audio.',
  ],
  '1.2.7': [
    'Find videos where the narration has no natural pauses for describing the visuals.',
    'Check there’s an extended audio description version that pauses the video to fit the descriptions in.',
  ],
  '1.2.8': [
    'For each prerecorded video, look for a full text alternative (like a screenplay) covering both the dialogue and what happens on screen.',
    'It should be linked near the video.',
  ],
  '1.2.9': [
    'Find live audio-only content (live radio, audio streams).',
    'Check there’s a live text alternative, like real-time captions or a live transcript.',
    'Answer N/A if you don’t have any.',
  ],
  '1.3.6': [
    'Check page regions use landmarks: <header>, <nav>, <main>, <footer>, or ARIA landmark roles.',
    'Check icons and controls have clear accessible names, and personal-info fields use autocomplete.',
    'This is a broad one — landmarks plus clear names gets you most of the way.',
  ],
  '1.4.6': [
    'Use a contrast checker on all text.',
    'Normal text needs 7:1. Large text (24px, or about 19px bold) needs 4.5:1.',
  ],
  '1.4.7': [
    'Listen to audio-only speech recordings (podcasts, narration).',
    'Check background music or noise is absent, can be turned off, or is much quieter than the speech (about 4× quieter).',
    'Answer N/A if you have no audio like that.',
  ],
  '1.4.8': [
    'Check users can pick text and background colors, or that your site respects their browser or OS color settings.',
    'Check lines are under 80 characters, text isn’t justified, line spacing is at least 1.5, and paragraphs have space between them.',
    'Zoom to 200% and check you never scroll sideways to read a line.',
  ],
  '1.4.9': [
    'Look for any text inside images: headers, buttons, quotes, infographics.',
    'Answer yes if there is any, other than logos or cases where the exact look is essential.',
  ],
  '2.1.3': [
    'Do the full keyboard-only test from 2.1.1 (Tab, Enter, Space, arrows — no mouse).',
    'This time, no exceptions: even things like freehand drawing need a keyboard way.',
  ],
  '2.2.3': [
    'List every timer or timeout on the site.',
    'Answer yes if any exist that aren’t essential to the activity (a live auction or real-time video would be essential).',
  ],
  '2.2.4': [
    'Look for popups, chat prompts, newsletter modals, auto-refreshing content, and notifications.',
    'Check users can turn them off or put them off until later. Emergencies are exempt.',
  ],
  '2.2.5': [
    'Log in, start filling a long form, then let the session expire (or clear the site’s cookies).',
    'Log back in and check your work is still there.',
  ],
  '2.2.6': [
    'Find timeouts that would lose user data (forms, shopping carts).',
    'Check users are told up front how long they have — or that data is kept for at least 20 hours.',
  ],
  '2.3.2': [
    'Look for any flashing or strobing content at all, of any size.',
    'Answer yes if anything flashes more than three times in one second.',
  ],
  '2.3.3': [
    'Turn on “Reduce motion” in your OS accessibility settings and reload.',
    'Animations triggered by scrolling or clicking (parallax, sliding, zooming) should stop or tone down.',
    'Or check there’s a setting on the site to turn animation off.',
  ],
  '2.4.8': [
    'Go to a page deep inside the site.',
    'Check you can tell where you are: breadcrumbs, a highlighted nav item, a clear page heading, or a step indicator.',
  ],
  '2.4.9': [
    'List all the links on the page (WAVE’s link view, or a screen reader’s links list).',
    'Read each link’s text on its own — would you know where it goes?',
    'Several “Read more” links on one page fail this.',
  ],
  '2.4.10': [
    'View the page outline (headings bookmarklet, or a screen reader’s headings list).',
    'Check long content is broken into sections with headings.',
  ],
  '2.4.12': [
    'Tab through the page while sticky headers, footers, and popups are showing.',
    'Answer yes if any part of the focused element is ever covered.',
  ],
  '2.4.13': [
    'Tab through the page and look closely at the focus indicator on each element.',
    'It should be at least as big as a 2px outline around the element.',
    'Use a contrast checker: the focused vs. unfocused colors should differ by at least 3:1.',
  ],
  '2.5.5': [
    'Inspect buttons, icons, and controls in browser DevTools.',
    'Each should be at least 44×44px. Links inside a sentence are exempt.',
  ],
  '2.5.6': [
    'Try the site with a mouse, a keyboard, touch, and (if you can) a stylus or voice control.',
    'Answer yes if one input type is blocked — like touch-only on a laptop that has a touchscreen.',
  ],
  '3.1.3': [
    'Read through the content for jargon, idioms, and technical terms.',
    'Check there’s a glossary, inline definitions, or links to explanations.',
  ],
  '3.1.4': [
    'Find the abbreviations and acronyms.',
    'Check the full form is given on first use, in a glossary, or with an <abbr> element.',
  ],
  '3.1.5': [
    'Paste a sample of your content into a readability checker (like Hemingway Editor).',
    'If it scores above about grade 9 (lower secondary), check there’s a plain-language summary or simpler version.',
  ],
  '3.1.6': [
    'Look for words whose meaning depends on how they’re said (like “read”, “lead”, or unusual names).',
    'Check pronunciation is given where it matters, like in a glossary or with phonetic spelling.',
    'Answer N/A if there are none.',
  ],
  '3.2.5': [
    'Watch for automatic redirects, auto-refresh, surprise popups, and links that open new windows without warning.',
    'Answer yes if context changes happen without the user asking for them (and with no way to turn them off).',
  ],
  '3.3.5': [
    'Look at complex forms and tasks.',
    'Check there’s help in context: hints next to fields, examples, tooltips, or a help link.',
  ],
  '3.3.6': [
    'Submit any form that takes user input.',
    'Check users can review before submitting, confirm, or undo/edit afterward.',
  ],
  '3.3.9': [
    'Go through log in and sign up.',
    'Answer yes if any step needs a cognitive test — even recognizing objects or picking out your own photos — unless there’s another way to log in.',
  ],
};

WCAG_CRITERIA.forEach(c => { c.how = WCAG_HOW_TO_CHECK[c.id] || []; });
