# Universal Development Principles (dev.md)

## Sacred Principles & AI Instructions

### ABSOLUTE RULES - NEVER VIOLATE
1. **NO SIMULATIONS** - Never simulate, mock, or fake any functionality
2. **NO FALLBACKS** - Get to the root of problems, never create workarounds
3. **NO TEMPLATES** - Task decomposition must be 100% AI-driven and dynamic
4. **NO ASSUMPTIONS** - Always check documentation before making decisions
5. **ALWAYS REAL** - Every interaction, API call, and execution must be genuine

### General Instructions
- Your primary job is to manage context and enforce sacred principles
- Always read CLAUDE.md first before any task - it is the holy source of truth
- Check existing project documentation before generating questions
- Never commit to git without explicit user approval
- Never run servers - tell the user to run them for testing
- Quality is #1 priority - nothing else matters
- Be brutally honest about whether an idea is good or bad
- Design for semi-autonomous execution with user checkpoints

### Development Philosophy
- **Document-Driven Development**: Documentation drives all decisions
- **Spec-Driven Development**: Complete specifications before coding
- **Planning Phase Sacred**: Comprehensive research and planning required
- **User Sovereignty**: User approval required before execution
- **Quality First**: No compromises on code quality

### Error Handling
- **NEVER SIMULATE**: If something fails, investigate root cause
- **NEVER MOCK SOLUTIONS**: Real implementations only
- **NEVER FALLBACK**: Fix the actual problem, not symptoms
- Get to ROOT of problem always
- If you cannot debug, research more
- Do not make fake solutions

### File Organization & Modularity
- Default to creating multiple small, focused files rather than large monolithic ones
- Each file should have a single responsibility and clear purpose
- Keep files under 350 lines when possible
- Separate concerns: utilities, constants, types, components, and business logic into different files
- Prefer composition over inheritance
- Follow existing project structure and conventions
- Use well defined sub-directories to keep things organized and scalable
- Structure projects with clear folder hierarchies and consistent naming conventions

### Security First
- Never trust external inputs - validate everything at boundaries
- Keep secrets in environment variables, never in code
- Log security events but never log sensitive data
- Authenticate users at the API gateway level
- Use Row Level Security (RLS) to enforce data isolation
- Design auth to work across all client types consistently
- Validate all authentication tokens server-side
- Sanitize all user inputs before storing or processing

### Observable Systems & Logging Standards
- Every request needs a correlation ID for debugging
- Structure logs for machines, not humans - use JSON format
- Make debugging possible across service boundaries
- Include timestamp, level, correlation_id, event, context in logs

### State Management
- Have one source of truth for each piece of state
- Make state changes explicit and traceable
- Design for multi-service processing
- Keep conversation history lightweight

### API Design Principles
- RESTful design with consistent URL patterns
- Use HTTP status codes correctly
- Version APIs from day one (/v1/, /v2/)
- Support pagination for list endpoints
- Use consistent JSON response format:
  - Success: `{ "data": {...}, "error": null }`
  - Error: `{ "data": null, "error": {"message": "...", "code": "..."} }`

### Testing Requirements
- Write tests for all new functionality
- Maintain 80% code coverage minimum
- Test edge cases and error conditions
- Use meaningful test descriptions
- Keep tests independent and idempotent

### Code Quality Standards
- Use meaningful variable and function names
- Keep functions small and focused
- Avoid deep nesting (max 3 levels)
- Handle errors explicitly
- Use early returns to reduce complexity
- Comment complex logic with WHY, not WHAT

### Performance Guidelines
- Optimize for user-perceived performance first
- Measure before optimizing
- Use caching strategically
- Minimize database queries
- Implement pagination for large datasets
- Monitor and alert on performance metrics

### Collaboration Principles
- Write code as if someone else will maintain it
- Document architectural decisions
- Keep commit messages clear and descriptive
- Review your own code before requesting review
- Be constructive in code reviews
- Share knowledge through documentation

---

**Remember**: These principles are universal and apply to ALL projects. They work in conjunction with each project's specific CLAUDE.md requirements.