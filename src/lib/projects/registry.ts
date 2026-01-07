import { promises as fs } from 'fs';
import crypto from 'crypto';
import path from 'path';
import { ProjectMetadata, CreateProjectInput } from './types';
import { backupPlansDirectory, initializeProjectStructure, resolveProjectPath } from './initialization';

const REGISTRY_PATH = path.join(process.cwd(), 'projects.json');

export class ProjectNotFoundError extends Error {
  constructor(public projectId: string) {
    super(`Project with id ${projectId} was not found`);
    this.name = 'ProjectNotFoundError';
  }
}

export class ProjectRegistry {
  private async ensureRegistryFile() {
    try {
      await fs.access(REGISTRY_PATH);
    } catch {
      const defaultProject = await this.createDefaultProject();
      await this.writeProjects([defaultProject]);
    }
  }

  private async readProjects(): Promise<ProjectMetadata[]> {
    await this.ensureRegistryFile();
    const content = await fs.readFile(REGISTRY_PATH, 'utf-8');
    let projects: ProjectMetadata[] = [];
    try {
      projects = JSON.parse(content);
    } catch {
      projects = [];
    }

    if (!projects.length) {
      const defaultProject = await this.createDefaultProject();
      await this.writeProjects([defaultProject]);
      return [defaultProject];
    }

    return projects;
  }

  private async writeProjects(projects: ProjectMetadata[]) {
    await fs.writeFile(REGISTRY_PATH, JSON.stringify(projects, null, 2), 'utf-8');
  }

  private async createDefaultProject(): Promise<ProjectMetadata> {
    const now = new Date().toISOString();
    const workspaceName = path.basename(process.cwd()) || 'Current Workspace';
    await initializeProjectStructure(process.cwd());
    return {
      id: 'current-workspace',
      name: workspaceName,
      path: process.cwd(),
      createdAt: now,
      updatedAt: now,
    };
  }

  private generateProjectId(name: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
    return `${slug}-${crypto.randomUUID().slice(0, 8)}`;
  }

  async listProjects(): Promise<ProjectMetadata[]> {
    return this.readProjects();
  }

  async getProjectOrDefault(projectId?: string): Promise<ProjectMetadata> {
    const projects = await this.readProjects();
    if (!projects.length) {
      throw new ProjectNotFoundError(projectId || 'unknown');
    }

    if (!projectId) {
      return projects[0];
    }

    const project = projects.find(p => p.id === projectId);
    if (!project) {
      throw new ProjectNotFoundError(projectId);
    }

    return project;
  }

  async addProject(input: CreateProjectInput): Promise<ProjectMetadata> {
    const projects = await this.readProjects();
    const name = input.name.trim();
    const normalizedPath = resolveProjectPath(input.path.trim());

    if (!name) {
      throw new Error('Project name is required');
    }

    if (!normalizedPath) {
      throw new Error('Project path is required');
    }

    if (projects.some(project => resolveProjectPath(project.path) === normalizedPath)) {
      throw new Error('A project for this path already exists');
    }

    await initializeProjectStructure(normalizedPath);

    const now = new Date().toISOString();
    const newProject: ProjectMetadata = {
      id: this.generateProjectId(name),
      name,
      path: normalizedPath,
      createdAt: now,
      updatedAt: now,
    };

    projects.push(newProject);
    await this.writeProjects(projects);
    return newProject;
  }

  async removeProject(projectId: string) {
    const projects = await this.readProjects();
    const filtered = projects.filter(project => project.id !== projectId);

    if (filtered.length === projects.length) {
      throw new ProjectNotFoundError(projectId);
    }

    if (!filtered.length) {
      const defaultProject = await this.createDefaultProject();
      filtered.push(defaultProject);
    }

    await this.writeProjects(filtered);
  }

  async regenerateProject(projectId: string) {
    const project = await this.getProjectOrDefault(projectId);
    const backupPath = await backupPlansDirectory(project.path);
    await initializeProjectStructure(project.path);
    return { backupPath };
  }
}

export const projectRegistry = new ProjectRegistry();
