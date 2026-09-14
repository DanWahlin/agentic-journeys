# Work-sequence policy

Canonical logical sequences are Contract F0-F1, API F2-F4, Web F5-F6, Search F7-F8, Chat F9-F10, and Infra F12-F13. F11 is a read-only preflight gate rather than an implementation stack. F11 and F12 may proceed independently, and F13 waits for both. F14 integration and F15 release are gated work items.

This lab uses sequential dependent pull requests. A dependency must merge to the current default branch and reach verified `factory:done` before its child dispatches. Independent sequences may run in parallel within work-in-progress limits. Each branch and pull request belongs to one Issue and one sequence. Automation may report stale topology but must not rewrite worker branches, retarget pull requests, merge, or invoke `gh stack merge`.
