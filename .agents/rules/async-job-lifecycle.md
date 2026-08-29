# Rule: Complete Async Job Lifecycles

When implementing asynchronous execution logic (such as a local Runner executing tasks for a Cloud API), you MUST complete the entire bidirectional communication lifecycle.

## Instructions
1. **Client Execution**: The runner executes the job.
2. **Client Callback**: The runner MUST send a success or failure notification back to the API (`client.send({ type: 'job:success', ... })`).
3. **Server Handler**: The API MUST have a corresponding message handler for that event type.
4. **State Mutation**: The API MUST update the underlying database state (e.g. `status: 'active'`) to reflect the completion, ensuring the UI does not hang in a 'pending' state indefinitely.
