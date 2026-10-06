# WRHN HR Research Assistant prototype

## Build
- Create the HR team hub at `/` with the official WRHN identity, navigation, quick links, notices, and contacts.
- Create a shared assistant layout for `/assistant`, `/assistant/review`, and `/assistant/sources` with role switching and in-memory review state.
- Build the scripted assistant conversation, exact source quotes, clarifying questions, routing outcomes, redaction, dataset checks, feedback, and editable draft replies.
- Add reviewer-only flagged-answer and ticket-check views, plus the full synthetic source inventory and disclosures.

## Technical details
- Keep all policy, clause, topic, ticket, review, and check data in a typed data module.
- Keep matching and follow-up behavior in a pure tested module; no network, storage, authentication, or AI calls.
- Use semantic design tokens, local WRHN images, responsive layouts, accessible controls, and reduced-motion handling.
- Verify the key scripted journeys at desktop and 375px, including the locally served logo.
