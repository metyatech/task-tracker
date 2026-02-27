# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
