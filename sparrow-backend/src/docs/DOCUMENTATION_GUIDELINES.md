# Documentation Guidelines

## Documentation Location Policy

**All documentation files (.md) must be placed in the `src/docs/` folder.**

### Rules:

1. ✅ **All .md files** (except README.md) should be in `src/docs/`
2. ✅ **README.md files** can remain at their respective directory levels (project root, package root, etc.)
3. ❌ **No .md documentation files** should exist outside `src/docs/` (except README.md)

### Current Documentation Structure:

```
sparrow-backend/
├── README.md                    # ✅ Project-level README (keep at root)
├── src/
│   └── docs/                   # ✅ All documentation here
│       ├── ARCHITECTURE_REPORT.md
│       ├── BACKEND_IMPROVEMENTS.md
│       ├── DOCUMENTATION_INDEX.md
│       ├── FRONTEND_IMPROVEMENTS.md
│       ├── README.md            # ✅ Backend-specific README
│       ├── REFACTORING_SUMMARY.md
│       ├── TECHNICAL_DOCUMENTATION.md
│       └── DOCUMENTATION_GUIDELINES.md (this file)
```

### When Adding New Documentation:

- Place all new .md files in `src/docs/`
- Only README.md files can exist outside `src/docs/`
- Update `DOCUMENTATION_INDEX.md` when adding new documentation

### Rationale:

- Centralized documentation location
- Easy to find and maintain
- Clear separation between code and documentation
- README.md files serve as entry points at directory levels


