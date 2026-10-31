# UI design system

## Fixed light palette

| Token          | Value     | Use                        |
| -------------- | --------- | -------------------------- |
| Primary navy   | `#1E3A5F` | Headings and primary brand |
| Secondary navy | `#294C73` | Secondary brand            |
| Background     | `#F5F7FA` | Application canvas         |
| Cards          | `#FFFFFF` | Surfaces                   |
| Primary text   | `#1F2937` | Body text                  |
| Secondary text | `#526071` | Supporting text            |
| Borders        | `#D8DEE8` | Dividers and outlines      |
| Primary action | `#245A8D` | Interactive actions        |
| Success        | `#237A4B` | Positive state             |
| Warning        | `#A66A13` | Warning state              |
| Danger         | `#B42318` | Error/destructive state    |

## Accessibility and behavior

- The application always uses a light color scheme; OS theme preferences are ignored.
- Use readable system sans-serif typography, clear heading hierarchy, and meaningful labels.
- Interactive targets have a minimum 44px height/width where practical.
- Maintain keyboard-visible focus indicators, semantic landmarks, sufficient text contrast, and
  status announcements for loading.
- Keep the layout usable on narrow screens; navigation labels may compact while retaining
  accessible names.
- Do not add a dark theme or a theme switch.

These are implementation constraints. Before adding product components, verify text and component
contrast against WCAG 2.2 AA in their actual states.
