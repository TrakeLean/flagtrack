# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Flagtrack is a CLI tool for CTF (Capture The Flag) event management. It helps teams organize challenges, track progress, and maintain writeups in a structured Git workflow.

## Development Commands

### Testing
- `npm test` - Run all tests with Jest
- `npm run test:watch` - Run tests in watch mode  
- `npm run test:coverage` - Run tests with coverage reporting

### Local Development
- `node bin/cli.js <command>` - Run the CLI locally during development
- `npm link` - Install locally for testing (creates global `flagtrack` command)

## Architecture

### Core Structure
- **CLI Entry Point**: `bin/cli.js` - Commander.js-based CLI interface
- **Main Module**: `index.js` - Programmatic API exports
- **Commands**: `src/commands/` - Individual command implementations
- **Utilities**: `src/utils/` - Shared helper functions

### Key Components

#### Commands (`src/commands/`)
- `setup.js` - Initialize new CTF projects with configuration
- `create.js` - Create new challenge tasks with Git branching
- `solve.js` - Mark challenges complete and merge branches
- `leaderboard.js` - Generate team statistics and rankings
- `updateReadme.js` - Auto-generate progress dashboard

#### Utilities (`src/utils/`)
- `configManager.js` - YAML config handling (`.flagtrack/config.yml`)
- `gitHelpers.js` - Git operations and branch management
- `helpers.js` - Challenge organization and formatting utilities

### Configuration
- Uses `.flagtrack/config.yml` for event configuration
- Config includes event name, categories, and metadata
- Supports nested project structures for multiple events

### Git Workflow
- Creates feature branches per challenge (`category-number-name`)
- Automated merge and cleanup on completion
- GitHub Actions integration for automatic README updates

### Data Flow
1. **Setup**: Creates config, categories, and directory structure
2. **Create**: Generates challenge folders, templates, and Git branches  
3. **Solve**: Updates writeups, records flags/points, merges branches
4. **Update**: Scans directories and regenerates progress dashboard

## Testing Strategy

- Jest test framework with comprehensive test suite
- Mock filesystem operations with `mock-fs`
- Tests cover all commands and utility functions
- Coverage reporting configured for `src/` directory
- Test setup in `test/setup.js`

## Directory Structure

```
src/
├── commands/        # CLI command implementations
│   ├── setup.js    # Project initialization
│   ├── create.js   # Challenge creation
│   ├── solve.js    # Challenge completion
│   ├── leaderboard.js  # Statistics generation
│   └── updateReadme.js # Progress dashboard
└── utils/          # Shared utilities
    ├── configManager.js  # Configuration handling
    ├── gitHelpers.js     # Git operations
    └── helpers.js        # General utilities
```

## Dependencies

### Core Dependencies
- `commander` - CLI framework
- `inquirer` - Interactive prompts
- `simple-git` - Git operations
- `chalk` - Terminal colors
- `conf` - Configuration management
- `yaml` - YAML parsing
- `fs-extra` - Enhanced filesystem operations

### Development Dependencies
- `jest` - Testing framework
- `mock-fs` - Filesystem mocking for tests

## Key Patterns

- All commands are async functions that can be imported/exported
- Configuration is centralized through `configManager.js`
- Git operations are abstracted through `gitHelpers.js`
- Error handling uses chalk for colored terminal output
- File operations use fs-extra for enhanced reliability