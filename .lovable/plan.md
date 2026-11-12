# Personal work tracker

## Goal
Build a private, polished dark workspace for tracking interests, work topics, tasks/subtasks, daily progress, and linked notes.

## Approach
- Use Lovable Cloud auth with email/password, Google, and Sign in with Lovable; create a private profile for each account.
- Keep workspace data in owner-scoped database tables and access it through authenticated, validated server functions.
- Replace the starter screen with an elegant workspace inspired by the user's hand-drawn sidebar and topic/task layout: interest navigation, work-topic selection, expandable tasks/subtasks, clear progress, daily manual progress editing, and searchable topic-linked notes.
- Keep the interface dark, restrained, responsive, and free of sample/demo records.

## Technical details
- Preserve account isolation with row-level security and authenticated server-function middleware.
- Validate progress values, content lengths, hierarchy depth, and all submitted form values.
- Include a profile display-name editor and signup confirmation state.

## Validation
- Exercise public sign-in/sign-up states, account-owned data access, adding a hierarchy item, editing daily progress, linking a note, and mobile layout.
- Run the existing test suite, inspect preview build and runtime logs, and commit the completed change.
