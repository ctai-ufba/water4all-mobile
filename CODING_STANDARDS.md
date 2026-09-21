# Coding Standards

## Documentation and Comments

The repository must maintain the minimum docstring coverage required by continuous integration.

Functions and methods must be documented when their purpose, contract, behavior, inputs, outputs, side effects, assumptions, or failure modes are not evident from their signature, types, and local context.

Public APIs and functions that encapsulate domain rules, external integrations, relevant side effects, or failure handling must document their purpose and non-obvious behavior. Parameters, return values, and exceptions must be described when relevant to the correct use of the API.

API documentation must record the observable contract for its consumers.

### Usage Documentation

Interfaces intended for use outside the module—such as public APIs, executable scripts, and reusable pipelines or notebooks—must have a getting-started guide when the correct way to call or run them is not evident.

The guide must reside in a canonical and discoverable location from the interface, such as the module or API docstring, the README, or an adjacent document. A single explanation must have a canonical source; references should point to it rather than duplicating it.

Concisely, the getting-started guide must cover:

- the purpose of the interface;
- prerequisites and input format or organization that are not evident;
- a minimal, copyable example of invocation or execution;
- expected output, artifacts, or observable effects; and
- relevant configurations, policies, or failure scenarios needed to complete the initial usage correctly.

Examples must be reviewed alongside interface changes and remain consistent with the implementation. Automate their execution only when low-cost and providing useful coverage.

Internal comments must preserve implementation decisions, invariants, limitations, and constraints.

Comments must be added to complex or non-obvious sections when they help the reader understand the intent, reasoning, assumptions, algorithm, a rejected alternative, or an implementation constraint.

Comments must explain **why** the code exists or why an approach was chosen, rather than merely repeating **what** the code does.

Prefer simplifying or refactoring unnecessarily complex code over using comments to compensate for poor readability.

Complex logic whose intent cannot be understood locally must be:

- simplified;
- extracted into an appropriately named function or abstraction; or
- documented with a concise explanation of the reasoning, invariants, or constraints involved.

Documentation and comments must remain consistent with the implementation. Outdated, redundant, or misleading comments are readability defects and must be corrected or removed.
