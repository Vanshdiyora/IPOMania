# Security policy

## Supported scope

The active development branch is the only supported branch during the foundation phase.

## Reporting a vulnerability

Please do not publish credentials or exploit details in public issues. Report suspected security
issues privately to the repository maintainers through GitHub's private vulnerability reporting
feature, if enabled, or contact the maintainers directly. Include the affected component, impact,
and safe reproduction details.

## Security notes

- Never commit secrets, `.env` files, `.dev.vars`, service-role keys, or production connection
  strings.
- The health endpoint exposes only application status, API version, and a non-secret environment
  label.
- Future RLS-protected operations must preserve the user's verified JWT context; service-role
  credentials must not be used as a substitute.
- CI runs `npm audit --audit-level=high`. Dependency audit output should be triaged and resolved
  rather than suppressed without review.
- This foundation is not a security certification or production-readiness claim.
