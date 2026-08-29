# Rule: Safe WebSocket Connection Selection

When retrieving a WebSocket connection from an in-memory Map (e.g. tracking active users or devices), NEVER blindly select an element using indexing without verifying its state.

## Why?
Ghost or zombie connections might occupy the collection before they are purged by timeouts or cleanup routines.

## Instructions
**Incorrect:**
```typescript
const [deviceId, socket] = Array.from(userDevices.entries())[0];
if (socket.readyState !== WebSocket.OPEN) return false;
```
This fails if the first connection is closed, even if subsequent connections are open.

**Correct:**
```typescript
let targetSocket = null;
for (const [deviceId, socket] of userDevices.entries()) {
  if (socket.readyState === WebSocket.OPEN) {
    targetSocket = socket;
    break;
  }
}
if (!targetSocket) return false;
```
Always iterate and explicitly filter for `WebSocket.OPEN`.
