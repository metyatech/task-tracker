# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.6] - 2026-03-27

### Changed

- Publish from GitHub Release publication events instead of tag pushes, and document the updated release flow

### Fixed

- Accept shorter task IDs that start with `-` in `update`, `done`, and `remove`, not only the generated 8-character form

## [0.2.5] - 2026-03-24

### Security

- Refresh `flatted` to 3.4.2 via `npm audit fix` to clear npm audit high-severity advisories

### Fixed

- Accept task IDs that start with `-` in `update`, `done`, and `remove`

## [0.2.4] - 2026-03-10

### Security

- Upgrade minimatch to 10.2.4 (fixes GHSA-7r86-cg39-jmmj and GHSA-23c5-xmqv-rm74 ReDoS vulnerabilities)

### Fixed

- Improve test reliability by making verify behavior deterministic

## [0.2.3] - 2026-02-23

### Fixed

- Normalize `repository.url` in package.json (npm pkg fix)

## [0.2.2] - 2026-02-23

### Fixed

- Skip GUI auto-refresh when input is focused
- Upgrade vitest to v4 and add minimatch override to resolve security vulnerabilities

### Changed

- Add husky + lint-staged pre-commit hooks
- Regenerate AGENTS.md with latest global rules

## [0.2.1] - 2026-02-23

### Changed

- Migrated to ESLint 9 flat config (`eslint.config.js`)
- Updated CI with security scanning (OSV-scanner v2.3.3, CodeQL)
- Added community health files (SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md)
- Added GitHub Issue and Pull Request templates
- Added AGENTS.md and agent-ruleset.json for compose-agentsmd compliance
