# STIP — Dialog Engine v2

## Objective

Turn **Demander à STIP** into a durable conversational interface over STIP data, without weakening permissions or coupling the product to a brittle list of regex patches.

The visible interface is preserved initially. The engine is rebuilt behind it.

## Acceptance ledger

### Existing behavior that must remain
- STIP session authentication through `X-STIP-Session`.
- Existing `dialog` permission and dialog access levels.
- Planning lookup for self and other agents.
- Team/shift lookup.
- Contact lookup with level-based e-mail visibility.
- Place lookup.
- Staffing/organization lookup.
- Existing response contract: `kind`, `title`, `text`, `cards`, `actions`, `context`, `suggestions`.
- Existing navigation/actions such as compare and message.

### Failures visible in the current product that v2 must remove
- A generic sentence such as “Y a-t-il un système de chat ici ?” must never be interpreted as a person search.
- “Je peux échanger avec qui la dernière semaine de septembre ?” must not silently fall back to tomorrow.
- Date ranges and calendar expressions must be explicit in the response context.
- A selected person must remain the active subject across follow-up turns.
- Pronouns such as “lui / elle / son / sa” must refer to the active subject only when that subject exists.
- “Les 2” must resolve only when the prior turn exposes exactly two selectable items; otherwise STIP must ask a short clarification.
- STIP must never propose or attempt to message the current user.
- Messaging actions must only be exposed for agents who actually have Messages STIP access.
- The engine must distinguish “avec qui je travaille” from “avec qui je peux échanger mon shift”.
- Unknown wording must not trigger a random person or random place result.

## Architecture

### 1. Interpreter
Pure functions only:
- normalize text
- parse temporal scope
- classify intent
- extract shift
- detect contextual references
- interpret follow-up selections

No database access in this layer.

### 2. Resolvers
Domain-specific entity resolution:
- people
- places
- shifts
- prior choices

Resolvers return confidence and candidates. Low confidence never becomes an automatic answer.

### 3. Capability handlers
One handler per capability:
- self planning
- agent planning
- colleagues / overlap
- shift roster
- exchange candidates
- contact
- place
- organization / staffing
- messaging capability
- generic help

Handlers read STIP data and produce the stable response contract.

### 4. Conversation state
The client still owns the session-local context, but the context becomes structured:

```ts
{
  version: 2,
  subject_agent_ids: string[],
  date_scope: { start: string, end: string, label?: string },
  last_intent?: string,
  last_choice_ids?: string[],
  last_choice_kind?: "agent" | "option",
  offered_options?: string[]
}
```

The server never relies on hidden conversational memory.

### 5. Safety and permissions
- Never expose e-mail above the existing access level.
- Never bypass Messages STIP eligibility.
- Never create a conversation from a search result without an explicit user action.
- Never invent missing planning, location or staffing data.
- Keep visitor/pro behavior explicit.

## Temporal model

Supported by v2:
- aujourd’hui / demain / après-demain / hier
- weekday names
- explicit dates: 25/09, 25 septembre, 25 septembre 2026
- cette semaine / semaine prochaine
- dernière semaine de septembre
- fin septembre
- du 25 au 30 septembre
- follow-up weekday relative to the active temporal context when appropriate

A date query returns a **scope**, not just one date. Single-day capabilities consume the scope start only when the intent is inherently single-day; range-aware capabilities must process the whole range.

## Person resolution rules

A person search is allowed only when:
1. a recognizable person name/nickname is present, or
2. the intent is explicitly person-oriented and the conversation context already has a subject.

Generic tokens, GHE numbers, pronouns, or common words are never enough by themselves to resolve a new person.

## Exchange semantics

“Échanger” refers to the STIP change workflow, not ordinary schedule overlap.

For a requested date/range:
- read the requester’s current shift(s)
- identify colleagues in the same planning team
- exclude self and non-exchangeable responsible/chef profiles
- expose compatible candidates according to the existing STIP change rules
- do not submit a request automatically

## Messaging semantics

The dialog may:
- explain that STIP has a messaging system when the user has access
- offer “Nouveau message”
- offer “Message” on an agent only if that agent is an eligible Messages STIP recipient
- never show “Message” on the current user

## Verification matrix

Minimum parser/conversation cases:
1. Mon horaire demain ?
2. Je suis de quoi moi ?
3. Et vendredi ?
4. Horaire de Yael demain ?
5. Son numéro ?
6. Qui travaille avec lui ?
7. Qui est en J4 demain ?
8. Combien on est demain ?
9. Où est l’IRM ?
10. Y a-t-il un système de chat ici ?
11. Je peux échanger avec qui la dernière semaine de septembre ?
12. dernière semaine de septembre
13. du 25 au 30 septembre
14. Les 2 after exactly two candidates
15. Les 2 after three candidates => clarification
16. generic unknown sentence => help, no random person
17. self planning response => no self-message action
18. agent without Messages STIP => no message action

## Rollout

1. Build and test v2 on a GitHub work branch.
2. Keep production edge function untouched during parser work.
3. Verify TypeScript syntax and pure parser tests.
4. Compare the branch against main.
5. Only then replace/deploy the production edge function and update the frontend contract if required.
