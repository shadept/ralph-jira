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
   */
  constructor(baseUrl, projectId) {
    this.baseUrl = baseUrl;
    this.projectId = projectId;
  }

  /**
   * @param {string} runId
   * @returns {Promise<RunRecord>}
   */
  async readRun(runId) {
    const response = await fetch(
      `${this.baseUrl}/api/runs/${runId}?projectId=${this.projectId}`
    );
    if (!response.ok) {
      throw new Error(`Failed to read run ${runId}: ${response.status}`);
    }
    const { run } = await response.json();
    return run;
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
        headers: { 'Content-Type': 'application/json' },
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
    const response = await fetch(
      `${this.baseUrl}/api/projects/${this.projectId}/settings`
    );
    if (!response.ok) {
      throw new Error(`Failed to read settings: ${response.status}`);
    }
    return response.json();
  }

  /**
   * @param {string} sprintId
   * @returns {Promise<Sprint>}
   */
  async readSprint(sprintId) {
    const response = await fetch(
      `${this.baseUrl}/api/sprints/${sprintId}?projectId=${this.projectId}`
    );
    if (!response.ok) {
      throw new Error(`Failed to read sprint ${sprintId}: ${response.status}`);
    }
    return response.json();
  }

  /**
   * @param {Sprint} sprint
   * @returns {Promise<void>}
   */
  async writeSprint(sprint) {
    const response = await fetch(
      `${this.baseUrl}/api/sprints/${sprint.id}?projectId=${this.projectId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
      `${this.baseUrl}/api/runs/${runId}/cancellation?projectId=${this.projectId}`
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
  async appendLog(runId, entry) {
    const response = await fetch(
      `${this.baseUrl}/api/runs/${runId}/logs?projectId=${this.projectId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry }),
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to append log for ${runId}: ${response.status}`);
    }
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
 * @param {{baseUrl: string, projectId: string}} options
 * @returns {BackendClient}
 */
export function initBackendClient(options) {
  if (!options.baseUrl) {
    throw new Error('BackendClient requires baseUrl');
  }
  if (!options.projectId) {
    throw new Error('BackendClient requires projectId');
  }
  _backendClient = new BackendClient(options.baseUrl, options.projectId);
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
