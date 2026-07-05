# whiteboard-canvas Specification

## Purpose

tldraw-powered canvas with drawing tools: freehand, shapes, text, image paste, color selection, selection/manipulation, and undo/redo.

## Requirements

### REQ-CANVAS-001: Freehand Drawing
The system MUST provide a pencil tool with configurable stroke width (1–20px) and color. Drawing SHALL appear in real-time on the canvas.

**Scenario:** GIVEN pencil tool selected → WHEN user drags on canvas → THEN a freehand stroke renders at the chosen width and color, broadcast to all room participants.

### REQ-CANVAS-002: Basic Shapes
The system MUST support rectangle, circle/ellipse, arrow, and line tools. Shapes SHALL be drawn by click-drag and SHALL be resizable post-creation.

### REQ-CANVAS-003: Text Tool
The system MUST provide a text tool: click to create a text box, type to edit, with configurable font size (12–72pt) and color. Text SHALL support multi-line input.

### REQ-CANVAS-004: Image Paste
The system MUST accept images from clipboard paste (Ctrl+V / Cmd+V). Pasted images SHALL render on the canvas. MIME types: PNG, JPEG, GIF, WebP, SVG.

**Scenario:** GIVEN an image in clipboard → WHEN user presses Ctrl+V → THEN image appears at cursor position on canvas. Maximum asset size: 10MB.

### REQ-CANVAS-005: Color Selection
The system SHALL provide a color picker with a preset palette (≥12 colors) plus a custom hex input. Selected color SHALL apply to the active tool.

### REQ-CANVAS-006: Selection & Manipulation
The system MUST support select, move, resize, and delete operations on canvas elements. Multi-select (lasso or Shift+click) SHALL allow batch operations.

### REQ-CANVAS-007: Undo/Redo
The system MUST support undo (Ctrl+Z) and redo (Ctrl+Shift+Z / Ctrl+Y) for all canvas operations. Undo stack SHALL be per-session (lost on page reload).

## Edge Cases

| Case | Behavior |
|------|----------|
| Paste unsupported MIME type | System ignores paste; no error shown. |
| Very large image (>10MB) | Client rejects before upload; shows "Image too large" toast. |
| Rapid undo/redo | Each operation debounced at CRDT layer; no racing. |
| Empty text box | Deleted on blur if no text entered. |
| Zero-width stroke | Stroke width minimum clamped to 1px. |
