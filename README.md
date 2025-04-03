# flagtrack

> A comprehensive CTF challenge tracking and management tool for teams

[![npm version](https://img.shields.io/npm/v/flagtrack.svg)](https://www.npmjs.com/package/flagtrack)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**flagtrack** is a command-line tool that helps CTF teams manage challenges, track progress, and collaborate effectively. It provides a structured approach to organizing writeups, automating Git workflows, and maintaining team progress dashboards.

## 🚀 Features

- **Structured Challenge Management**: Create and organize challenges by category
- **Automatic README Generation**: Keep track of team progress with auto-updating dashboards
- **Git Integration**: Streamlined Git workflows for team collaboration
- **Task Completion Tracking**: Record flags, points, and solvers for each challenge
- **GitHub Actions Support**: Automatic README updates when challenges are solved

## 📋 Installation

```bash
# Global installation (recommended)
npm install -g flagtrack

# Verify installation
flagtrack --version
```

## 🧩 Getting Started

### Setting up a new CTF project

```bash
# Initialize a new CTF project
flagtrack setup
```

This interactive command will:
- Create configuration for a new CTF competition
- Set up categories for challenges
- Configure GitHub Actions for automatic README updates
- Create the necessary directory structure

### Creating a new challenge task

```bash
# Create a new challenge task
flagtrack create
```

This will:
- Create appropriate folders and files for the challenge
- Generate a writeup template
- Create and checkout a Git branch for the task
- Automatically commit and push the branch

### Completing a challenge task

```bash
# Mark a challenge as complete
flagtrack solve
```

Use this command when you've solved a challenge to:
- Record the flag, points, and solver information
- Update the writeup with solution details
- Merge the completed task back to main branch
- Clean up the task branch

### Updating the progress dashboard

```bash
# Generate/update the README progress tracker
flagtrack update
```

This will:
- Scan all challenge directories
- Compile statistics and completion status
- Generate a comprehensive README with progress information
- Show challenge details, flags, and solvers

## 📂 Directory Structure

flagtrack follows a structured approach to organizing CTF challenges:

```
CTF_Name/
├── 01_Crypto/
│   ├── 01_challenge_name/
│   │   ├── writeup.md       # Challenge writeup
│   │   ├── files/           # Challenge files
│   │   ├── exploit/         # Solution files
│   │   ├── screenshots/     # Visual evidence
│   │   └── notes.txt        # Working notes
│   └── ...
├── 02_Web/
├── 03_Pwn/
└── ...
```

## 📝 Writeup Format

Each challenge has a `writeup.md` file with the following structure:

```markdown
# 🧩 Challenge Name

**Category:** Web  
**Points:** 250  
**Flag:** `flag{example_flag_here}`  
**Solver:** Team Member Name

---

## 📝 Challenge Description

> Original challenge description here...

---

## 🛠️ Steps to solution

Detailed walkthrough of the solution...

---

## 🧠 Notes & Takeaways

Things learned, techniques to remember...
```

## 🤝 Git Workflow

flagtrack implements a streamlined Git workflow:

1. **Start a challenge**: `flagtrack create` creates a branch like `web-01-challenge-name`
2. **Work on solution**: Make changes in the task branch
3. **Complete challenge**: `flagtrack solve` updates solution, merges to main, and cleans up
4. **Track progress**: GitHub Actions automatically updates the README

## 🔄 GitHub Actions Integration

When properly set up, flagtrack creates a GitHub Actions workflow to automatically update your README whenever writeups are modified. This keeps your progress dashboard current without manual intervention.

## 🛠️ Advanced Usage

### Configuration

The configuration is stored in `.flagtrack/config.yml` in your repository:

```yaml
ctfName: HackThePlanet 2025
categories:
  1: Crypto
  2: Web
  3: Pwn
  4: Forensics
  5: Misc
  6: Rev
parentDir: null
createdAt: "2025-04-03T12:34:56.789Z"
```

### Programmatic Usage

You can use flagtrack in your scripts:

```javascript
const flagtrack = require('flagtrack');

// Run commands programmatically
flagtrack.commands.updateReadme()
  .then(() => console.log('README updated'))
  .catch(err => console.error(err));
```

## 📚 Command Reference

| Command | Description |
|---------|-------------|
| `flagtrack setup` | Initialize a new CTF project |
| `flagtrack create` | Create a new challenge task |
| `flagtrack solve` | Mark a challenge as completed |
| `flagtrack update` | Update the README progress tracker |
| `flagtrack --help` | Show help information |
| `flagtrack <command> --help` | Show help for a specific command |

## 🔐 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
