#!/usr/bin/env node
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * @typedef {Object} RunRecord
 * @property {string} runId
 * @property {string} [projectId]
 * @property {string} boardId
 * @property {string} [boardName]
 * @property {string} createdAt
 * @property {string|null} startedAt
 * @property {string|null} finishedAt
 * @property {string} status
 * @property {string} [reason]
 * @property {string} boardSourcePath
 * @property {string} sandboxPath
 * @property {string} [sandboxBranch]
 * @property {string} cancelFlagPath
 * @property {string} logPath
 * @property {string} sandboxLogPath
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
 */

/**
 * @typedef {Object} Board
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
 * @typedef {Object} BackendClient
 * @property {(runId: string) => Promise<RunRecord>} readRun
 * @property {(run: RunRecord) => Promise<void>} writeRun
 * @property {() => Promise<ProjectSettings>} readSettings
 * @property {(boardId: string) => Promise<Board>} readBoard
 * @property {(board: Board) => Promise<void>} writeBoard
 * @property {(runId: string) => Promise<boolean>} checkCancellation
 */

/**
 * Writes a payload to a JSON file atomically using a temp file.
 * @param {string} filePath
 * @param {any} payload
 * @returns {Promise<void>}
 */
async function atomicWriteJson(filePath, payload) {
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(payload, null, 2), 'utf-8');
  await fs.rename(tmp, filePath);
}

/**
 * Reads and parses a JSON file.
 * @param {string} filePath
 * @returns {Promise<any>}
 */
async function readJson(filePath) {
  const buffer = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(buffer);
}

/**
 * Gets the file path for a board given its ID.
 * @param {string} plansDir
 * @param {string} boardId
 * @returns {string}
 */
function boardFilePath(plansDir, boardId) {
  const isActiveBoard = boardId === 'prd' || boardId === 'active' || boardId === 'initial-sprint';
  return isActiveBoard
    ? path.join(plansDir, 'prd.json')
    : path.join(plansDir, `${boardId}.json`);
}

/**
 * Local filesystem implementation of BackendClient.
 * @implements {BackendClient}
 */
export class LocalBackendClient {
  /**
   * @param {string} projectPath
   */
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.runsDir = path.join(projectPath, 'plans', 'runs');
    this.plansDir = path.join(projectPath, 'plans');
  }

  /**
   * Reads a run record from the filesystem.
   * @param {string} runId
   * @returns {Promise<RunRecord>}
   */
  async readRun(runId) {
    const filePath = path.join(this.runsDir, `${runId}.json`);
    return readJson(filePath);
  }

  /**
   * Writes a run record to the filesystem atomically.
   * @param {RunRecord} run
   * @returns {Promise<void>}
   */
  async writeRun(run) {
    const filePath = path.join(this.runsDir, `${run.runId}.json`);
    await atomicWriteJson(filePath, run);
  }

  /**
   * Reads project settings from the filesystem.
   * @returns {Promise<ProjectSettings>}
   */
  async readSettings() {
    const filePath = path.join(this.plansDir, 'settings.json');
    return readJson(filePath);
  }

  /**
   * Reads a board from the filesystem.
   * @param {string} boardId
   * @returns {Promise<Board>}
   */
  async readBoard(boardId) {
    const filePath = boardFilePath(this.plansDir, boardId);
    return readJson(filePath);
  }

  /**
   * Writes a board to the filesystem atomically.
   * @param {Board} board
   * @returns {Promise<void>}
   */
  async writeBoard(board) {
    const filePath = boardFilePath(this.plansDir, board.id);
    await atomicWriteJson(filePath, board);
  }

  /**
   * Checks if a cancellation flag exists for the given run.
   * @param {string} runId
   * @returns {Promise<boolean>}
   */
  async checkCancellation(runId) {
    const cancelPath = path.join(this.runsDir, `${runId}.cancel`);
    return existsSync(cancelPath);
  }
}

/**
 * HTTP API implementation of BackendClient (stub for future use).
 * @implements {BackendClient}
 */
export class HttpBackendClient {
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
      `${this.baseUrl}/api/settings?projectId=${this.projectId}`
    );
    if (!response.ok) {
      throw new Error(`Failed to read settings: ${response.status}`);
    }
    return response.json();
  }

  /**
   * @param {string} boardId
   * @returns {Promise<Board>}
   */
  async readBoard(boardId) {
    const response = await fetch(
      `${this.baseUrl}/api/boards/${boardId}?projectId=${this.projectId}`
    );
    if (!response.ok) {
      throw new Error(`Failed to read board ${boardId}: ${response.status}`);
    }
    return response.json();
  }

  /**
   * @param {Board} board
   * @returns {Promise<void>}
   */
  async writeBoard(board) {
    const response = await fetch(
      `${this.baseUrl}/api/boards/${board.id}?projectId=${this.projectId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(board),
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to write board ${board.id}: ${response.status}`);
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
}

/** @type {BackendClient|null} */
let _backendClient = null;

/**
 * Initializes the global backend client singleton.
 * @param {{mode: 'local'|'http', projectPath?: string, baseUrl?: string, projectId?: string}} options
 * @returns {BackendClient}
 */
export function initBackendClient(options) {
  if (options.mode === 'http') {
    if (!options.baseUrl) {
      throw new Error('HttpBackendClient requires baseUrl');
    }
    if (!options.projectId) {
      throw new Error('HttpBackendClient requires projectId');
    }
    _backendClient = new HttpBackendClient(options.baseUrl, options.projectId);
  } else {
    if (!options.projectPath) {
      throw new Error('LocalBackendClient requires projectPath');
    }
    _backendClient = new LocalBackendClient(options.projectPath);
  }
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
