#!/usr/bin/env node

/**
 * @typedef {Object} RunRecord
 * @property {string} runId
 * @property {string} [projectId]
 * @property {string} sprintId
 * @property {string} [sprintName]
 * @property {string} createdAt
 * @property {string|null} startedAt
 * @property {string|null} finishedAt
 * @property {string} status
 * @property {string} [reason]
 * @property {string} sandboxPath
 * @property {string} [sandboxBranch]
 * @property {number} maxIterations
 * @property {number} currentIteration
 * @property {string[]} selectedTaskIds
 * @property {string} [lastTaskId]
 * @property {string} [lastMessage]
 * @property {string} [lastCommand]
 * @property {number|null} [lastCommandExitCode]
 * @property {string[]} errors
 * @property {string} [lastProgressAt]
 * @property {string} executorMode
 * @property {number} [pid]
 * @property {object[]} [commands]
 * @property {string} [cancellationRequestedAt]
 * @property {string} [prUrl]
 */

/**
 * @typedef {Object} Sprint
 * @property {string} id
 * @property {string} name
 * @property {object[]} tasks
 * @property {string} [updatedAt]
 */

/**
 * @typedef {Object} ProjectSettings
 * @property {object} [automation]
 */

/**
 * @typedef {Object} BackendClientInterface
 * @property {(runId: string) => Promise<RunRecord>} readRun
 * @property {(run: RunRecord) => Promise<void>} writeRun
 * @property {() => Promise<ProjectSettings>} readSettings
 * @property {(sprintId: string) => Promise<Sprint>} readSprint
 * @property {(sprint: Sprint) => Promise<void>} writeSprint
 * @property {(runId: string) => Promise<boolean>} checkCancellation
 * @property {(runId: string, entry: string) => Promise<void>} appendLog
 */

/**
 * HTTP API implementation of BackendClient.
 * This is the only client going forward - local mode is deprecated.
 * @implements {BackendClientInterface}
 */
export class BackendClient {
  /**
   * @param {string} baseUrl
   * @param {string} projectId
   * @param {string} [authToken] - Optional auth token for API authentication
   */
  constructor(baseUrl, projectId, authToken = null) {
    this.baseUrl = baseUrl;
    this.projectId = projectId;
    this.authToken = authToken || process.env.RUN_LOOP_AUTH_TOKEN || null;
  }

  /**
   * Get headers for fetch requests, including auth if available.
   * @param {object} [additionalHeaders]
   * @returns {object}
   */
  #getHeaders(additionalHeaders = {}) {
    const headers = { ...additionalHeaders };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  /**
   * @param {string} runId
   * @returns {Promise<RunRecord>}
   */
  async readRun(runId) {
    const url = `${this.baseUrl}/api/runs/${runId}?projectId=${this.projectId}`;
    console.log('[backend-client] readRun fetching:', url);
    const response = await fetch(url, { headers: this.#getHeaders() });
    console.log('[backend-client] readRun response status:', response.status);
    if (!response.ok) {
      const text = await response.text().catch(() => '(no body)');
      console.error('[backend-client] readRun failed:', response.status, text);
      throw new Error(`Failed to read run ${runId}: ${response.status} - ${text}`);
    }
    const data = await response.json();
    console.log('[backend-client] readRun success, run status:', data.run?.status);
    return data.run;
  }

  /**
   * @param {RunRecord} run
   * @returns {Promise<void>}
   */
  async writeRun(run) {
    const response = await fetch(
      `${this.baseUrl}/api/runs/${run.runId}?projectId=${this.projectId}`,
      {
        method: 'PUT',
        headers: this.#getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(run),
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to write run ${run.runId}: ${response.status}`);
    }
  }

  /**
   * @returns {Promise<ProjectSettings>}
   */
  async readSettings() {
    const url = `${this.baseUrl}/api/projects/${this.projectId}/settings`;
    console.log('[backend-client] readSettings fetching:', url);
    const response = await fetch(url, { headers: this.#getHeaders() });
    console.log('[backend-client] readSettings response status:', response.status);
    if (!response.ok) {
      const text = await response.text().catch(() => '(no body)');
      console.error('[backend-client] readSettings failed:', response.status, text);
      throw new Error(`Failed to read settings: ${response.status} - ${text}`);
    }
    const data = await response.json();
    console.log('[backend-client] readSettings success');
    return data;
  }

  /**
   * @param {string} sprintId
   * @returns {Promise<Sprint>}
   */
  async readSprint(sprintId) {
    const url = `${this.baseUrl}/api/projects/${this.projectId}/sprints/${sprintId}`;
    console.log('[backend-client] readSprint fetching:', url);
    const response = await fetch(url, { headers: this.#getHeaders() });
    console.log('[backend-client] readSprint response status:', response.status);
    if (!response.ok) {
      const text = await response.text().catch(() => '(no body)');
      console.error('[backend-client] readSprint failed:', response.status, text);
      throw new Error(`Failed to read sprint ${sprintId}: ${response.status} - ${text}`);
    }
    const data = await response.json();
    console.log('[backend-client] readSprint success, tasks count:', data?.sprint?.tasks?.length || 0);
    return data.sprint;
  }

  /**
   * @param {Sprint} sprint
   * @returns {Promise<void>}
   */
  async writeSprint(sprint) {
    const response = await fetch(
      `${this.baseUrl}/api/projects/${this.projectId}/sprints/${sprint.id}`,
      {
        method: 'PUT',
        headers: this.#getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(sprint),
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to write sprint ${sprint.id}: ${response.status}`);
    }
  }

  /**
   * @param {string} runId
   * @returns {Promise<boolean>}
   */
  async checkCancellation(runId) {
    const response = await fetch(
      `${this.baseUrl}/api/runs/${runId}/cancellation?projectId=${this.projectId}`,
      { headers: this.#getHeaders() }
    );
    if (!response.ok) {
      throw new Error(`Failed to check cancellation for ${runId}: ${response.status}`);
    }
    const { canceled } = await response.json();
    return canceled;
  }

  /**
   * Appends a log entry for a run.
   * @param {string} runId
   * @param {string} entry
   * @returns {Promise<void>}
   */
  async appendLog(runId, message) {
    const response = await fetch(
      `${this.baseUrl}/api/runs/${runId}/logs?projectId=${this.projectId}`,
      {
        method: 'POST',
        headers: this.#getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ message }),
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to append log for ${runId}: ${response.status}`);
    }
  }

  /**
   * Creates a command record for a run.
   * @param {string} runId
   * @param {object} commandData
   * @returns {Promise<object>}
   */
  async createCommand(runId, commandData) {
    const response = await fetch(
      `${this.baseUrl}/api/runs/${runId}/commands?projectId=${this.projectId}`,
      {
        method: 'POST',
        headers: this.#getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(commandData),
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to create command for ${runId}: ${response.status}`);
    }
    const data = await response.json();
    return data.command;
  }

  /**
   * Updates a command record for a run.
   * @param {string} runId
   * @param {object} commandData
   * @returns {Promise<object>}
   */
  async updateCommand(runId, commandData) {
    const response = await fetch(
      `${this.baseUrl}/api/runs/${runId}/commands?projectId=${this.projectId}`,
      {
        method: 'PUT',
        headers: this.#getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(commandData),
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to update command for ${runId}: ${response.status}`);
    }
    const data = await response.json();
    return data.command;
  }

  // Legacy compatibility methods - map board to sprint

  /**
   * @deprecated Use readSprint instead
   * @param {string} boardId
   * @returns {Promise<Sprint>}
   */
  async readBoard(boardId) {
    return this.readSprint(boardId);
  }

  /**
   * @deprecated Use writeSprint instead
   * @param {Sprint} board
   * @returns {Promise<void>}
   */
  async writeBoard(board) {
    return this.writeSprint(board);
  }
}

/** @type {BackendClient|null} */
let _backendClient = null;

/**
 * Initializes the global backend client singleton.
 * Only HTTP mode is supported - local mode is deprecated.
 * @param {{baseUrl: string, projectId: string, authToken?: string}} options
 * @returns {BackendClient}
 */
export function initBackendClient(options) {
  const authToken = options.authToken || process.env.RUN_LOOP_AUTH_TOKEN || null;
  console.log('[backend-client] initBackendClient called with:', {
    baseUrl: options.baseUrl,
    projectId: options.projectId,
    hasAuthToken: !!authToken,
  });
  if (!options.baseUrl) {
    throw new Error('BackendClient requires baseUrl (set RUN_LOOP_API_URL environment variable)');
  }
  if (!options.projectId) {
    throw new Error('BackendClient requires projectId (set RUN_LOOP_PROJECT_ID environment variable)');
  }
  _backendClient = new BackendClient(options.baseUrl, options.projectId, authToken);
  console.log('[backend-client] BackendClient initialized successfully');
  return _backendClient;
}

/**
 * Returns the initialized backend client singleton.
 * @returns {BackendClient}
 */
export function getBackendClient() {
  if (!_backendClient) {
    throw new Error('BackendClient not initialized. Call initBackendClient() first.');
  }
  return _backendClient;
}

/**
 * Resets the backend client singleton (useful for testing).
 */
export function resetBackendClient() {
  _backendClient = null;
}
