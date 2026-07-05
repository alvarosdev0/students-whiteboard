# anonymous-identity Specification

## Purpose

Anonymous user identity: auto-generated names, cursor display, inline editing, localStorage persistence, and per-user color assignment.

## Requirements

### REQ-IDENTITY-001: Random Name Generation
On first visit, the system MUST generate a display name in `AdjectiveAnimal` format (e.g., "CuriousPenguin", "BraveTiger") from a predefined word list (≥20 adjectives, ≥20 animals).

**Scenario:** GIVEN a first-time visitor → WHEN the page loads → THEN a random name is generated, displayed on their cursor, and persisted to localStorage.

### REQ-IDENTITY-002: Cursor Name Display
The system MUST display each user's name and assigned color on their cursor. Own cursor label SHALL show "You" suffix (e.g., "CuriousPenguin (You)").

### REQ-IDENTITY-003: Name Editing
The system MUST allow users to edit their display name via an inline editable field. Name changes SHALL broadcast to all room participants and persist to localStorage.

**Scenario:** GIVEN user clicks their name label → WHEN they type a new name and press Enter → THEN the new name updates on all participants' screens within 1 second. Name length: 2–30 characters.

### REQ-IDENTITY-004: Name Persistence
The system SHALL store the display name in localStorage (`wb:user`). On return visits, the saved name SHALL be used instead of generating a new one.

### REQ-IDENTITY-005: Random Color Assignment
The system MUST assign a random, distinguishable color to each user from a palette (≥16 colors). Color SHALL persist in localStorage alongside the name. Collision avoidance: the system SHOULD NOT assign the same color as another user in the same room; if collision occurs, a new color SHALL be picked.

## Edge Cases

| Case | Behavior |
|------|----------|
| localStorage cleared | New name generated on next visit. |
| Two users get same name | No collision prevention needed — names are not unique IDs. Color differentiates. |
| User clears browser data | Treated as first visit; new name + color generated. |
| Name contains only whitespace | Rejected; default name restored. |
| Rapid name changes | Debounced to max 1 change per 2 seconds. |
